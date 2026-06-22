import * as dotenv from 'dotenv';
import Anthropic from '@anthropic-ai/sdk';
import OpenAI from 'openai';
dotenv.config();

// ─── Clients ──────────────────────────────────────────────────────────────────
// Claude 3.5 Sonnet → NL → DFA / NFA / PDA / TM logic
// GPT-4o            → Vision (image → automaton JSON)
// ─────────────────────────────────────────────────────────────────────────────

const CLAUDE_MODEL        = process.env.CLAUDE_MODEL        ?? 'claude-3-5-sonnet-20241022';
const OPENAI_VISION_MODEL = process.env.OPENAI_VISION_MODEL ?? 'gpt-4o';

// ─── Prompts (model-agnostic, kept identical to proven versions) ──────────────

/**
 * STEP-1 PROMPT: Ask Claude ONLY for a regex.
 * Smaller, focused task → much higher accuracy than asking for full JSON.
 * The backend compiles the regex with Thompson → Subset → Hopcroft.
 */
export const REGEX_EXTRACT_PROMPT = `You are an automata theory expert.
Your ONLY job: given a natural language description of a formal language, output a JSON object with TWO fields:
  1. "regex": the correct regular expression for the language
  2. "alphabet": an array of the alphabet symbols mentioned in the description (e.g., ["0","1"] for "over {0,1}")

RULES:
- Output ONLY a valid JSON object: {"regex": "...", "alphabet": ["...", "..."]}
- No explanation, no markdown, no code fences, no extra text outside the JSON.
- Regex operators ONLY: | (union), * (Kleene star), + (one or more), ? (zero or one), () for grouping.
- Do NOT use \\w, \\d, ^, $, or any other regex metacharacters.
- Alphabet symbols are literal characters (e.g., a, b, 0, 1).
- Use "e" for epsilon (empty string) if needed.
- If the alphabet is not mentioned, infer it from the symbols used in the regex.

EXAMPLES:
  "strings over {a,b} containing ab as substring"  →  {"regex":"(a|b)*ab(a|b)*", "alphabet":["a","b"]}
  "strings over {0,1} starting with 00"             →  {"regex":"00(0|1)*", "alphabet":["0","1"]}
  "strings over {a,b} ending with bb"               →  {"regex":"(a|b)*bb", "alphabet":["a","b"]}
  "strings over {0,1} with even number of 0s"       →  {"regex":"(1*(01*01*)*)", "alphabet":["0","1"]}
  "binary strings ending in 00"                     →  {"regex":"(0|1)*00", "alphabet":["0","1"]}
  "strings over {a,b} containing exactly two a's"   →  {"regex":"b*ab*ab*", "alphabet":["a","b"]}
  "strings over {0,1} not containing 11"            →  {"regex":"(0|10)*(1|e)", "alphabet":["0","1"]}
  "binary strings where 3rd symbol from right is 1" →  {"regex":"(0|1)*1(0|1)(0|1)", "alphabet":["0","1"]}
  "strings divisible by 3"                          →  {"regex":"NONREGULAR", "alphabet":[]}

Now give ONLY the JSON for:`;

/**
 * FULL JSON PROMPT: fallback for PDA/TM or when regex extraction fails.
 */
export const SYSTEM_PROMPT = `You are an automata theory expert assistant.
RULES (strictly follow every rule):
1. Output ONLY a single valid JSON object. No markdown, no code fences, no prose.
2. Match one of the schemas below exactly.
3. FOR DFAs and NFAs: You MUST include the "regex" field containing a valid, correct regular expression representing the requested language.

DFA schema:
{ "type":"DFA", "regex":"string", "states":["q0","q1","q2"], "alphabet":["0","1"], "startState":"q0", "acceptStates":["q2"], "transitions":{ "q0":{"0":"q1","1":"q2"} } }

NFA schema (value is array of states):
{ "type":"NFA", "regex":"string", "states":["q0","q1","q2"], "alphabet":["0","1"], "startState":"q0", "acceptStates":["q2"], "transitions":{ "q0":{"0":["q1","q2"], "":["q1"]} } }

PDA schema:
{ "type":"PDA", "states":["q0","q1","q2"], "alphabet":["0","1"], "stackAlphabet":["Z","A"], "startState":"q0", "acceptStates":["q2"], "startStackSymbol":"Z", "transitions":{ "q0":{ "0":[{"topOfStack":"Z","targetState":"q0","pushSymbols":["A","Z"]}] } } }

TM schema:
{ "type":"TM", "states":["q0","q1","qAccept","qReject"], "alphabet":["0","1"], "tapeAlphabet":["0","1","B"], "startState":"q0", "acceptState":"qAccept", "rejectState":"qReject", "blankSymbol":"B", "transitions":{ "q0":{"0":{"targetState":"q0","writeSymbol":"0","direction":"R"}} } }`;

