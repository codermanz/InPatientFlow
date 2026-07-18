// suggestNextSteps — bounded ReAct agent (CONTRACTS §3.2 / TECH_DESIGN §5.2).
// The model reasons, pulls evidence via read-only chart tools, and terminates
// by calling emit_suggestion. Evidence[] is populated from the tool calls the
// agent actually made, so it reflects what it looked up. Cached via withCache.
import type AnthropicNS from '@anthropic-ai/sdk';
import { z } from 'zod';
import { getClient, getModel, type Usage, zeroUsage, addUsage } from './client.js';
import { withCache } from './cache.js';
import { buildSuggestSystem, buildSuggestSeed, buildRecommendSeed, buildReassessSeed } from './prompts/suggest.js';
import type { ChartProvider } from './chart.js';
import type { EvidenceRef, EvidenceType, ResultEvent, Suggestion, TraceStep } from '../types.js';
import { loadWorkflows, getWorkflow, isWorkflowId, workflowLabel, mapActionToWorkflow } from '../store/workflows.js';

const MAX_ITERATIONS = 12;

const READ_TOOLS: AnthropicNS.Tool[] = [
  {
    name: 'search_observations',
    description: 'Search the patient chart for lab/vital observations (e.g. troponin values, ECG findings, heart rate, blood pressure). Returns matching observations with values, units, and times.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        patientId: { type: 'string' },
        query: { type: 'string', description: 'observation name to search, e.g. "potassium"' },
        limit: { type: 'number' },
      },
      required: ['patientId', 'query'],
    } as AnthropicNS.Tool.InputSchema,
  },
  {
    name: 'get_medications',
    description: 'Get the active medication list for the patient (name, dose, status).',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { patientId: { type: 'string' } },
      required: ['patientId'],
    } as AnthropicNS.Tool.InputSchema,
  },
  {
    name: 'get_note_section',
    description: 'Read a section of the encounter note. section is one of: subjective, objective, assessment, plan.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: {
        encounterId: { type: 'string' },
        section: { type: 'string', enum: ['subjective', 'objective', 'assessment', 'plan'] },
      },
      required: ['section'],
    } as AnthropicNS.Tool.InputSchema,
  },
  {
    name: 'get_local_guidance',
    description: 'Fetch the trust protocol/guidance snippet for a topic (e.g. "chest pain", "acs", "troponin").',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { topic: { type: 'string' } },
      required: ['topic'],
    } as AnthropicNS.Tool.InputSchema,
  },
  {
    name: 'search_workflows',
    description: 'Search the operator-configured workflow catalog for workflows that could EXECUTE a proposed clinical action. Returns matching workflows (id, name, description). Pass a short query describing the action (e.g. "repeat troponin", "ecg", "cardiac monitoring", "cardiology review", "administer aspirin", "recheck"). Empty query returns the full catalog.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { query: { type: 'string', description: 'keywords describing the action to execute' } },
      required: ['query'],
    } as AnthropicNS.Tool.InputSchema,
  },
  {
    name: 'get_workflow',
    description: 'Fetch the full definition (id, name, description) of a single workflow by its id.',
    input_schema: {
      type: 'object',
      additionalProperties: false,
      properties: { id: { type: 'string' } },
      required: ['id'],
    } as AnthropicNS.Tool.InputSchema,
  },
];

