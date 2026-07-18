// extractTasks — SINGLE Claude call, forced tool-use (CONTRACTS §3.1).
// One tool `emit_tasks({ tasks: Task[] })`, tool_choice forces it, so the model
// can only respond by emitting structured tasks. Output is zod-validated; on a
// validation failure we do ONE repair retry. Wrapped in withCache.
import type AnthropicNS from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getClient, getModel, type Usage, zeroUsage, addUsage } from './client.js';
import { withCache } from './cache.js';
import { buildExtractSystem, buildExtractUser, type PatientContext } from './prompts/extract.js';
import type { Encounter, Task } from '../types.js';

export type { PatientContext } from './prompts/extract.js';

const CATEGORIES = ['requests', 'specialty_input', 'discharge', 'monitoring', 'medication'] as const;
const EVIDENCE_TYPES = ['transcript', 'note', 'lab', 'mar', 'progress_note', 'protocol', 'observation'] as const;
const STATUSES = ['proposed', 'approved', 'rejected', 'sent', 'waiting', 'returned', 'completed'] as const;

const EvidenceZ = z.object({
  type: z.enum(EVIDENCE_TYPES),
  label: z.string().min(1),
  timestamp: z.string().optional(),
  excerpt: z.string().min(1),
  sourceRef: z.string().optional(),
});

const TaskZ = z.object({
  id: z.string().min(1),
  patientId: z.string().min(1),
  encounterId: z.string().min(1),
  title: z.string().min(1),
  category: z.enum(CATEGORIES),
  timing: z.string().optional(),
  reason: z.string().optional(),
  status: z.enum(STATUSES),
  origin: z.literal('extracted'),
  evidence: z.array(EvidenceZ).min(1),
  confidence: z.number().min(0).max(1).optional(),
});

// JSON schema for the tool input (shape = { tasks: Task[] } per §1).
const EMIT_TASKS_TOOL: AnthropicNS.Tool = {
  name: 'emit_tasks',
  description: 'Emit the follow-up tasks documented in this encounter. Every task must carry >=1 evidence excerpt copied verbatim from the source note or transcript.',
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      tasks: {
        type: 'array',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            id: { type: 'string', description: 'short kebab-case slug for this task' },
            title: { type: 'string' },
            category: { type: 'string', enum: [...CATEGORIES] },
            timing: { type: 'string', description: 'e.g. today, daily, routine, in the morning' },
            reason: { type: 'string', description: 'short reason from the note, if documented' },
            origin: { type: 'string', enum: ['extracted'] },
            status: { type: 'string', enum: ['proposed'] },
            confidence: { type: 'number', description: '0..1 confidence this action is documented' },
            evidence: {
              type: 'array',
              minItems: 1,
              items: {
                type: 'object',
                additionalProperties: false,
                properties: {
                  type: { type: 'string', enum: [...EVIDENCE_TYPES] },
                  label: { type: 'string', description: 'short human label for the source, e.g. "Note: Assessment & Plan"' },
                  timestamp: { type: 'string' },
                  excerpt: { type: 'string', description: 'VERBATIM substring copied exactly from the note/transcript' },
                  sourceRef: { type: 'string' },
                },
                required: ['type', 'label', 'excerpt'],
              },
            },
          },
          required: ['title', 'category', 'evidence'],
        },
      },
    },
    required: ['tasks'],
  } as AnthropicNS.Tool.InputSchema,
};

function slug(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48) || 'task';
}

/** Inject/override server-controlled fields, coerce loose model output into full Tasks. */
function normalize(raw: any, encounter: Encounter, patientId: string): Task[] {
  const list: any[] = Array.isArray(raw?.tasks) ? raw.tasks : [];
  const seen = new Set<string>();
  return list.map((t, i) => {
    let id = typeof t?.id === 'string' && t.id.trim() ? slug(t.id) : slug(t?.title ?? `task-${i + 1}`);
    while (seen.has(id)) id = `${id}-${i + 1}`;
    seen.add(id);
    const evidence = Array.isArray(t?.evidence)
      ? t.evidence.map((e: any) => ({
          type: EVIDENCE_TYPES.includes(e?.type) ? e.type : 'note',
          label: typeof e?.label === 'string' && e.label.trim() ? e.label : 'Source',
          excerpt: typeof e?.excerpt === 'string' ? e.excerpt : '',
          ...(e?.timestamp ? { timestamp: e.timestamp } : {}),
          ...(e?.sourceRef ? { sourceRef: e.sourceRef } : {}),
        }))
      : [];
    return {
      id,
      patientId,
      encounterId: encounter.id,
      title: typeof t?.title === 'string' ? t.title : '',
      category: t?.category,
      ...(t?.timing ? { timing: t.timing } : {}),
      ...(t?.reason ? { reason: t.reason } : {}),
      status: 'proposed',
      origin: 'extracted',
      evidence,
      ...(typeof t?.confidence === 'number' ? { confidence: t.confidence } : {}),
    } as Task;
  });
}

