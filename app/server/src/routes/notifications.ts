// GET /api/notifications — queued notifications the UI polls (CONTRACTS §2 #7).
import type { Express, Request, Response } from 'express';
import * as state from '../store/state.js';

export function registerNotificationRoutes(app: Express): void {
  app.get('/api/notifications', (_req: Request, res: Response) => {
    res.json({ notifications: state.getNotifications() });
  });
}