const EMIT_SUGGESTION_TOOL: AnthropicNS.Tool = {
  name: 'emit_suggestion',
  description: 'TERMINAL. Emit the final suggestion for the clinician to review. Call this once you have gathered enough evidence.',
  // strict guarantees the emitted input validates exactly against the schema.
  strict: true,
  input_schema: {
    type: 'object',
    additionalProperties: false,
    properties: {
      headline: { type: 'string', description: 'ONE short line (<= ~12 words) stating why this needs clinician review. NO full reasoning here.' },
      summary: { type: 'string', description: 'the full factual reasoning grounded in the evidence gathered' },
      anomaly: {
        type: 'object',
        additionalProperties: false,
        description: 'the explicit determination that the returned result is an anomaly (set for a returned result review). Omit for a purely proactive concern.',
        properties: {
          detected: { type: 'boolean' },
          description: { type: 'string', description: 'one-line statement that the result is an anomaly, e.g. "Troponin I markedly raised at 4274 ng/L (ref < 14) in the context of chest pain"' },
        },
        required: ['detected', 'description'],
      },
      proposedActions: {
        type: 'array',
        minItems: 1,
        description: 'concrete, workflow-backed clinical actions for the clinician to confirm. NO generic filler (no "escalate to senior", "document plan", vague "monitor"/"assess"). Aim for 3-5 crisp actions.',
        items: {
          type: 'object',
          additionalProperties: false,
          properties: {
            title: { type: 'string', description: 'concise imperative action, e.g. "Repeat Troponin I in 3 hours", "12-Lead ECG", "Cardiology Review", "Aspirin 300 mg (if no contraindication)"' },
            detail: { type: 'string', description: 'short rationale citing the evidence/guidance it came from; a specific drug+dose is allowed but must be phrased as an option the clinician confirms' },
            selectedByDefault: { type: 'boolean' },
            workflowId: {
              type: 'string',
              description: 'the id of the workflow that best executes this action — you MUST have discovered this id via search_workflows / get_workflow (do not invent ids)',
            },
          },
          required: ['title', 'detail', 'selectedByDefault', 'workflowId'],
        },
      },
      guardrails: {
        type: 'array',
        minItems: 1,
        items: { type: 'string' },
        description: 'decision-support / human-in-the-loop safety notes, e.g. "clinician confirms every drug and dose before it is administered", "a finding/interpretation, not a final diagnosis", "nothing is executed until Confirm & Execute"',
      },
    },
    required: ['headline', 'summary', 'proposedActions', 'guardrails'],
  } as AnthropicNS.Tool.InputSchema,
};

const ALL_TOOLS = [...READ_TOOLS, EMIT_SUGGESTION_TOOL];

const ActionZ = z.object({
  title: z.string().min(1),
  detail: z.string().optional(),
  selectedByDefault: z.boolean(),
  workflowId: z.string().optional(),
});

const AnomalyZ = z.object({
  detected: z.boolean(),
  description: z.string().min(1),
});

const SuggestionInputZ = z.object({
  headline: z.string().min(1),
  summary: z.string().min(1),
  anomaly: AnomalyZ.optional(),
  proposedActions: z.array(ActionZ).min(1),
  guardrails: z.array(z.string().min(1)).min(1),
});

// A degenerate/placeholder action title the model should never emit (prompt
// rule 6). Used to detect a spoiled emit and trigger recovery.
const PLACEHOLDER_RE = /^\s*(placeholder|todo|tbd|n\/?a|\.\.\.|xxx|example)\s*$/i;

function actionsAreDegenerate(
  actions: { title: string }[],
): boolean {
  return actions.length === 0 || actions.every((a) => PLACEHOLDER_RE.test(a.title));
}

/**
 * Strip a leaked tool-call serialization from a string field. The model
 * occasionally writes the proposedActions array as XML/text INTO the summary
 * ("…</summary>\n<parameter name=\"proposedActions\">[…]") instead of the
 * structured param. Cut the summary at the first leaked tag.
 */
function stripLeak(s: string): string {
  if (typeof s !== 'string') return s;
  const cut = s.search(/<\/summary>|<parameter\s+name=|<function|<invoke\b/i);
  return cut === -1 ? s : s.slice(0, cut).trim();
}

/**
 * When the structured proposedActions are degenerate (all "placeholder"), the
 * REAL actions the model produced are often still present, serialized as text
 * inside another field. Recover and parse them so we keep the genuine output.
 */
