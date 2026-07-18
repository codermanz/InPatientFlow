import { fileURLToPath } from 'node:url';
import path from 'node:path';
import dotenv from 'dotenv';
import express from 'express';
import cors from 'cors';
import { registerRoutes } from './routes/index.js';

// Load the repo-root .env (three levels up from app/server/src/).
const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../../../.env') });

const app = express();
app.use(cors());
app.use(express.json());

// Health check — proves the server boots.
app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'wardflow-server' });
});

// --- Route registrars (all 13 REST endpoints, CONTRACTS.md §2) ---
registerRoutes(app);

const PORT = Number(process.env.PORT) || 8787;
app.listen(PORT, () => {
  console.log(`[wardflow-server] listening on http://localhost:${PORT}`);
});

export { app };
