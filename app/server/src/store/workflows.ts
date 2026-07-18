// Workflow catalog loader + keyword mapper (CONTRACTS §2 note / §3.4).
// Loads the 6 pre-defined stubbed workflows from app/data/workflows.json and
// provides a backend fallback that maps a free-text action title to a
// WorkflowDef.id when the model omits/returns an invalid workflowId.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { WorkflowDef } from '../types.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
// app/server/src/store -> repo root -> app/data
const DATA_DIR = path.resolve(__dirname, '../../../..', 'app', 'data');

let _cache: WorkflowDef[] | null = null;

/** Load the workflow catalog (cached after first read). */
export function loadWorkflows(): WorkflowDef[] {
  if (_cache) return _cache;
  const full = path.join(DATA_DIR, 'workflows.json');
  _cache = JSON.parse(fs.readFileSync(full, 'utf8')) as WorkflowDef[];
  return _cache;
}

/** Look up a single workflow by id, or undefined. */
export function getWorkflow(id: string): WorkflowDef | undefined {
  return loadWorkflows().find((w) => w.id === id);
}

/** True if the id is a valid catalog workflow. */
export function isWorkflowId(id: string | undefined | null): id is string {
  return typeof id === 'string' && loadWorkflows().some((w) => w.id === id);
}

/** Short display label for a workflow id (its name), or '' if unknown. */
export function workflowLabel(id: string): string {
  return getWorkflow(id)?.name ?? '';
}

// Ordered keyword rules (most specific first). The FIRST rule whose regex hits
// the action title wins; falls through to 'reassess-recheck'.
const RULES: { id: string; re: RegExp }[] = [
  { id: 'ecg', re: /\b(ecg|ekg|electrocardiogram|12[- ]?lead)\b/i },
  { id: 'medication-administer', re: /\b(aspirin|enoxaparin|clopidogrel|ticagrelor|heparin|loading dose|administer|prescrib|give|analgesi|gtn|nitrate|anticoagulat)\b/i },
  { id: 'cardiac-monitoring', re: /\b(telemetr|cardiac monitor|continuous.*monitor|monitoring)\b/i },
  { id: 'specialty-consult', re: /\b(consult|cardiology|referral|refer\b|specialist|review)\b/i },
  { id: 'order-lab', re: /\b(order|panel|troponin|lab|draw|bloods?|fbc|u&es|covid|pcr|x-?ray|repeat)\b/i },
  { id: 'reassess-recheck', re: /\b(reassess|re-?evaluat|recheck|re-?check|escalat|follow.?up)\b/i },
];

/**
 * mapActionToWorkflow(title) — backend fallback that maps a free-text action
 * title to a WorkflowDef.id. Defaults to 'reassess-recheck' if nothing matches.
 */
export function mapActionToWorkflow(title: string): string {
  const t = (title || '').toLowerCase();
  for (const r of RULES) {
    if (r.re.test(t)) return r.id;
  }
  return 'reassess-recheck';
}
