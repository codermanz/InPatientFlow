// Workflow routes (CONTRACTS §2 #15-17):
//   GET  /api/workflows                       — the 6 pre-defined workflows
//   POST /api/workflows/run                    — trigger a (stubbed) workflow run
//   GET  /api/patients/:id/workflow-runs       — runs triggered for a patient
import type { Express, Request, Response } from 'express';
import type { TimelineEvent } from '../types.js';
import { loadWorkflows, isWorkflowId } from '../store/workflows.js';
import { loadScripted } from '../store/data.js';
import { storeChartProvider } from '../store/chartProvider.js';
import { reassessAfterRecheck } from '../intel/suggest.js';
import { resolvePatient, isHero } from './_shared.js';
import * as state from '../store/state.js';

/** Merge the scripted base timeline (hero) with the runtime extras, sorted. */
function buildTimeline(patientId: string): TimelineEvent[] {
  const base = isHero(patientId) ? loadScripted().timeline : [];
  const extra = state.getTimelineExtra(patientId);
  return [...base, ...extra].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
}

// Workflows whose completion returns a scripted recheck + agent re-assessment.
const RECHECK_WORKFLOWS = new Set(['reassess-recheck', 'order-lab']);

export function registerWorkflowRoutes(app: Express): void {
  // 15. GET /api/workflows
  app.get('/api/workflows', (_req: Request, res: Response) => {
    res.json({ workflows: loadWorkflows() });
  });

  // 16. POST /api/workflows/run { workflowId, actionId?, patientId }
  app.post('/api/workflows/run', (req: Request, res: Response) => {
    const workflowId = typeof req.body?.workflowId === 'string' ? req.body.workflowId.trim() : '';
    const patientId = typeof req.body?.patientId === 'string' ? req.body.patientId.trim() : '';
    const actionId =
      typeof req.body?.actionId === 'string' && req.body.actionId.trim()
        ? req.body.actionId.trim()
        : undefined;

    if (!patientId) {
      res.status(400).json({ error: 'patientId is required.' });
      return;
    }
    if (!isWorkflowId(workflowId)) {
      res.status(404).json({ error: `Unknown workflow '${workflowId}'` });
      return;
    }
    // Stubbed execution: create a triggered run + append a `workflow` timeline event.
    const run = state.addWorkflowRun(patientId, workflowId, actionId);
    res.json({ run });
  });

  // POST /api/workflows/:runId/complete — close the loop (CONTRACTS §3.4).
  // Marks the run completed; for a recheck/order-lab workflow it produces the
  // scripted improved recheck result and re-invokes the agent for a brief
  // re-assessment, appending monitoring timeline events.
  app.post('/api/workflows/:runId/complete', async (req: Request, res: Response) => {
    const runId = String(req.params.runId);
    const run = state.getWorkflowRun(runId);
    if (!run) {
      res.status(404).json({ error: `Unknown workflow run '${runId}'` });
      return;
    }
    const alreadyCompleted = run.status === 'completed';
    state.setWorkflowRunStatus(runId, 'completed');

    if (!RECHECK_WORKFLOWS.has(run.workflowId)) {
      res.json({ run, reassessment: null, timeline: buildTimeline(run.patientId) });
      return;
    }

    const recheck = loadScripted().recheck?.resultEvent;
    if (!recheck) {
      res.json({ run, reassessment: null, timeline: buildTimeline(run.patientId) });
      return;
    }
    state.setResult(recheck);

    try {
      const reassessment = await reassessAfterRecheck(recheck.patientId, recheck, storeChartProvider);
      state.setSuggestion(recheck.id, reassessment);
      if (!alreadyCompleted) {
        const now = new Date().toISOString();
        state.addTimelineEvents(run.patientId, [
          {
            id: `tl-recheck-${runId}`,
            patientId: run.patientId,
            ts: now,
            label: `Repeat ${recheck.name}`,
            type: 'result',
            note: `${recheck.value}${recheck.unit ? ' ' + recheck.unit : ''}`,
          },
          {
            id: `tl-reassess-${runId}`,
            patientId: run.patientId,
            ts: now,
            label: 'Agent re-assessed',
            type: 'agent',
            note: 'Continue ACS pathway',
          },
        ]);
      }
      res.json({ run, reassessment, timeline: buildTimeline(run.patientId) });
    } catch (e) {
      res.status(502).json({ error: `Re-assessment failed: ${(e as Error).message}` });
    }
  });

  // 17. GET /api/patients/:id/workflow-runs
  app.get('/api/patients/:id/workflow-runs', (req: Request, res: Response) => {
    const id = String(req.params.id);
    if (!resolvePatient(id)) {
      res.status(404).json({ error: `Unknown patient '${id}'` });
      return;
    }
    res.json({ runs: state.getWorkflowRuns(id) });
  });
}
