// Route registrar — wires every resource group onto the Express app.
import type { Express } from 'express';
import { registerWardRoutes } from './ward.js';
import { registerPatientRoutes } from './patients.js';
import { registerNotificationRoutes } from './notifications.js';
import { registerSimRoutes } from './sim.js';
import { registerResultRoutes } from './results.js';
import { registerActivityRoutes } from './activity.js';
import { registerWorkflowRoutes } from './workflows.js';

export function registerRoutes(app: Express): void {
  registerWardRoutes(app);
  registerPatientRoutes(app);
  registerNotificationRoutes(app);
  registerSimRoutes(app);
  registerResultRoutes(app);
  registerActivityRoutes(app);
  registerWorkflowRoutes(app);
}