/**
 * CFG PROMPT: ask Claude to extract a Context-Free Grammar for PDA generation.
 */
export const CFG_EXTRACT_PROMPT = `You are a formal language theory expert.
Your ONLY job: given a natural language description of a context-free language, output the correct Context-Free Grammar (CFG) for it.

RULES:
- Output ONLY raw CFG production lines. No JSON, no markdown, no backticks, no explanation.
- Format: each line is   LHS -> RHS1 | RHS2 | ...
- Use UPPERCASE for non-terminals: S, A, B, P, Q, T, C ...
- Use lowercase letters or digits for terminals: a, b, 0, 1, (, ), ...
- Use "e" for epsilon.
- The FIRST line must define the start symbol S.
- ONLY output NOTCFL if the language is PROVABLY not context-free (e.g. {a^n b^n c^n}, {ww}).

EXAMPLES:
"L = {a^n b^n | n >= 1}"               -> S -> aSb | ab
"L = {a^n b^n | n >= 0}"               -> S -> aSb | e
"L = {0^n 1^n | n >= 1}"               -> S -> 0S1 | 01
"L = {a^n b^2n | n >= 1}"              -> S -> aSbb | abb
"L = {a^i b^j | i != j}"              -> S -> P | Q
P -> aPb | aP | a
Q -> aQb | Qb | b
"palindromes over {a,b}"              -> S -> aSa | bSb | a | b | e
"L = {ww^R | w in {a,b}*}"           -> S -> aSa | bSb | e
"balanced parentheses"                -> S -> SS | (S) | e
"strings with equal a's and b's"      -> S -> aSbS | bSaS | e

NOT context-free (output NOTCFL for these only):
- {a^n b^n c^n | n >= 1}
- {ww | w in {a,b}*}

Now output ONLY the CFG for:`;

// ─── Claude Client (NL → Regex / CFG / Full JSON) ────────────────────────────

export class ClaudeClient {
  private readonly client: Anthropic;
  readonly model: string;

  constructor() {
    if (!process.env.ANTHROPIC_API_KEY) {
      throw new Error('ANTHROPIC_API_KEY is not set. Add it to your .env file.');
    }
    this.client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
    this.model = CLAUDE_MODEL;
    console.log(`[Claude] Using model "${this.model}"`);
  }

  /**
   * Step-1: Extract regex + alphabet from a natural language description.
   * Returns null if non-regular or extraction fails.
   */
  async extractRegex(description: string): Promise<{ regex: string; alphabet: string[] } | null> {
    try {
      const msg = await this.client.messages.create({
        model: this.model,
        max_tokens: 256,
        temperature: 0.05,
        system: REGEX_EXTRACT_PROMPT,
        messages: [{ role: 'user', content: description }],
      });

      const text = (msg.content[0] as { text: string }).text.trim();
      // Strip markdown fences if Claude wraps the JSON
      const clean = text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
      const parsed = JSON.parse(clean) as { regex?: string; alphabet?: string[] };

      const regex = (parsed.regex ?? '').trim();
      if (!regex || regex.toUpperCase() === 'NONREGULAR' || regex.length > 300) return null;

      const alphabet: string[] = (parsed.alphabet && parsed.alphabet.length > 0)
        ? parsed.alphabet.map(String).filter(s => s.length === 1)
        : extractAlphabetFromDescription(description);

      return { regex, alphabet };
    } catch (err) {
      console.warn('[Claude] extractRegex failed:', (err as Error).message);
      return null;
    }
  }

  /**
   * Fallback: ask Claude for a full automaton JSON (used for PDA / TM,
   * and as a last resort if regex extraction fails).
   */
  async generate(userPrompt: string): Promise<string> {
    const msg = await this.client.messages.create({
      model: this.model,
      max_tokens: 2048,
      temperature: 0.1,
      system: SYSTEM_PROMPT,
      messages: [{ role: 'user', content: userPrompt }],
    });

    const text = (msg.content[0] as { text: string }).text.trim();
    // Strip markdown fences
    return text.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
  }
}

