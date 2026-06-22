import { OpenAIVisionClient } from '../config/ai.config';

export interface ImageAutomatonJSON {
  states: string[];
  alphabet: string[];
  transitions: {
    from: string;
    to: string;
    label: string;
  }[];
  start_state: string;
  final_states: string[];
}

// ─── Singleton Vision Client ──────────────────────────────────────────────────
const visionClient = new OpenAIVisionClient();

// ─── Output Parser ────────────────────────────────────────────────────────────

/**
 * Parse GPT-4o structured plain-text output into ImageAutomatonJSON.
 *
 * Expected output format:
 *   STATES: q0, q1, q2
 *   START: q0
 *   FINALS: q2
 *   ALPHABET: a, b, eps
 *   TRANSITIONS:
 *   q0-a->q1
 *   q1-b->q2
 *   q2-a->q2
 */
function parseStructuredOutput(text: string): ImageAutomatonJSON {
  // ── Extract transitions (most reliable signal) ────────────────────────────
  const transitions: { from: string; to: string; label: string }[] = [];

  // Pattern: FROM-LABEL->TO  (e.g. q0-a->q1, q1-eps->q2)
  const p1 = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s*-([^->\s,]{1,8})->\s*([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
  let m: RegExpExecArray | null;
  while ((m = p1.exec(text)) !== null) {
    transitions.push({ from: m[1], to: m[3], label: m[2] });
  }
  // Arrow style: FROM --label--> TO
  if (transitions.length === 0) {
    const p2 = /\b([a-zA-Z_][a-zA-Z0-9_]*)\s+--([^-\s]+)-->\s+([a-zA-Z_][a-zA-Z0-9_]*)\b/g;
    while ((m = p2.exec(text)) !== null) {
      transitions.push({ from: m[1], to: m[3], label: m[2].trim() });
    }
  }

  // ── Derive state set from transitions ─────────────────────────────────────
  const stateSet = new Set<string>();
  for (const t of transitions) { stateSet.add(t.from); stateSet.add(t.to); }

  const isState = (s: string) => stateSet.size === 0 || stateSet.has(s);

  const extractField = (key: string): string => {
    const regex = new RegExp(`(?:^|\\s)${key}\\s*:?\\s*([^\\n]{1,120})`, 'im');
    const match = text.match(regex);
    return match ? match[1].trim() : '';
  };
  const extractList = (key: string): string[] =>
    extractField(key).split(/[,;]+/).map(s => s.trim()).filter(s => s.length > 0 && s.length < 20);

  // States
  let states = extractList('STATES').filter(isState);
  if (states.length === 0) states = [...stateSet];

  // Alphabet
  let alphabet = extractList('ALPHABET').filter(s => s.length <= 5);
  if (alphabet.length === 0) {
    alphabet = [...new Set(transitions.map(t => t.label))];
  }

  // Start state
  let start_state = '';
  const startCandidate = extractField('START').split(/[\s,]/)[0] ?? '';
  if (isState(startCandidate)) start_state = startCandidate;
  if (!start_state && states.length > 0) start_state = states[0];

  // Final states
  let final_states = extractList('FINALS').filter(isState);
  if (final_states.length === 0) {
    const fm = [...text.matchAll(/([a-zA-Z_][a-zA-Z0-9_]*)\s+(?:is\s+(?:a\s+)?(?:final|accept|accepting)|has\s+a?\s+double\s+circle)/gi)];
    for (const match of fm) { if (isState(match[1])) final_states.push(match[1]); }
  }

  return { states, alphabet, transitions, start_state, final_states };
}

// ─── Public API ───────────────────────────────────────────────────────────────

export async function extractAutomatonFromImage(
  base64Image: string,
  mimeType = 'image/png',
): Promise<ImageAutomatonJSON> {
  // Strip data URL prefix if present
  const cleanBase64 = base64Image.replace(/^data:image\/\w+;base64,/, '');
  // Detect MIME type from data URL if available
  const mimeMatch = base64Image.match(/^data:(image\/\w+);base64,/);
  const resolvedMime = mimeMatch ? mimeMatch[1] : mimeType;

  console.log(`[Vision] Sending image to GPT-4o (base64 length: ${cleanBase64.length})...`);

  const rawText = await visionClient.extractFromImage(cleanBase64, resolvedMime);

  const parsed = parseStructuredOutput(rawText);

  if (!parsed.states || parsed.states.length === 0) {
    console.error('[Vision] Parsed result has no states. Raw:\n', rawText.slice(0, 400));
    throw new Error('Could not extract automaton states from the image. Try a cleaner diagram.');
  }

  console.log(
    `[Vision] Parsed: ${parsed.states.length} states, ` +
    `${parsed.transitions.length} transitions, ` +
    `start="${parsed.start_state}", finals=[${parsed.final_states}]`,
  );
  return parsed;
}
