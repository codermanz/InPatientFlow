// Result routes (CONTRACTS §2 #9-11):
//   GET  /api/results/:id
//   POST /api/results/:id/suggest   (REAL Claude ReAct, cached)
//   POST /api/results/:id/act
import type { Express, Request, Response } from 'express';
import type { ResultEvent, Task, TimelineEvent } from '../types.js';
import { suggestNextSteps } from '../intel/suggest.js';
import { loadScripted } from '../store/data.js';
import { storeChartProvider } from '../store/chartProvider.js';
import { resolvePatient } from './_shared.js';
import * as state from '../store/state.js';

/** Resolve a result from runtime state, falling back to the scripted fixture. */
function resolveResult(id: string): ResultEvent | null {
  const fromState = state.getResult(id);
  if (fromState) return fromState;
  const scripted = loadScripted().resultEvent;
  return scripted.id === id ? scripted : null;
}

export function registerResultRoutes(app: Express): void {
  // 9. GET /api/results/:id
  app.get('/api/results/:id', (req: Request, res: Response) => {
    const result = resolveResult(String(req.params.id));
    if (!result) {
      res.status(404).json({ error: `Unknown result '${String(req.params.id)}'` });
      return;
    }
    const task = state.getTasks(result.patientId).find((t) => t.id === result.taskId) ?? null;
    const patient = resolvePatient(result.patientId);
    res.json({ result, task, patient });
  });

  // 10. POST /api/results/:id/suggest — REAL Claude (ReAct), cached
  app.post('/api/results/:id/suggest', async (req: Request, res: Response) => {
    const result = resolveResult(String(req.params.id));
    if (!result) {
      res.status(404).json({ error: `Unknown result '${String(req.params.id)}'` });
      return;
    }
    // Use the PRISTINE scripted resultEvent for the intel call so the cache key
    // matches the warmed cache (fireScriptedReturn rewrites taskId to the real
    // extracted-task id, which would otherwise change the key).
    const scripted = loadScripted().resultEvent;
    const intelInput = scripted.id === result.id ? scripted : result;
    try {
      const suggestion = await suggestNextSteps(intelInput, result.patientId, storeChartProvider);
      state.setSuggestion(result.id, suggestion);
      res.json({ suggestion });
    } catch (e) {
      res.status(502).json({ error: `Suggestion failed: ${(e as Error).message}` });
    }
  });

  // 11. POST /api/results/:id/act
  app.post('/api/results/:id/act', (req: Request, res: Response) => {
    const result = resolveResult(String(req.params.id));
    if (!result) {
      res.status(404).json({ error: `Unknown result '${String(req.params.id)}'` });
      return;
    }
    const actionIds: string[] = Array.isArray(req.body?.actionIds) ? req.body.actionIds : [];
    const suggestion = state.getSuggestion(result.id);
    const now = new Date().toISOString();

    const events: TimelineEvent[] = actionIds.map((aid, i) => {
      const action = suggestion?.proposedActions.find((a) => a.id === aid);
      return {
        id: `tl-act-${result.id}-${i + 1}`,
        patientId: result.patientId,
        ts: now,
        label: action ? `You confirmed: ${action.title}` : 'You confirmed a follow-up action',
        type: 'agent',
      };
    });
    state.addTimelineEvents(result.patientId, events);

    // Mark the result reviewed and its originating task completed.
    state.markReviewed(result.id);
    const task: Task | undefined = state
      .getTasks(result.patientId)
      .find((t) => t.id === result.taskId);
    if (task) task.status = 'completed';

    const base = loadScripted().resultEvent.patientId === result.patientId ? loadScripted().timeline : [];
    const timeline = [...base, ...state.getTimelineExtra(result.patientId)].sort((a, b) =>
      a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0,
    );
    res.json({ timeline });
  });
}
