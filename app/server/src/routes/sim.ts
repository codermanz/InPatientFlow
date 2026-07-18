// POST /api/sim/advance — operator override that fires the scripted result +
// notification NOW instead of waiting for the timer (CONTRACTS §2 #8).
import type { Express, Request, Response } from 'express';
import { loadScripted } from '../store/data.js';
import * as state from '../store/state.js';
import { HERO_ID } from './_shared.js';

export function registerSimRoutes(app: Express): void {
  app.post('/api/sim/advance', (req: Request, res: Response) => {
    const patientId: string = req.body?.patientId || loadScripted().resultEvent.patientId || HERO_ID;
    // Clear any armed timer and fire immediately; idempotent (returns the same
    // result if already fired).
    state.clearTimerFor(patientId);
    const result = state.fireScriptedReturn(patientId);
    if (!result) {
      res.status(404).json({ error: `No scripted return available for '${patientId}'.` });
      return;
    }
    res.json({ ok: true, resultEventId: result.id });
  });
}