function recoverLeakedActions(
  raw: unknown,
): z.infer<typeof SuggestionInputZ>['proposedActions'] | null {
  const obj = (raw ?? {}) as Record<string, unknown>;
  // The leaked array lives verbatim inside a string field (usually summary).
  const fields = Object.values(obj).filter((v): v is string => typeof v === 'string');
  for (const hay of fields) {
    const idx = hay.indexOf('proposedActions');
    if (idx === -1) continue;
    const bracket = hay.indexOf('[', idx);
    if (bracket === -1) continue;
    const jsonText = extractJsonArray(hay, bracket);
    if (!jsonText) continue;
    for (const candidate of [jsonText, jsonText.replace(/\\"/g, '"').replace(/\\n/g, ' ')]) {
      try {
        const arr = JSON.parse(candidate);
        const parsed = z.array(ActionZ).min(1).safeParse(arr);
        if (parsed.success && !actionsAreDegenerate(parsed.data)) return parsed.data;
      } catch {
        /* try next candidate / field */
      }
    }
  }
  return null;
}

/** Extract a balanced [...] JSON array starting at `start` in `s`. */
function extractJsonArray(s: string, start: number): string | null {
  let depth = 0;
  let inStr = false;
  let esc = false;
  for (let i = start; i < s.length; i++) {
    const c = s[i];
    if (inStr) {
      if (esc) esc = false;
      else if (c === '\\') esc = true;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '[') depth++;
    else if (c === ']') {
      depth--;
      if (depth === 0) return s.slice(start, i + 1);
    }
  }
  return null;
}

export interface ToolCallTrace {
  step: number;
  tool: string;
  input: unknown;
  observation: string;
}

export interface SuggestResult {
  suggestion: Suggestion;
  trace: ToolCallTrace[];
  usage: Usage;
  model: string;
  iterations: number;
  hitMaxIterations: boolean;
}

function short(s: string, n = 280): string {
  return s.length > n ? s.slice(0, n - 1) + '…' : s;
}

/** Build Suggestion.evidence[] from the read-tool calls the agent actually made. */
function evidenceFromTrace(trace: ToolCallTrace[]): EvidenceRef[] {
  const out: EvidenceRef[] = [];
  const seen = new Set<string>();
  const push = (type: EvidenceType, label: string, excerpt: string, timestamp?: string) => {
    const key = `${type}|${label}|${excerpt}`;
    if (!excerpt.trim() || seen.has(key)) return;
    seen.add(key);
    out.push({ type, label, excerpt, ...(timestamp ? { timestamp } : {}) });
  };
  for (const t of trace) {
    if (t.tool === 'search_observations') {
      const q = (t.input as any)?.query ?? 'observations';
      push('lab', `Lab: ${q}`, short(t.observation, 240));
    } else if (t.tool === 'get_medications') {
      push('mar', 'Active medications', short(t.observation, 240));
    } else if (t.tool === 'get_note_section') {
      const sec = (t.input as any)?.section ?? 'note';
      const type: EvidenceType = sec === 'plan' || sec === 'subjective' ? 'progress_note' : 'note';
      push(type, `Note: ${sec}`, short(t.observation, 240));
    } else if (t.tool === 'get_local_guidance') {
      push('protocol', 'Hospital protocol', short(t.observation, 280));
    }
  }
  return out;
}

/** Human-readable input string for a tool call, for the displayed trace. */
function traceInput(tool: string, input: any): string {
  switch (tool) {
    case 'search_observations':
      return `query "${input?.query ?? ''}"`;
    case 'get_medications':
      return 'active medication list';
    case 'get_note_section':
      return `note section "${input?.section ?? ''}"`;
    case 'get_local_guidance':
      return `topic "${input?.topic ?? ''}"`;
    case 'search_workflows':
      return `query "${input?.query ?? ''}"`;
    case 'get_workflow':
      return `id "${input?.id ?? ''}"`;
    default:
      return typeof input === 'string' ? input : JSON.stringify(input ?? {});
  }
}

/** Build the displayed ReAct trace (TraceStep[]) from the raw tool-call log. */
function traceStepsFromTrace(trace: ToolCallTrace[]): TraceStep[] {
  return trace.map((t) => ({
    order: t.step,
    tool: t.tool,
    input: traceInput(t.tool, t.input),
    summary: short(t.observation, 200),
  }));
}

async function executeReadTool(
  name: string,
  input: any,
  fallbackPatientId: string,
  chart: ChartProvider,
): Promise<string> {
  const pid = input?.patientId || fallbackPatientId;
  switch (name) {
    case 'search_observations': {
      const obs = await chart.searchObservations(pid, input?.query ?? '', input?.limit);
      if (!obs.length) return `No observations found for "${input?.query}".`;
      return obs.map((o) => `${o.name}: ${o.value}${o.unit ? ' ' + o.unit : ''}${o.time ? ' @ ' + o.time : ''}`).join('; ');
    }
    case 'get_medications': {
      const meds = await chart.getMedications(pid);
      if (!meds.length) return 'No active medications on file.';
      return meds.map((m) => `${m.name}${m.dose ? ' ' + m.dose : ''}${m.status ? ' (' + m.status + ')' : ''}`).join('; ');
    }
    case 'get_note_section': {
      return await chart.getNoteSection(input?.encounterId ?? '', input?.section ?? '');
    }
    case 'get_local_guidance': {
      const g = await chart.getLocalGuidance(input?.topic ?? '');
      return `${g.title} (${g.version}): ${g.excerpt}`;
    }
    case 'search_workflows': {
      const q = (input?.query ?? '').trim().toLowerCase();
      const all = loadWorkflows();
      const tokens = q.split(/\s+/).filter(Boolean);
      const matches = tokens.length
        ? all.filter((w) => {
            const hay = `${w.id} ${w.name} ${w.description} ${w.category ?? ''}`.toLowerCase();
            return tokens.some((t: string) => hay.includes(t));
          })
        : all;
      const list = matches.length ? matches : all;
      return list.map((w) => `${w.id}: ${w.name} — ${w.description}`).join('\n');
    }
    case 'get_workflow': {
      const w = getWorkflow(input?.id ?? '');
      return w ? `${w.id}: ${w.name} — ${w.description}` : `No workflow with id '${input?.id}'.`;
    }
    default:
      return `Unknown tool: ${name}`;
  }
}

/** Identity of the emitted Suggestion (differs for result-review vs proactive). */
interface SuggestionIdentity {
  id: string; // Suggestion.id
  resultEventId: string; // '' for a proactive recommendation (no result yet)
  actionPrefix: string; // proposedAction id prefix
  label: string; // for error messages
  requireAnomaly: boolean; // screen 9 (suggestNextSteps): always attach an anomaly determination
  anomalyFallback?: string; // one-liner used if the model omits the anomaly
}

/**
 * Shared bounded ReAct loop (CONTRACTS §3.2 / §3.3). Seeded with either a
 * returned result (buildSuggestSeed) or a proactive concern (buildRecommendSeed);
 * both terminate with emit_suggestion. Evidence[] is built from the tool calls
 * the agent actually made.
 */
async function runAgent(
  seed: string,
  patientId: string,
  chart: ChartProvider,
  identity: SuggestionIdentity,
): Promise<SuggestResult> {
  const client = getClient();
  const model = getModel();
  const system = buildSuggestSystem();
  const messages: AnthropicNS.MessageParam[] = [{ role: 'user', content: seed }];
  const trace: ToolCallTrace[] = [];
  let usage = zeroUsage();
  let step = 0;

  for (let iter = 0; iter < MAX_ITERATIONS; iter++) {
    const resp = await client.messages.create({
      model,
      max_tokens: 4096,
      system,
      tools: ALL_TOOLS,
      // Auto lets the model decide when to stop reading and terminate with
      // emit_suggestion; one tool per turn keeps the ReAct trace clean.
      tool_choice: { type: 'auto', disable_parallel_tool_use: true },
      messages,
    });
    usage = addUsage(usage, resp.usage);

    const toolUse = resp.content.find((b): b is AnthropicNS.ToolUseBlock => b.type === 'tool_use');
    if (!toolUse) {
      // Model ended its turn with text and no tool call — nudge it to the
      // terminal emit below.
      messages.push({ role: 'assistant', content: resp.content });
      break;
    }

    if (toolUse.name === 'emit_suggestion') {
      const parsed = SuggestionInputZ.safeParse(toolUse.input);
      if (!parsed.success) {
        throw new Error(`[${identity.label}] emit_suggestion failed validation: ${parsed.error.message}`);
      }
      let data = repairEmit(parsed.data, toolUse.input);
      // If the actions are still degenerate after deterministic salvage, ask the
      // model to re-emit once (rare — the salvage above normally recovers them).
      if (actionsAreDegenerate(data.proposedActions)) {
        const redo = await forceCleanEmit(client, model, system, messages, resp.content, toolUse);
        if (redo) {
          usage = addUsage(usage, redo.usage);
          data = redo.data;
        }
      }
      const suggestion = finalizeSuggestion(data, identity, trace);
      return { suggestion, trace, usage, model, iterations: iter + 1, hitMaxIterations: false };
    }

    // Read tool: execute and feed the observation back.
    const observation = await executeReadTool(toolUse.name, toolUse.input, patientId, chart);
    trace.push({ step: ++step, tool: toolUse.name, input: toolUse.input, observation });
    messages.push({ role: 'assistant', content: resp.content });
    messages.push({
      role: 'user',
      content: [{ type: 'tool_result', tool_use_id: toolUse.id, content: observation }],
    });
  }

  // Hit the iteration cap without terminating: force one final emit_suggestion.
  messages.push({
    role: 'user',
    content:
      'You have gathered enough evidence. Call emit_suggestion NOW. Include EVERY concrete next step your investigation supports (each as its own proposedAction with a detail citing the evidence) — do not collapse them into a single action. The clinician confirms each one.',
  });
  const finalResp = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    tools: ALL_TOOLS,
    tool_choice: { type: 'tool', name: 'emit_suggestion' },
    messages,
  });
  usage = addUsage(usage, finalResp.usage);
  const finalTool = finalResp.content.find(
    (b): b is AnthropicNS.ToolUseBlock => b.type === 'tool_use' && b.name === 'emit_suggestion',
  );
  if (!finalTool) throw new Error(`[${identity.label}] failed to emit a suggestion within the iteration cap`);
  const parsed = SuggestionInputZ.safeParse(finalTool.input);
  if (!parsed.success) throw new Error(`[${identity.label}] final emit failed validation: ${parsed.error.message}`);
  const suggestion = finalizeSuggestion(repairEmit(parsed.data, finalTool.input), identity, trace);
  return { suggestion, trace, usage, model, iterations: MAX_ITERATIONS, hitMaxIterations: true };
}

