// GET /api/activity — the ward activity summary (CONTRACTS §2 #13).
import type { Express, Request, Response } from 'express';
import * as state from '../store/state.js';

export function registerActivityRoutes(app: Express): void {
  app.get('/api/activity', (_req: Request, res: Response) => {
    res.json(state.getActivity());
  });
}
