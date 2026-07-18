// Runtime state — the in-memory demo state machine (TECH_DESIGN §7c).
// Seeded from the authored data files at boot; mutated as the operator drives
// the flow (extract → confirm → execute → scripted return → act). Everything
// lives in memory so a server restart is a clean demo rerun; reset() does the
// same without a restart.
import type {
  Task,
  TaskStatus,
  ResultEvent,
  Notification,
  TimelineEvent,
  Suggestion,
  WorkflowRun,
} from '../types.js';
import { loadScripted } from './data.js';
import { getWorkflow } from './workflows.js';

const HERO_ID = 'pt-1234567';

export interface Execution {
  total: number;
  done: number;
  tasks: { id: string; title: string; status: TaskStatus }[];
}

interface PatientRuntime {
  tasks: Task[];
  execution: Execution | null;
}

interface Runtime {
  patients: Map<string, PatientRuntime>;
  notifications: Notification[];
  results: Map<string, ResultEvent>;
  suggestions: Map<string, Suggestion>;
  timelineExtra: Map<string, TimelineEvent[]>;
  workflowRuns: Map<string, WorkflowRun[]>;
  reviewedResults: Set<string>;
  firedReturns: Set<string>;
  timers: Map<string, ReturnType<typeof setTimeout>>;
  activity: { completedQuietly: number; needsAttention: number; resultPending: number };
}

function freshActivity(): Runtime['activity'] {
  try {
    return { ...loadScripted().activity };
  } catch {
    return { completedQuietly: 0, needsAttention: 0, resultPending: 0 };
  }
}

function freshRuntime(): Runtime {
  return {
    patients: new Map(),
    notifications: [],
    results: new Map(),
    suggestions: new Map(),
    timelineExtra: new Map(),
    workflowRuns: new Map(),
    reviewedResults: new Set(),
    firedReturns: new Set(),
    timers: new Map(),
    activity: freshActivity(),
  };
}

let rt: Runtime = freshRuntime();

function patientRuntime(patientId: string): PatientRuntime {
  let p = rt.patients.get(patientId);
  if (!p) {
    p = { tasks: [], execution: null };
    rt.patients.set(patientId, p);
  }
  return p;
}

// ---- Tasks ---------------------------------------------------------------
export function getTasks(patientId: string): Task[] {
  return patientRuntime(patientId).tasks;
}
export function setTasks(patientId: string, tasks: Task[]): Task[] {
  patientRuntime(patientId).tasks = tasks;
  return tasks;
}

// ---- Execution -----------------------------------------------------------
export function getExecution(patientId: string): Execution | null {
  return patientRuntime(patientId).execution;
}
export function setExecution(patientId: string, execution: Execution): Execution {
  patientRuntime(patientId).execution = execution;
  return execution;
}

// ---- Notifications -------------------------------------------------------
export function getNotifications(): Notification[] {
  return rt.notifications;
}
export function addNotification(n: Notification): void {
  if (!rt.notifications.some((x) => x.id === n.id)) rt.notifications.push(n);
}

// ---- Results & suggestions ----------------------------------------------
export function getResult(id: string): ResultEvent | undefined {
  return rt.results.get(id);
}
export function setResult(r: ResultEvent): void {
  rt.results.set(r.id, r);
}
export function setSuggestion(resultId: string, s: Suggestion): void {
  rt.suggestions.set(resultId, s);
}
export function getSuggestion(resultId: string): Suggestion | undefined {
  return rt.suggestions.get(resultId);
}

// ---- Timeline ------------------------------------------------------------
export function getTimelineExtra(patientId: string): TimelineEvent[] {
  return rt.timelineExtra.get(patientId) ?? [];
}
export function addTimelineEvents(patientId: string, events: TimelineEvent[]): void {
  const list = rt.timelineExtra.get(patientId) ?? [];
  list.push(...events);
  rt.timelineExtra.set(patientId, list);
}

// ---- Workflow runs -------------------------------------------------------
export function getWorkflowRuns(patientId: string): WorkflowRun[] {
  return rt.workflowRuns.get(patientId) ?? [];
}

