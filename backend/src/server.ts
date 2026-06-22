import express from 'express';
import cors    from 'cors';
import * as dotenv from 'dotenv';
import automataRoutes from './routes/automata.routes';

dotenv.config();

const app  = express();
const PORT = parseInt(process.env.PORT ?? '3001', 10);

// ─── Middleware ───────────────────────────────────────────────────────────────
app.use(cors({ origin: ['http://localhost:5173', 'http://127.0.0.1:5173'] }));
app.use(express.json({ limit: '2mb' }));

// 5-minute timeout for AI generation requests (model runs split CPU/GPU)
app.use((req, res, next) => {
  // Only extend timeout for the generate endpoint
  if (req.path === '/generate') {
    res.setTimeout(300_000, () => {
      res.status(503).json({ error: 'AI generation timed out after 5 minutes. Try a shorter prompt.' });
    });
  }
  next();
});

// ─── Routes ───────────────────────────────────────────────────────────────────
app.use('/api', automataRoutes);

// ─── 404 handler ─────────────────────────────────────────────────────────────
app.use((_req, res) => {
  res.status(404).json({ error: 'Not found' });
});

// ─── Global error handler ─────────────────────────────────────────────────────
app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error('[Server Error]', err);
  res.status(500).json({ error: err.message });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`\n🚀 Automata Backend running at http://localhost:${PORT}`);
  console.log(`   Health: http://localhost:${PORT}/api/health\n`);
});

