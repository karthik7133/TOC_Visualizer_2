import { Router }   from 'express';
import multer        from 'multer';
import { generateAutomaton, simulateAutomaton } from '../controllers/automata.controller';
import { scanImage, convertAutomaton }          from '../controllers/image.controller';

const router = Router();

// ── Image upload middleware (in-memory, 8 MB limit) ──
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 8 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/image\/(jpeg|png|gif|webp|bmp|tiff)/.test(file.mimetype)) {
      cb(null, true);
    } else {
      cb(new Error('Only image files are accepted (JPEG, PNG, WebP, GIF).'));
    }
  },
});

/** Health check */
router.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

/** Generate an automaton from any text input type */
router.post('/generate', generateAutomaton);

/** Run a full step-by-step simulation and return the trace */
router.post('/simulate', simulateAutomaton);

/** Scan an uploaded automaton diagram image → NFASchema via qwen2.5-vl */
router.post('/scan-image', upload.single('image'), scanImage);

/** Convert ε-NFA → NFA or DFA */
router.post('/convert', convertAutomaton);

export default router;
