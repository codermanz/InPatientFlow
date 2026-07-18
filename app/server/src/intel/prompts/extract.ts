// Prompt builders for task extraction (CONTRACTS §3.1 / TECH_DESIGN §5.1).
import type { Encounter } from '../../types.js';

export interface PatientContext {
  patientId: string;
  name?: string;
  ageSex?: string;
  conditionLabels?: string[];
  medicationLabels?: string[];
  keyObservations?: { name: string; value: string; unit?: string; time?: string }[];
  transcriptExcerpts?: string[]; // speaker-labeled lines or excerpts
}

export function buildExtractSystem(): string {
  return [
    'You are WardFlow, a clinical documentation assistant for inpatient ward rounds.',
    'Your ONLY job is to extract the discrete follow-up actions that the clinician DOCUMENTED in this encounter, so they can be reviewed and confirmed by a clinician before anything happens.',
    '',
    'Hard rules (safety-critical):',
    '1. Extract ONLY actions that are actually documented in the note Assessment & Plan or the transcript. Never invent, infer, or add an action that is not written down.',
    '2. Every task MUST cite at least one piece of evidence: an EvidenceRef whose "excerpt" is a VERBATIM substring copied exactly from the source note or transcript (do not paraphrase, reword, or fix typos in the excerpt).',
    '3. You are NOT diagnosing and NOT prescribing. Do not create tasks that state a diagnosis or order a specific new drug and dose. Capture only what the clinician documented (e.g. "continue home lisinopril" is a documented action; inventing a new drug is not).',
    '4. Categorize each task as exactly one of: requests | specialty_input | discharge | monitoring | medication. Pick the category by the ACTION VERB, not the topic:',
    '   - requests: anything that ORDERS an investigation — a lab, panel, test, swab, imaging study, or ECG (e.g. "Troponin I", "12-lead ECG", "Chest X-Ray", "COVID PCR", "Full Blood Count and U&Es", "repeat troponin"). If it results in an order being placed, it is a request, even when framed as "monitor with serial X".',
    '   - specialty_input: consults / reviews by another specialty or service (e.g. "Cardiology review").',
    '   - discharge: discharge planning, disposition, follow-up arrangements.',
    '   - monitoring: PURE observation with NO order attached — bedside watching, vitals/telemetry charting, "watch for" instructions, titration of an existing therapy. If a monitoring instruction also requires ordering a lab/test, classify it as requests instead.',
    '   - medication: start/continue/hold/adjust/review a documented medication (e.g. "give aspirin loading dose", "start enoxaparin", "hold anticoagulation").',
    '5. Prefer one task per distinct documented action. Merge obvious duplicates.',
    '6. Set origin to "extracted" and status to "proposed" on every task. Fill "timing" (e.g. "today", "daily", "in the morning", "routine") and a short "reason" when the note gives one.',
    '7. BREVITY: each task "title" must be CONCISE and IMPERATIVE — <= ~6 words, e.g. "Send Troponin I", "Obtain 12-lead ECG", "Order Chest X-Ray", "Order COVID PCR", "Order FBC and U&Es". No sentences, no trailing rationale in the title. Keep "reason" to a short phrase (not a sentence) — e.g. Troponin I reason "chest pain".',
    '8. Respond ONLY by calling the emit_tasks tool. Do not write any prose.',
  ].join('\n');
}

export function buildExtractUser(encounter: Encounter, ctx: PatientContext): string {
  const parts: string[] = [];
  parts.push(`PATIENT ID: ${ctx.patientId}`);
  if (ctx.name) parts.push(`PATIENT: ${ctx.name}${ctx.ageSex ? ` (${ctx.ageSex})` : ''}`);
  parts.push(`ENCOUNTER ID: ${encounter.id}`);
  if (encounter.visitTitle) parts.push(`VISIT: ${encounter.visitTitle}`);
  parts.push('');
  parts.push('=== ASSESSMENT (verbatim) ===');
  parts.push(encounter.assessment || '(none)');
  parts.push('');
  parts.push('=== PLAN / ASSESSMENT & PLAN (verbatim — the primary source of action items) ===');
  parts.push(encounter.planText || '(none)');

  if (ctx.transcriptExcerpts?.length) {
    parts.push('');
    parts.push('=== TRANSCRIPT EXCERPTS (verbatim) ===');
    parts.push(ctx.transcriptExcerpts.join('\n'));
  }
  if (ctx.conditionLabels?.length) {
    parts.push('');
    parts.push('=== ACTIVE CONDITION LABELS (context only — do not create diagnosis tasks) ===');
    parts.push(ctx.conditionLabels.join('; '));
  }
  if (ctx.medicationLabels?.length) {
    parts.push('');
    parts.push('=== ACTIVE MEDICATION LABELS (context) ===');
    parts.push(ctx.medicationLabels.join('; '));
  }
  if (ctx.keyObservations?.length) {
    parts.push('');
    parts.push('=== KEY OBSERVATIONS (context) ===');
    parts.push(
      ctx.keyObservations
        .map((o) => `${o.name}: ${o.value}${o.unit ? ' ' + o.unit : ''}${o.time ? ' @ ' + o.time : ''}`)
        .join('\n'),
    );
  }
  parts.push('');
  parts.push(
    'Extract every documented follow-up action. Each task needs a verbatim evidence excerpt copied exactly from the ASSESSMENT, PLAN, or TRANSCRIPT text above. Call emit_tasks now.',
  );
  return parts.join('\n');
}
