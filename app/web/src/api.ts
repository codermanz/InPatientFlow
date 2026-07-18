// Typed API client — one function per CONTRACTS.md §2 endpoint.
// Each call tries the real /api (Vite proxies to :8787) and transparently
// falls back to ./fixtures on failure, so the app is fully demoable with no
// backend and automatically uses the backend when present.
//
// Force fixtures with VITE_USE_FIXTURES=1 (build-time or runtime env).
import type {
  WardSummary,
  Patient,
  Encounter,
  Task,
  TaskStatus,
  ResultEvent,
  Suggestion,
  TimelineEvent,
  Notification,
  WorkflowDef,
  WorkflowRun,
} from './types';
import * as fx from './fixtures';

// --- Auxiliary request/response shapes from §2 (not entities) ---
export interface TaskDecision {
  taskId: string;
  action: 'approve' | 'reject';
  edits?: Partial<Task>;
}
export interface Execution {
  total: number;
  done: number;
  tasks: { id: string; title: string; status: TaskStatus }[];
}
export interface ActivitySummary {
  completedQuietly: number;
  needsAttention: number;
  resultPending: number;
}
// POST /api/workflows/:runId/complete — closed loop: the scripted recheck
// result + the agent's brief re-assessment (a Suggestion) + the updated timeline.
export interface WorkflowCompletion {
  run: WorkflowRun;
  reassessment: Suggestion;
  timeline: TimelineEvent[];
}

const BASE = '/api';

// Force fixtures via env (VITE_USE_FIXTURES=1). Vite exposes import.meta.env.
export const USE_FIXTURES =
  String(import.meta.env.VITE_USE_FIXTURES ?? '') === '1' ||
  String(import.meta.env.VITE_USE_FIXTURES ?? '').toLowerCase() === 'true';

async function req<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: string };
      if (body?.error) message = body.error;
    } catch {
      /* non-JSON error body */
    }
    throw new Error(message);
  }
  return res.json() as Promise<T>;
}

/**
 * Try the real endpoint; on any failure (or when fixtures are forced) resolve
 * with the fixture value. Keeps the demo bulletproof offline while letting the
 * backend take over the moment it is reachable.
 *
 * `valid` lets a caller reject a *reachable but wrong-shaped* response (e.g. a
 * stale v1 backend that still returns the old Maria/potassium scenario) and
 * fall back to the correct v2 fixture, so the demo never shows the wrong data.
 */
async function withFallback<T>(
  real: () => Promise<T>,
  fixture: T,
  valid?: (v: T) => boolean,
): Promise<T> {
  if (USE_FIXTURES) return fixture;
  try {
    const v = await real();
    if (valid && !valid(v)) return fixture;
    return v;
  } catch {
    return fixture;
  }
}

// 1. GET /api/ward — reject a stale (v1) ward that lacks hospital numbers.
export const getWard = () =>
  withFallback<WardSummary>(
    () => req('/ward'),
    fx.ward,
    (w) => Boolean(w?.patients?.[0]?.hospitalNo) && w?.ward === 'Ward 7A',
  );

// 2. GET /api/patients/:id
// Offline fallback: hero → full detail; any other roster patient → a minimal
// honest detail derived from the ward fixture (so we never show Maria's data
// for James/John/etc. when the backend is down).
export const getPatient = (id: string) =>
  withFallback<{ patient: Patient; encounter: Encounter; tasks: Task[] }>(
    () => req(`/patients/${id}`),
    fx.patientDetailFor(id),
    (d) => Boolean(d?.patient?.hospitalNo),
  );

// 3. POST /api/patients/:id/extract-tasks  (REAL Claude, cached)
export const extractTasks = (id: string) =>
  withFallback<{ tasks: Task[] }>(
    () => req(`/patients/${id}/extract-tasks`, { method: 'POST' }),
    { tasks: fx.patientDetail.tasks },
  );

// 14. POST /api/patients/:id/recommend  (REAL Claude ReAct, cached)
// Proactive recommendation powering screen 4. Falls back to the bundled
// agentRecommendation fixture so the screen still renders with no backend.
export const recommend = (id: string, concern?: string) =>
  withFallback<{ suggestion: Suggestion }>(
    () =>
      req(`/patients/${id}/recommend`, {
        method: 'POST',
        body: JSON.stringify(concern ? { concern } : {}),
      }),
    { suggestion: fx.suggestion },
  );