export interface ExtractResult {
  tasks: Task[];
  usage: Usage;
  model: string;
  repaired: boolean;
}

async function runExtraction(encounter: Encounter, ctx: PatientContext): Promise<ExtractResult> {
  const client = getClient();
  const model = getModel();
  const system = buildExtractSystem();
  const messages: AnthropicNS.MessageParam[] = [
    { role: 'user', content: buildExtractUser(encounter, ctx) },
  ];
  let usage = zeroUsage();
  let repaired = false;

  for (let attempt = 0; attempt < 2; attempt++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 16000,
      system,
      tools: [EMIT_TASKS_TOOL],
      tool_choice: { type: 'tool', name: 'emit_tasks' },
      messages,
    });
    usage = addUsage(usage, resp.usage);

    const toolUse = resp.content.find(
      (b): b is AnthropicNS.ToolUseBlock => b.type === 'tool_use' && b.name === 'emit_tasks',
    );
    if (!toolUse) throw new Error('[extractTasks] model did not call emit_tasks');

    const normalized = normalize(toolUse.input, encounter, ctx.patientId);
    const parsed = z.array(TaskZ).safeParse(normalized);
    if (parsed.success) {
      return { tasks: parsed.data, usage, model, repaired };
    }

    if (attempt === 1) {
      throw new Error(`[extractTasks] validation failed after repair: ${parsed.error.message}`);
    }
    // Repair: return a tool_result error and ask the model to re-emit.
    repaired = true;
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          is_error: true,
          content:
            'The emitted tasks failed validation. Fix these issues and call emit_tasks again. ' +
            'Ensure every task has a valid category (requests|specialty_input|discharge|monitoring|medication) ' +
            'and at least one evidence item with a non-empty verbatim excerpt. Errors: ' +
            parsed.error.issues.map((i) => `${i.path.join('.')}: ${i.message}`).join('; '),
        },
      ],
    });
  }
  // Unreachable, but satisfies the type checker.
  throw new Error('[extractTasks] exhausted attempts');
}

/**
 * extractTasks(encounter, patientContext) -> Task[]
 * Cached under namespace 'extract' keyed on the encounter + context.
 */
export async function extractTasks(encounter: Encounter, patientContext: PatientContext): Promise<Task[]> {
  const cacheInput = {
    model: getModel(),
    encounter: {
      id: encounter.id,
      assessment: encounter.assessment,
      planText: encounter.planText,
      visitTitle: encounter.visitTitle,
    },
    ctx: {
      patientId: patientContext.patientId,
      conditionLabels: patientContext.conditionLabels ?? [],
      medicationLabels: patientContext.medicationLabels ?? [],
      keyObservations: patientContext.keyObservations ?? [],
      transcriptExcerpts: patientContext.transcriptExcerpts ?? [],
    },
  };
  const { output } = await withCache<ExtractResult>('extract', cacheInput, async () => {
    const result = await runExtraction(encounter, patientContext);
    return { output: result, model: result.model };
  });
  return output.tasks;
}

/** Same as extractTasks but returns the full result (tasks + usage) for tooling/warm. */
export async function extractTasksVerbose(
  encounter: Encounter,
  patientContext: PatientContext,
): Promise<{ result: ExtractResult; hit: boolean; key: string }> {
  const cacheInput = {
    model: getModel(),
    encounter: {
      id: encounter.id,
      assessment: encounter.assessment,
      planText: encounter.planText,
      visitTitle: encounter.visitTitle,
    },
    ctx: {
      patientId: patientContext.patientId,
      conditionLabels: patientContext.conditionLabels ?? [],
      medicationLabels: patientContext.medicationLabels ?? [],
      keyObservations: patientContext.keyObservations ?? [],
      transcriptExcerpts: patientContext.transcriptExcerpts ?? [],
    },
  };
  const { output, hit, key } = await withCache<ExtractResult>('extract', cacheInput, async () => {
    const result = await runExtraction(encounter, patientContext);
    return { output: result, model: result.model };
  });
  return { result: output, hit, key };
}
