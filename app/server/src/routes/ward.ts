// GET /api/ward — the ward roster + counts (CONTRACTS §2 #1).
import type { Express, Request, Response } from 'express';
import { loadWard } from '../store/data.js';

export function registerWardRoutes(app: Express): void {
  app.get('/api/ward', (_req: Request, res: Response) => {
    try {
      res.json(loadWard());
    } catch (e) {
      res.status(500).json({ error: (e as Error).message });
    }
  });
}