/** Deterministically salvage a spoiled emit: strip leaked tool-call text from
 *  the summary, and recover real proposedActions if they leaked into a field. */
function repairEmit(
  data: z.infer<typeof SuggestionInputZ>,
  raw: unknown,
): z.infer<typeof SuggestionInputZ> {
  const summary = stripLeak(data.summary) || data.summary;
  if (actionsAreDegenerate(data.proposedActions)) {
    const recovered = recoverLeakedActions(raw);
    if (recovered) return { ...data, summary, proposedActions: recovered };
  }
  return { ...data, summary };
}

/** Last-resort corrective re-emit when salvage fails. Responds to the spoiled
 *  emit's tool_use with a rejection, then forces one clean emit_suggestion. */
async function forceCleanEmit(
  client: ReturnType<typeof getClient>,
  model: string,
  system: string,
  messages: AnthropicNS.MessageParam[],
  assistantContent: AnthropicNS.ContentBlock[],
  toolUse: AnthropicNS.ToolUseBlock,
): Promise<{ data: z.infer<typeof SuggestionInputZ>; usage: Usage } | null> {
  const convo: AnthropicNS.MessageParam[] = [
    ...messages,
    { role: 'assistant', content: assistantContent },
    {
      role: 'user',
      content: [
        {
          type: 'tool_result',
          tool_use_id: toolUse.id,
          content:
            'Rejected: proposedActions contained a placeholder and/or the summary leaked tool-call text. Re-emit NOW with the REAL concrete actions (each its own item with a detail citing evidence) and a clean prose summary with no XML/tags.',
        },
      ],
    },
  ];
  const resp = await client.messages.create({
    model,
    max_tokens: 4096,
    system,
    tools: ALL_TOOLS,
    tool_choice: { type: 'tool', name: 'emit_suggestion' },
    messages: convo,
  });
  const t = resp.content.find(
    (b): b is AnthropicNS.ToolUseBlock => b.type === 'tool_use' && b.name === 'emit_suggestion',
  );
  if (!t) return null;
  const parsed = SuggestionInputZ.safeParse(t.input);
  if (!parsed.success) return null;
  const data = repairEmit(parsed.data, t.input);
  if (actionsAreDegenerate(data.proposedActions)) return null;
  return { data, usage: addUsage(zeroUsage(), resp.usage) };
}

