// Demo data provider (v2 — troponin/ACS). Global + hero data is seeded from
// fixtures (so screens render instantly and never flicker), then hydrated from
// api.ts — which tries the real /api and falls back to fixtures. Also owns the
// mutable closed-loop state (workflow runs + the agent re-assessment) so
// screens 6/7/8 can show plan → workflow → repeat troponin → agent re-assessed.
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';
import * as api from './api';
import * as fx from './fixtures';
import type {
  WardSummary,
  Patient,
  Encounter,
  Task,
  ResultEvent,
  Suggestion,
  TimelineEvent,
  WorkflowRun,
} from './types';

interface DemoData {
  ward: WardSummary;
  patient: Patient; // hero (Hospital No. 1234567)
  encounter: Encounter;
  tasks: Task[]; // hero extracted (flat) tasks
  result: ResultEvent; // troponin result
  resultTask: Task;
  suggestion: Suggestion; // screen 6 (POST /results/:id/suggest)
  timeline: TimelineEvent[];
  actionsTaken: string[];
  activity: api.ActivitySummary;

  // ── Closed-loop / workflow state (mutable) ──────────────────────────────
  workflowRuns: WorkflowRun[];
  reassessment: Suggestion | null;
  triggerWorkflow: (
    workflowId: string,
    actionId?: string,
    patientId?: string,
  ) => Promise<WorkflowRun>;
  completeWorkflow: (runId: string) => Promise<void>;
}

const seed = {
  ward: fx.ward,
  patient: fx.patientDetail.patient,
  encounter: fx.patientDetail.encounter,
  tasks: fx.patientDetail.tasks,
  result: fx.result,
  resultTask: fx.resultDetail.task,
  suggestion: fx.suggestion,
  timeline: fx.timeline,
  actionsTaken: fx.actionsTaken,
  activity: fx.activity,
};

const Ctx = createContext<DemoData | null>(null);

export function DataProvider({ children }: { children: ReactNode }) {
  const [data, setData] = useState(seed);
  const [workflowRuns, setWorkflowRuns] = useState<WorkflowRun[]>([]);
  const [reassessment, setReassessment] = useState<Suggestion | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const [ward, patient, heroTasks, result, suggestionRes, timelineRes, activity] =
        await Promise.all([
          api.getWard(),
          api.getPatient(fx.HERO_ID),
          api.extractTasks(fx.HERO_ID),
          api.getResult(fx.RESULT_ID),
          api.suggestNextSteps(fx.RESULT_ID),
          api.getTimeline(fx.HERO_ID),
          api.getActivity(),
        ]);
      if (!alive) return;
      setData((d) => ({
        ...d,
        ward,
        patient: patient.patient,
        encounter: patient.encounter,
        tasks: heroTasks.tasks?.length ? heroTasks.tasks : d.tasks,
        result: result.result,
        resultTask: result.task,
        suggestion: suggestionRes.suggestion,
        timeline: timelineRes.timeline,
        actionsTaken: timelineRes.actionsTaken?.length ? timelineRes.actionsTaken : d.actionsTaken,
        activity,
      }));
    })().catch(() => {
      /* fixtures already seeded; ignore */
    });
    return () => {
      alive = false;
    };
  }, []);

  const triggerWorkflow = useCallback(
    async (workflowId: string, actionId?: string, patientId = fx.HERO_ID) => {
      const { run } = await api.runWorkflow({ workflowId, actionId, patientId });
      setWorkflowRuns((r) => [...r, run]);
      return run;
    },
    [],
  );

  const completeWorkflow = useCallback(async (runId: string) => {
    const res = await api.completeWorkflow(runId);
    setReassessment(res.reassessment);
    setWorkflowRuns((r) =>
      r.map((x) => (x.runId === runId ? { ...x, status: 'completed' } : x)),
    );
    setData((d) => ({ ...d, timeline: res.timeline }));
  }, []);

  const value: DemoData = {
    ...data,
    workflowRuns,
    reassessment,
    triggerWorkflow,
    completeWorkflow,
  };

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useData() {
  const c = useContext(Ctx);
  if (!c) throw new Error('useData must be used inside DataProvider');
  return c;
}

// Per-patient detail hook — fetches GET /api/patients/:id for THAT id so every
// patient row opens its OWN detail. For the hero it also runs the real task
// extraction; non-hero patients render their own honest (empty-task) detail.
export function usePatientDetail(id: string) {
  const [detail, setDetail] = useState(() => fx.patientDetailFor(id));
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    setLoading(true);
    setDetail(fx.patientDetailFor(id));
    (async () => {
      const res = await api.getPatient(id);
      let tasks = res.tasks ?? [];
      if (id === fx.HERO_ID) {
        const ex = await api.extractTasks(id);
        if (ex.tasks?.length) tasks = ex.tasks;
      }
      if (!alive) return;
      setDetail({ patient: res.patient, encounter: res.encounter, tasks });
      setLoading(false);
    })().catch(() => {
      if (alive) setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [id]);

  return { ...detail, loading };
}