// 4. POST /api/patients/:id/tasks/confirm
export const confirmTasks = (id: string, decisions: TaskDecision[]) =>
  withFallback<{ tasks: Task[] }>(
    () =>
      req(`/patients/${id}/tasks/confirm`, {
        method: 'POST',
        body: JSON.stringify({ decisions }),
      }),
    {
      tasks: fx.patientDetail.tasks.map((t) => ({
        ...t,
        status: decisions.find((d) => d.taskId === t.id)?.action === 'reject'
          ? ('rejected' as TaskStatus)
          : ('approved' as TaskStatus),
      })),
    },
  );

// 5. POST /api/patients/:id/execute
export const executeTasks = (id: string) =>
  withFallback<{ execution: Execution }>(
    () => req(`/patients/${id}/execute`, { method: 'POST' }),
    { execution: fx.execution },
  );

// 6. GET /api/patients/:id/execution
export const getExecution = (id: string) =>
  withFallback<{ execution: Execution }>(
    () => req(`/patients/${id}/execution`),
    { execution: fx.execution },
  );

// 7. GET /api/notifications  (UI polls ~1s)
export const getNotifications = () =>
  withFallback<{ notifications: Notification[] }>(
    () => req('/notifications'),
    { notifications: [fx.notification] },
  );

// 8. POST /api/sim/advance
export const simAdvance = (patientId?: string) =>
  withFallback<{ ok: true; resultEventId: string }>(
    () =>
      req('/sim/advance', {
        method: 'POST',
        body: JSON.stringify({ patientId }),
      }),
    { ok: true, resultEventId: fx.RESULT_ID },
  );

// 9. GET /api/results/:id
export const getResult = (id: string) =>
  withFallback<{ result: ResultEvent; task: Task; patient: Patient }>(
    () => req(`/results/${id}`),
    fx.resultDetail,
  );

// 10. POST /api/results/:id/suggest  (REAL Claude, cached)
export const suggestNextSteps = (id: string) =>
  withFallback<{ suggestion: Suggestion }>(
    () => req(`/results/${id}/suggest`, { method: 'POST' }),
    { suggestion: fx.suggestion },
  );

// 11. POST /api/results/:id/act
export const actOnResult = (id: string, actionIds: string[]) =>
  withFallback<{ timeline: TimelineEvent[] }>(
    () =>
      req(`/results/${id}/act`, {
        method: 'POST',
        body: JSON.stringify({ actionIds }),
      }),
    { timeline: fx.timeline },
  );

// 12. GET /api/patients/:id/timeline  (v2 adds actionsTaken[])
export const getTimeline = (id: string) =>
  withFallback<{ timeline: TimelineEvent[]; actionsTaken?: string[] }>(
    () => req(`/patients/${id}/timeline`),
    { timeline: fx.timeline, actionsTaken: fx.actionsTaken },
  );

// 13. GET /api/activity
export const getActivity = () =>
  withFallback<ActivitySummary>(() => req('/activity'), fx.activity);

// 15. GET /api/workflows
export const getWorkflows = () =>
  withFallback<{ workflows: WorkflowDef[] }>(
    () => req('/workflows'),
    { workflows: fx.workflows },
  );

// 16. POST /api/workflows/run
export const runWorkflow = (body: {
  workflowId: string;
  actionId?: string;
  patientId: string;
}) =>
  withFallback<{ run: WorkflowRun }>(
    () => req('/workflows/run', { method: 'POST', body: JSON.stringify(body) }),
    { run: fx.makeWorkflowRun(body.workflowId, body.actionId, body.patientId) },
  );

// 17. GET /api/patients/:id/workflow-runs
export const getWorkflowRuns = (patientId: string) =>
  withFallback<{ runs: WorkflowRun[] }>(
    () => req(`/patients/${patientId}/workflow-runs`),
    { runs: [] },
  );

// POST /api/workflows/:runId/complete — closed loop
export const completeWorkflow = (runId: string) =>
  withFallback<WorkflowCompletion>(
    () => req(`/workflows/${runId}/complete`, { method: 'POST' }),
    fx.workflowCompletion(runId),
  );