function finalizeSuggestion(
  data: z.infer<typeof SuggestionInputZ>,
  identity: SuggestionIdentity,
  trace: ToolCallTrace[],
): Suggestion {
  // Anomaly: screen 9 always carries an explicit determination. Use the model's
  // if valid, else synthesize from the fallback one-liner.
  let anomaly: Suggestion['anomaly'];
  if (data.anomaly && data.anomaly.detected && data.anomaly.description.trim()) {
    anomaly = { detected: true, description: data.anomaly.description.trim() };
  } else if (identity.requireAnomaly) {
    anomaly = {
      detected: true,
      description: identity.anomalyFallback || data.headline,
    };
  }

  const suggestion: Suggestion = {
    id: identity.id,
    resultEventId: identity.resultEventId,
    headline: data.headline,
    summary: data.summary,
    proposedActions: data.proposedActions.map((a, i) => {
      // Trust the model's workflowId if it's a real catalog id; otherwise map
      // from the action title (backend keyword fallback).
      const workflowId = isWorkflowId(a.workflowId) ? a.workflowId : mapActionToWorkflow(a.title);
      return {
        id: `${identity.actionPrefix}-${i + 1}`,
        title: a.title,
        ...(a.detail ? { detail: a.detail } : {}),
        selectedByDefault: a.selectedByDefault,
        workflowId,
        workflowLabel: workflowLabel(workflowId),
      };
    }),
    // Evidence reflects the tool calls the agent actually made.
    evidence: evidenceFromTrace(trace),
    guardrails: data.guardrails,
    // The agent's actual ReAct trace (evidence of what it checked).
    trace: traceStepsFromTrace(trace),
  };
  if (anomaly) suggestion.anomaly = anomaly;
  return suggestion;
}

