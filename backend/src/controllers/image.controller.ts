/**
 * Image Controller
 *
 * POST /api/scan-image  — Accepts an image upload, calls qwen2.5-vl,
 *                         returns a structured NFASchema + conversion metadata.
 *
 * POST /api/convert     — Accepts an NFASchema + target type ('nfa' | 'dfa'),
 *                         returns the converted automaton.
 */

import { Request, Response } from 'express';
import { extractAutomatonFromImage } from '../services/vision.service';
import {
  flatTransitionsToNFASchema,
  normaliseEpsilon,
  hasEpsilonTransitions,
  enfaToNfa,
  enfaToDfa,
} from '../core/dfa-nfa/enfa-converter';
import { NFASchema, AutomatonType } from '../interfaces/schema.interface';

// ─── POST /api/scan-image ─────────────────────────────────────────────────────

export async function scanImage(req: Request, res: Response): Promise<void> {
  try {
    // multer stores the file as req.file
    if (!req.file) {
      res.status(400).json({ error: 'No image file provided. Send a multipart/form-data request with field "image".' });
      return;
    }

    // Convert buffer → base64 for the Ollama vision API
    const base64Image = req.file.buffer.toString('base64');
    console.log(`[Image] Received ${req.file.originalname} (${(req.file.size / 1024).toFixed(1)} KB)`);

    // Call qwen2.5-vl
    const rawAutomaton = await extractAutomatonFromImage(base64Image);

    // Normalise epsilon labels ('eps', 'epsilon', 'λ' → '') and detect ε-transitions
    let hasEpsilon = false;
    const normalisedTransitions = rawAutomaton.transitions.map(t => {
      const sym = normaliseEpsilon(t.label);
      if (sym === '') hasEpsilon = true;
      return { ...t, label: sym };
    });

    // Build NFASchema (supports ε-transitions natively via '' key)
    const nfaSchema: NFASchema = flatTransitionsToNFASchema({
      ...rawAutomaton,
      transitions: normalisedTransitions,
    });

    // Verify ε flag against actual transition map
    hasEpsilon = hasEpsilon || hasEpsilonTransitions(nfaSchema);

    console.log(`[Image] Extracted: ${nfaSchema.states.length} states, ${rawAutomaton.transitions.length} transitions, hasEpsilon=${hasEpsilon}`);

    res.json({
      automaton:  nfaSchema,
      hasEpsilon,
      raw:        rawAutomaton,
    });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Image] scanImage error:', msg);
    res.status(500).json({ error: msg });
  }
}

// ─── POST /api/convert ────────────────────────────────────────────────────────

export async function convertAutomaton(req: Request, res: Response): Promise<void> {
  try {
    const { automaton, target } = req.body as {
      automaton: NFASchema;
      target:    'nfa' | 'dfa';
    };

    if (!automaton || !target) {
      res.status(400).json({ error: 'Request must include "automaton" (NFASchema) and "target" ("nfa" | "dfa").' });
      return;
    }

    if (!['nfa', 'dfa'].includes(target)) {
      res.status(400).json({ error: `Unknown target "${target}". Use "nfa" or "dfa".` });
      return;
    }

    // Ensure type is set
    const nfa: NFASchema = { ...automaton, type: AutomatonType.NFA };

    let result;
    if (target === 'nfa') {
      result = enfaToNfa(nfa);
      console.log(`[Convert] ε-NFA → NFA: ${nfa.states.length} → ${result.states.length} states`);
    } else {
      result = enfaToDfa(nfa);
      console.log(`[Convert] ε-NFA → DFA: ${nfa.states.length} → ${result.states.length} states`);
    }

    res.json({ automaton: result });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    console.error('[Convert] convertAutomaton error:', msg);
    res.status(500).json({ error: msg });
  }
}
