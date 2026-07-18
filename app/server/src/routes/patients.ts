// Patient routes (CONTRACTS §2 #2-6, #12):
//   GET  /api/patients/:id
//   POST /api/patients/:id/extract-tasks   (REAL Claude, cached)
//   POST /api/patients/:id/tasks/confirm
//   POST /api/patients/:id/execute         (arms the scripted-return timer)
//   GET  /api/patients/:id/execution
//   GET  /api/patients/:id/timeline
import type { Express, Request, Response } from 'express';
import type { Task, TaskStatus } from '../types.js';
import { extractTasks } from '../intel/extract.js';
import { mapActionToWorkflow, workflowLabel } from '../store/workflows.js';
import { recommendProactive } from '../intel/suggest.js';
import { loadScripted } from '../store/data.js';
import { HERO_CONCERN } from '../store/extractInputs.js';
import { storeChartProvider } from '../store/chartProvider.js';
import {
  resolvePatient,
  resolveDisplayEncounter,
  buildExtractInputs,
  isHero,
} from './_shared.js';
import * as state from '../store/state.js';

interface TaskDecision {
  taskId: string;
  action: 'approve' | 'reject';
  edits?: Partial<Task>;
}

const DEMO_DELAY_MS = Number(process.env.DEMO_DELAY_MS) || 10000;

export function registerPatientRoutes(app: Express): void {
  // 2. GET /api/patients/:id
  app.get('/api/patients/:id', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const patient = resolvePatient(id);
    const encounter = resolveDisplayEncounter(id);
    if (!patient || !encounter) {
      res.status(404).json({ error: `Unknown patient '${id}'` });
      return;
    }
    res.json({ patient, encounter, tasks: state.getTasks(id) });
  });

  // 3. POST /api/patients/:id/extract-tasks — REAL Claude (cached)
  app.post('/api/patients/:id/extract-tasks', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const inputs = buildExtractInputs(id);
    if (!inputs) {
      res.status(404).json({ error: `Unknown patient '${id}'` });
      return;
    }
    try {
      const tasks = await extractTasks(inputs.encounter, inputs.patientContext);
      // Persist into runtime state with mock-matching status chips: the ECG is
      // 'chased' (awaiting an overdue result), everything else 'requested'.
      const persisted = tasks.map((t) => {
        // Correlate each agent-formulated task to a workflow (symptom → workflow).
        const wfId = t.workflowId ?? mapActionToWorkflow(t.title);
        return {
          ...t,
          workflowId: wfId,
          workflowLabel: t.workflowLabel ?? workflowLabel(wfId),
          status: (/\b(ecg|ekg|electrocardiogram|12[- ]?lead)\b/i.test(t.title)
            ? 'chased'
            : 'requested') as TaskStatus,
        };
      });
      state.setTasks(id, persisted);
      res.json({ tasks: persisted });
    } catch (e) {
      res.status(502).json({ error: `Task extraction failed: ${(e as Error).message}` });
    }
  });

  // 14. POST /api/patients/:id/recommend — REAL Claude (ReAct), cached.
  // Proactive recommendation (screen 4): seeded with a CONCERN, not a result.
  app.post('/api/patients/:id/recommend', async (req: Request, res: Response) => {
    const id = String(req.params.id);
    const patient = resolvePatient(id);
    if (!patient) {
      res.status(404).json({ error: `Unknown patient '${id}'` });
      return;
    }
    const bodyConcern = typeof req.body?.concern === 'string' ? req.body.concern.trim() : '';
    const concern = bodyConcern || (isHero(id) ? HERO_CONCERN : '');
    if (!concern) {
      res.status(400).json({ error: 'A concern is required to generate a recommendation.' });
      return;
    }
    try {
      const suggestion = await recommendProactive(id, concern, storeChartProvider);
      res.json({ suggestion });
    } catch (e) {
      res.status(502).json({ error: `Recommendation failed: ${(e as Error).message}` });
    }
  });

  // 4. POST /api/patients/:id/tasks/confirm
  app.post('/api/patients/:id/tasks/confirm', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const decisions: TaskDecision[] = Array.isArray(req.body?.decisions) ? req.body.decisions : [];
    const tasks = state.getTasks(id);
    if (!tasks.length) {
      res.status(409).json({ error: 'No extracted tasks to confirm. Run extract-tasks first.' });
      return;
    }
    const byId = new Map(decisions.map((d) => [d.taskId, d]));
    const updated = tasks.map((t) => {
      const d = byId.get(t.id);
      if (!d) return t;
      const merged: Task = { ...t, ...(d.edits ?? {}), id: t.id, patientId: t.patientId };
      merged.status = d.action === 'reject' ? 'rejected' : 'approved';
      return merged;
    });
    state.setTasks(id, updated);
    res.json({ tasks: updated });
  });

  // 5. POST /api/patients/:id/execute — arms the scripted-return timer
  app.post('/api/patients/:id/execute', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const tasks = state.getTasks(id);
    const approved = tasks.filter((t) => t.status === 'approved');
    if (!approved.length) {
      res.status(409).json({ error: 'No approved tasks to execute. Confirm tasks first.' });
      return;
    }

    // Send approved tasks, but leave one 'waiting' so the run reads 2/3 like the
    // mock. Prefer leaving a specialty consult pending (it legitimately waits),
    // else the last approved task.
    const waitIdx = (() => {
      const spec = approved.findIndex((t) => t.category === 'specialty_input');
      return spec !== -1 ? spec : approved.length - 1;
    })();
    approved.forEach((t, i) => {
      t.status = i === waitIdx ? 'waiting' : 'sent';
    });
    state.setTasks(id, tasks);

    const execution = {
      total: approved.length,
      done: approved.filter((t) => t.status === 'sent').length,
      tasks: approved.map((t) => ({ id: t.id, title: t.title, status: t.status })),
    };
    state.setExecution(id, execution);

    // Arm the pseudo-timer: after DEMO_DELAY_MS the scripted result returns.
    // /api/sim/advance can fire it sooner (operator override).
    if (isHero(id) && loadScripted().resultEvent.patientId === id) {
      state.armTimer(id, DEMO_DELAY_MS, () => state.fireScriptedReturn(id));
    }

    res.json({ execution });
  });

  // 6. GET /api/patients/:id/execution
  app.get('/api/patients/:id/execution', (req: Request, res: Response) => {
    const execution = state.getExecution(String(req.params.id));
    if (!execution) {
      res.status(404).json({ error: 'No execution in progress for this patient.' });
      return;
    }
    res.json({ execution });
  });

  // 12. GET /api/patients/:id/timeline — { timeline, actionsTaken } (v2).
  app.get('/api/patients/:id/timeline', (req: Request, res: Response) => {
    const id = String(req.params.id);
    const scripted = isHero(id) ? loadScripted() : null;
    const base = scripted?.timeline ?? [];
    const extra = state.getTimelineExtra(id);
    const timeline = [...base, ...extra].sort((a, b) => (a.ts < b.ts ? -1 : a.ts > b.ts ? 1 : 0));
    res.json({ timeline, actionsTaken: scripted?.actionsTaken ?? [] });
  });
}