function runSuggestion(
  resultEvent: ResultEvent,
  patientId: string,
  chart: ChartProvider,
): Promise<SuggestResult> {
  const oneLiner = `Patient ${patientId}: monitored ${resultEvent.name} returned ${resultEvent.value}${resultEvent.unit ? ' ' + resultEvent.unit : ''} (${resultEvent.status})${resultEvent.priorValue ? `, prior ${resultEvent.priorValue}` : ''}.`;
  const anomalyFallback = `${resultEvent.name} returned ${resultEvent.value}${resultEvent.unit ? ' ' + resultEvent.unit : ''}${resultEvent.priorValue ? ` (prior ${resultEvent.priorValue}${resultEvent.unit ? ' ' + resultEvent.unit : ''})` : ''} — flagged ${resultEvent.status}${resultEvent.refRange ? `, outside the reference range ${resultEvent.refRange}` : ''}.`;
  return runAgent(buildSuggestSeed(resultEvent, oneLiner), patientId, chart, {
    id: `sug-${resultEvent.id}`,
    resultEventId: resultEvent.id,
    actionPrefix: `act-${resultEvent.id}`,
    label: 'suggestNextSteps',
    requireAnomaly: true,
    anomalyFallback,
  });
}

function runRecommendation(
  patientId: string,
  concern: string,
  chart: ChartProvider,
): Promise<SuggestResult> {
  return runAgent(buildRecommendSeed(patientId, concern), patientId, chart, {
    id: `rec-${patientId}`,
    resultEventId: '', // proactive: no returned result yet
    actionPrefix: `rec-${patientId}`,
    label: 'recommendProactive',
    requireAnomaly: false, // proactive concern, not a returned-result anomaly
  });
}

function runReassessment(
  patientId: string,
  recheck: ResultEvent,
  chart: ChartProvider,
): Promise<SuggestResult> {
  return runAgent(buildReassessSeed(patientId, recheck), patientId, chart, {
    id: `reassess-${recheck.id}`,
    resultEventId: recheck.id,
    actionPrefix: `reassess-${recheck.id}`,
    label: 'reassessAfterRecheck',
    requireAnomaly: false, // closed-loop re-review: the value is improving, not an anomaly
  });
}