/** Find a workflow run by its runId across all patients. */
export function getWorkflowRun(runId: string): WorkflowRun | undefined {
  for (const list of rt.workflowRuns.values()) {
    const run = list.find((r) => r.runId === runId);
    if (run) return run;
  }
  return undefined;
}

/** Mutate a run's status in place; returns the run or undefined. */
export function setWorkflowRunStatus(
  runId: string,
  status: WorkflowRun['status'],
): WorkflowRun | undefined {
  const run = getWorkflowRun(runId);
  if (run) run.status = status;
  return run;
}

/**
 * Create + store a stubbed WorkflowRun for a patient (status 'triggered') and
 * append a matching `workflow`-type TimelineEvent ("Workflow triggered: <name>").
 * Returns the created run. Caller is expected to have validated the workflowId.
 */
export function addWorkflowRun(
  patientId: string,
  workflowId: string,
  actionId?: string,
): WorkflowRun {
  const wf = getWorkflow(workflowId);
  const label = wf?.name ?? workflowId;
  const now = new Date().toISOString();
  const runId = `wfr-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  const run: WorkflowRun = {
    runId,
    workflowId,
    label,
    status: 'triggered',
    triggeredAt: now,
    ...(actionId ? { actionId } : {}),
    patientId,
  };
  const list = rt.workflowRuns.get(patientId) ?? [];
  list.push(run);
  rt.workflowRuns.set(patientId, list);

  addTimelineEvents(patientId, [
    {
      id: `tl-wf-${runId}`,
      patientId,
      ts: now,
      label: `Workflow triggered: ${label}`,
      type: 'workflow',
    },
  ]);
  return run;
}

// ---- Review flags --------------------------------------------------------
export function markReviewed(resultId: string): void {
  rt.reviewedResults.add(resultId);
}
export function isReviewed(resultId: string): boolean {
  return rt.reviewedResults.has(resultId);
}

// ---- Activity ------------------------------------------------------------
export function getActivity(): Runtime['activity'] {
  return rt.activity;
}
export function setActivity(a: Partial<Runtime['activity']>): void {
  rt.activity = { ...rt.activity, ...a };
}

// ---- Timers --------------------------------------------------------------
export function armTimer(patientId: string, ms: number, fn: () => void): void {
  clearTimerFor(patientId);
  const t = setTimeout(() => {
    rt.timers.delete(patientId);
    fn();
  }, ms);
  // Don't keep the event loop alive solely for the demo timer.
  if (typeof t.unref === 'function') t.unref();
  rt.timers.set(patientId, t);
}
export function clearTimerFor(patientId: string): void {
  const t = rt.timers.get(patientId);
  if (t) {
    clearTimeout(t);
    rt.timers.delete(patientId);
  }
}

/**
 * Fire the scripted result-return + notification for a patient. Idempotent:
 * calling it twice (timer + operator override) returns the same ResultEvent.
 *
 * The scripted result (Troponin I) is linked to the extracted task by TITLE,
 * not literal id (Data agent flag): we find the extracted task whose title
 * mentions troponin, set the result's taskId to that real id, and mark that
 * task 'returned'.
 */
export function fireScriptedReturn(patientId: string): ResultEvent | null {
  const scripted = loadScripted();
  if (scripted.resultEvent.patientId !== patientId) return null;

  if (rt.firedReturns.has(patientId)) {
    return rt.results.get(scripted.resultEvent.id) ?? null;
  }
  rt.firedReturns.add(patientId);
  clearTimerFor(patientId);

  const tasks = getTasks(patientId);
  const linked =
    tasks.find((t) => /troponin/i.test(t.title)) ??
    tasks.find((t) => t.category === 'requests') ??
    tasks[0];

  const result: ResultEvent = {
    ...scripted.resultEvent,
    taskId: linked?.id ?? scripted.resultEvent.taskId,
  };
  setResult(result);
  if (linked) linked.status = 'returned';

  addNotification({ ...scripted.notification });
  return result;
}

/** Full reset for a demo rerun without restarting the process. */
export function reset(): void {
  for (const t of rt.timers.values()) clearTimeout(t);
  rt = freshRuntime();
}