// ─── CFG Extraction (Claude) ──────────────────────────────────────────────────

/**
 * Ask Claude for the CFG of a context-free language.
 * Returns null if non-CFL (throws) or empty response.
 */
export async function extractCFGFromAI(
  client: ClaudeClient,
  description: string,
): Promise<string | null> {
  const attempt = async (temp: number): Promise<string | null> => {
    try {
      const msg = await client['client'].messages.create({
        model: client.model,
        max_tokens: 512,
        temperature: temp,
        system: CFG_EXTRACT_PROMPT,
        messages: [{ role: 'user', content: description }],
      });

      const raw = (msg.content[0] as { text: string }).text.trim();

      if (raw.toUpperCase().startsWith('NOTCFL')) {
        throw new Error('This language is not context-free and cannot be represented by a PDA.');
      }
      if (!raw || !raw.includes('->')) return null;
      if (raw.length > 1000) return null;   // hallucinated prose
      return raw;
    } catch (err) {
      const msg = (err as Error).message;
      if (msg.includes('not context-free')) throw err;
      return null;
    }
  };

  const first = await attempt(0.05);
  if (first) return first;

  console.log('[CFG] First attempt empty, retrying with temp 0.15...');
  return attempt(0.15);
}

// ─── OpenAI Vision Client (Image → Automaton JSON) ───────────────────────────

export class OpenAIVisionClient {
  private readonly client: OpenAI;
  readonly model: string;

  constructor() {
    if (!process.env.OPENAI_API_KEY) {
      throw new Error('OPENAI_API_KEY is not set. Add it to your .env file.');
    }
    this.client = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
    this.model = OPENAI_VISION_MODEL;
    console.log(`[OpenAI Vision] Using model "${this.model}"`);
  }

  /**
   * Send a base64-encoded image to GPT-4o and extract the automaton description.
   * Returns structured plain-text in the STATES/START/FINALS/ALPHABET/TRANSITIONS format
   * (identical to what vision.service.ts expects for parseNaturalLanguageOutput).
   */
  async extractFromImage(base64Image: string, mimeType = 'image/png'): Promise<string> {
    const prompt = `You are an expert at reading finite automaton diagrams.

Carefully analyze this diagram and answer in EXACTLY this format:
STATES: list every state name separated by commas
START: the single start state (has an incoming arrow from nowhere)
FINALS: list every accept/final state (drawn with double circles) separated by commas
ALPHABET: list every input symbol separated by commas, use eps for epsilon
TRANSITIONS:
FROM-LABEL->TO
(one per line, include self-loops; if an arrow has labels a,b write two lines)

Example output:
STATES: q0, q1, q2
START: q0
FINALS: q2
ALPHABET: a, b
TRANSITIONS:
q0-a->q1
q1-b->q2
q2-a->q2

Now analyze the diagram:`;

    const response = await this.client.chat.completions.create({
      model: this.model,
      max_tokens: 1024,
      temperature: 0,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image_url',
              image_url: { url: `data:${mimeType};base64,${base64Image}`, detail: 'high' },
            },
            { type: 'text', text: prompt },
          ],
        },
      ],
    });

    const text = response.choices[0]?.message?.content ?? '';
    if (!text.trim()) throw new Error('GPT-4o returned an empty response for the image.');
    console.log(`[OpenAI Vision] Raw (first 500):\n${text.slice(0, 500)}`);
    return text;
  }
}

// ─── Utility ──────────────────────────────────────────────────────────────────

/**
 * Deterministically extract the alphabet from patterns like
 * "over {0,1}" or "over {a, b, c}" in the description text.
 */
export function extractAlphabetFromDescription(description: string): string[] {
  const braceMatch = description.match(/\{\s*([^}]+)\s*\}/);
  const parenMatch = description.match(/over\s*\(\s*([^)]+)\s*\)/i);
  const raw = braceMatch?.[1] ?? parenMatch?.[1];
  if (!raw) return [];

  return raw
    .split(/[,\s]+/)
    .map(s => s.trim())
    .filter(s => s.length === 1)
    .filter((v, i, a) => a.indexOf(v) === i);
}