/**
 * suggestNextSteps(resultEvent, patientId, chart) -> Suggestion.
 * Cached under namespace 'suggest' keyed on {resultEvent, patientId}. The full
 * tool transcript is cached alongside the suggestion for replay/inspection.
 */
export async function suggestNextSteps(
  resultEvent: ResultEvent,
  patientId: string,
  chart: ChartProvider,
): Promise<Suggestion> {
  const { output } = await withCache<SuggestResult>(
    'suggest',
    { model: getModel(), resultEvent, patientId },
    async () => {
      const result = await runSuggestion(resultEvent, patientId, chart);
      return { output: result, model: result.model };
    },
  );
  return output.suggestion;
}

/**
 * recommendProactive(patientId, concern, chart) -> Suggestion (CONTRACTS §3.3).
 * SAME ReAct engine/tools/guardrails as suggestNextSteps, but seeded with a
 * CONCERN instead of a ResultEvent (powers screen 4 / endpoint 14).
 * Cached under namespace 'recommend' keyed on {model, patientId, concern}.
 */
export async function recommendProactive(
  patientId: string,
  concern: string,
  chart: ChartProvider,
): Promise<Suggestion> {
  const { output } = await withCache<SuggestResult>(
    'recommend',
    { model: getModel(), patientId, concern },
    async () => {
      const result = await runRecommendation(patientId, concern, chart);
      return { output: result, model: result.model };
    },
  );
  return output.suggestion;
}

/** Same as recommendProactive but returns the full result (suggestion + trace + usage). */
export async function recommendProactiveVerbose(
  patientId: string,
  concern: string,
  chart: ChartProvider,
): Promise<{ result: SuggestResult; hit: boolean; key: string }> {
  const { output, hit, key } = await withCache<SuggestResult>(
    'recommend',
    { model: getModel(), patientId, concern },
    async () => {
      const result = await runRecommendation(patientId, concern, chart);
      return { output: result, model: result.model };
    },
  );
  return { result: output, hit, key };
}

/**
 * reassessAfterRecheck(patientId, recheck, chart) -> Suggestion (CONTRACTS §3.4).
 * Closed loop: after the clinician triggered the corrective workflow, the repeat
 * lab returned improved; the SAME ReAct engine briefly re-assesses. Cached under
 * namespace 'reassess' keyed on {model, patientId, recheck}.
 */
export async function reassessAfterRecheck(
  patientId: string,
  recheck: ResultEvent,
  chart: ChartProvider,
): Promise<Suggestion> {
  const { output } = await withCache<SuggestResult>(
    'reassess',
    { model: getModel(), patientId, recheck },
    async () => {
      const result = await runReassessment(patientId, recheck, chart);
      return { output: result, model: result.model };
    },
  );
  return output.suggestion;
}

/** Same as reassessAfterRecheck but returns the full result (suggestion + trace + usage). */
export async function reassessAfterRecheckVerbose(
  patientId: string,
  recheck: ResultEvent,
  chart: ChartProvider,
): Promise<{ result: SuggestResult; hit: boolean; key: string }> {
  const { output, hit, key } = await withCache<SuggestResult>(
    'reassess',
    { model: getModel(), patientId, recheck },
    async () => {
      const result = await runReassessment(patientId, recheck, chart);
      return { output: result, model: result.model };
    },
  );
  return { result: output, hit, key };
}

/** Same as suggestNextSteps but returns the full result (suggestion + trace + usage). */
export async function suggestNextStepsVerbose(
  resultEvent: ResultEvent,
  patientId: string,
  chart: ChartProvider,
): Promise<{ result: SuggestResult; hit: boolean; key: string }> {
  const { output, hit, key } = await withCache<SuggestResult>(
    'suggest',
    { model: getModel(), resultEvent, patientId },
    async () => {
      const result = await runSuggestion(resultEvent, patientId, chart);
      return { output: result, model: result.model };
    },
  );
  return { result: output, hit, key };
}
