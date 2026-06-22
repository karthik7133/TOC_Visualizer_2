import { Request, Response } from 'express';
import {
  GenerateRequest, SimulateRequest, SimulateResponse,
  AutomatonType, DFASchema, NFASchema, PDASchema, TMSchema,
  SimulationStep, TapeSnapshot, AutomatonSchema,
} from '../interfaces/schema.interface';
import { ClaudeClient, extractAlphabetFromDescription, extractCFGFromAI } from '../config/ai.config';
import { regexToNFA }    from '../core/dfa-nfa/thompson';
import { nfaToDFA }      from '../core/dfa-nfa/subset';
import { minimizeDFA }   from '../core/dfa-nfa/hopcroft';
import { cfgToPDA }      from '../core/pda/cfg-parser';
import { validateTM }    from '../core/tm/tm-validator';
import { enforceDeadState, dfaToNFA } from '../core/dfa-nfa/complete';

const ai = new ClaudeClient();

// ─── CFG Safety-Net ───────────────────────────────────────────────────────────

export function normaliseDesc(s: string): string {
  return s.toLowerCase()
    .replace(/[{}|≥≤≠∈]/g, m => ({'{':'','}':'','|':'','≥':'>=','≤':'<=','≠':'!=','∈':'in'}[m]??m))
    .replace(/\\ge\b/g,'>=').replace(/\\le\b/g,'<=').replace(/\\neq\b/g,'!=')
    .replace(/\\mid\b/g,'|').replace(/\s+/g,' ').trim();
}

function extractSymbols(d: string): [string, string] {
  const matches = [...d.matchAll(/([a-z0-9])\s*\^\s*[a-z0-9+*-]+/gi)];
  if (matches.length >= 2) {
    const unique = [...new Set(matches.map(m => m[1]))];
    if (unique.length >= 2) return [unique[0], unique[1]];
  }
  const setMatch = d.match(/over\s*\{?\s*([a-z0-9])\s*,\s*([a-z0-9])/i);
  if (setMatch) return [setMatch[1], setMatch[2]];
  if (d.includes('0') && d.includes('1')) return ['0', '1'];
  return ['a', 'b'];
}

function extractThreeSymbols(d: string): [string, string, string] {
  const matches = [...d.matchAll(/([a-z0-9])\s*\^\s*[a-z0-9+*-]+/gi)];
  const unique = [...new Set(matches.map(m => m[1]))];
  if (unique.length >= 3) return [unique[0], unique[1], unique[2]];
  const candidates = ['a', 'b', 'c'];
  for (const char of d) {
    if (/[a-z0-9]/.test(char) && !candidates.includes(char)) candidates.push(char);
  }
  return [candidates[0]||'a', candidates[1]||'b', candidates[2]||'c'];
}

export function deriveKnownCFG(desc: string): string | null {
  const d = normaliseDesc(desc);
  const [x, y] = extractSymbols(d);
  const matches = [...d.matchAll(/([a-z0-9])\s*\^\s*[a-z0-9+*-]+/gi)];
  const bases = [...new Set(matches.map(m => m[1]))];

  const sumMatch = d.match(/\^(?:\(|{|)?([a-z])\s*\+\s*([a-z])(?:\)|}|)?/);
  if (sumMatch) {
    const [sx, sy, sz] = extractThreeSymbols(d);
    const sumPos = d.indexOf(sumMatch[0]);
    const firstExpPos = d.indexOf('^' + sumMatch[1]);
    const secondExpPos = d.indexOf('^' + sumMatch[2]);
    if (sumPos > firstExpPos && sumPos > secondExpPos) {
      if (/n,?\s*m\s*>=\s*0|>=?\s*0/.test(d)) return `S -> ${sx}S${sz} | A\nA -> ${sy}A${sz} | e`;
      return `S -> ${sx}S${sz} | A\nA -> ${sy}A${sz} | ${sy}${sz}`;
    } else if (sumPos < firstExpPos && sumPos < secondExpPos) {
      if (/n,?\s*m\s*>=\s*0|>=?\s*0/.test(d)) return `S -> ${sx}S${sz} | A\nA -> ${sx}A${sy} | e`;
      return `S -> ${sx}S${sz} | A\nA -> ${sx}A${sy} | ${sx}${sy}`;
    }
  }

  const outerMatch = d.match(/\^([a-z])[\s\S]*\^([a-z])[\s\S]*\^\1/);
  if (outerMatch && outerMatch[1] !== outerMatch[2]) {
    const [ox, oy, oz] = extractThreeSymbols(d);
    if (/n,?\s*m\s*>=\s*0|>=?\s*0/.test(d)) return `S -> ${ox}S${oz} | B\nB -> ${oy}B | e`;
    return `S -> ${ox}S${oz} | ${ox}B${oz}\nB -> ${oy}B | ${oy}`;
  }

  const firstTwoMatch = d.match(/\^([a-z])[\s\S]*\^\1[\s\S]*\^([a-z])/);
  if (firstTwoMatch && firstTwoMatch[1] !== firstTwoMatch[2]) {
    const [fx, fy, fz] = extractThreeSymbols(d);
    const nGE1 = /n\s*>=\s*1|i\s*>=\s*1/.test(d) || !/n\s*>=\s*0|i\s*>=\s*0/.test(d);
    const mGE0 = /m\s*>=\s*0|j\s*>=\s*0/.test(d);
    const partA = nGE1 ? `A -> ${fx}A${fy} | ${fx}${fy}` : `A -> ${fx}A${fy} | e`;
    const partC = mGE0 ? `C -> ${fz}C | e` : `C -> ${fz}C | ${fz}`;
    return `S -> A C\n${partA}\n${partC}`;
  }

  const lastTwoMatch = d.match(/\^([a-z])[\s\S]*\^([a-z])[\s\S]*\^\2/);
  if (lastTwoMatch && lastTwoMatch[1] !== lastTwoMatch[2]) {
    const [lx, ly, lz] = extractThreeSymbols(d);
    const mGE0 = /m\s*>=\s*0|j\s*>=\s*0/.test(d);
    const nGE1 = /n\s*>=\s*1|i\s*>=\s*1/.test(d) || !/n\s*>=\s*0|i\s*>=\s*0/.test(d);
    const partA = mGE0 ? `A -> ${lx}A | e` : `A -> ${lx}A | ${lx}`;
    const partB = nGE1 ? `B -> ${ly}B${lz} | ${ly}${lz}` : `B -> ${ly}B${lz} | e`;
    return `S -> A B\n${partA}\n${partB}`;
  }

  if (/[ij]\s*!=\s*[ij]|[nm]\s*!=\s*[nm]/.test(d) ||
      /(?:i|n|count)\s+(?:!=|not\s+equal|differs?)/i.test(d)) {
    return `S -> P | Q\nP -> ${x}P${y} | ${x}P | ${x}\nQ -> ${x}Q${y} | Q${y} | ${y}`;
  }
  if (/n\s*>\s*m|i\s*>\s*j/.test(d) && /\^n/.test(d) && /\^m/.test(d))
    return `S -> ${x}P${y} | ${x}\nP -> ${x}P${y} | ${x}P | ${x}`;
  if (/n\s*<\s*m|i\s*<\s*j/.test(d) && /\^n/.test(d) && /\^m/.test(d))
    return `S -> ${x}Q${y} | ${y}\nQ -> ${x}Q${y} | Q${y} | ${y}`;
  if (/n\s*>=\s*m|i\s*>=\s*j/.test(d) && /\^n/.test(d) && /\^m/.test(d))
    return `S -> ${x}S${y} | ${x}S | e`;
  if (/n\s*<=\s*m|i\s*<=\s*j/.test(d) && /\^n/.test(d) && /\^m/.test(d))
    return `S -> ${x}S${y} | S${y} | e`;

  if (/palindrome/.test(d)) {
    const alphaMatch = d.match(/\{?\s*([a-z0-9])\s*,\s*([a-z0-9])\s*\}?/);
    const [p, q] = alphaMatch ? [alphaMatch[1], alphaMatch[2]] : ['a', 'b'];
    if (/centre.?marked|center.?marked|xcx/.test(d)) return `S -> ${p}S${p} | ${q}S${q} | c`;
    if (/even.?length|ww\^?r/.test(d)) return `S -> ${p}S${p} | ${q}S${q} | e`;
    return `S -> ${p}S${p} | ${q}S${q} | ${p} | ${q} | e`;
  }
  if (/ww\^?r|w\s*w\^r/.test(d)) {
    const alphaMatch = d.match(/\{?\s*([a-z0-9])\s*,\s*([a-z0-9])\s*\}?/);
    const [p, q] = alphaMatch ? [alphaMatch[1], alphaMatch[2]] : ['a', 'b'];
    return `S -> ${p}S${p} | ${q}S${q} | e`;
  }

  const multMatch = d.match(/\^(\d+)n/);
  const mult = multMatch ? parseInt(multMatch[1], 10) : 0;
  if (mult >= 2 && /\^n/.test(d)) {
    const posK = d.indexOf(`^${mult}n`);
    const posN = d.indexOf('^n');
    if (posN < posK) return `S -> ${x}S${y.repeat(mult)} | ${x}${y.repeat(mult)}`;
    return `S -> ${x.repeat(mult)}S${y} | ${x.repeat(mult)}${y}`;
  }

  const meqMatch = d.match(/m\s*=\s*(\d+)\s*n/);
  if (meqMatch) {
    const k = parseInt(meqMatch[1], 10);
    return `S -> ${x}S${y.repeat(k)} | ${x}${y.repeat(k)}`;
  }

  if (/square\s+bracket/.test(d) && /balanced|matching|nested/.test(d)) return `S -> SS | [S] | e`;
  if (/curly|brace/.test(d) && /balanced|matching|nested/.test(d)) return `S -> SS | {S} | e`;
  if (/dyck/.test(d)) return `S -> SS | (S) | e`;
  if (/balanced|matching|nested/.test(d) && /paren|bracket/.test(d)) return `S -> SS | (S) | e`;

  if (/equal\s+(?:number|count)\s+of/.test(d) || /same\s+(?:number|count)\s+of/.test(d))
    return `S -> ${x}S${y}S | ${y}S${x}S | e`;

  if (bases.length === 2) {
    if (/\^n[\s\S]*\^n/.test(d) && /n\s*>=?\s*0/.test(d) && !/\d+n/.test(d))
      return `S -> ${x}S${y} | e`;
    if (/\^n[\s\S]*\^n/.test(d) && /n\s*>=?\s*1/.test(d) && !/\d+n/.test(d))
      return `S -> ${x}S${y} | ${x}${y}`;
  }

  return null;
}

// ─── Generate ─────────────────────────────────────────────────────────────────

export async function generateAutomaton(req: Request, res: Response): Promise<void> {
  try {
    const { inputType, machineType, input }: GenerateRequest = req.body;
    let automaton: AutomatonSchema;

    switch (inputType) {
      case 'regex': {
        const wordCount = input.trim().split(/\s+/).length;
        if (wordCount > 4) {
          res.status(400).json({ error: 'Regex mode only accepts regular expressions, not natural language.' });
          return;
        }
        const nfaRaw = regexToNFA(input);
        const minDFA = minimizeDFA(nfaToDFA(nfaRaw));
        if (machineType === AutomatonType.NFA) {
          automaton = { ...dfaToNFA(minDFA), type: AutomatonType.NFA } as NFASchema;
        } else {
          automaton = enforceDeadState(minDFA);
        }
        break;
      }
      case 'cfg': {
        automaton = cfgToPDA(input);
        break;
      }
      case 'pda-json': {
        const parsed = JSON.parse(input) as PDASchema;
        if (!parsed.states || !parsed.transitions || !parsed.startState) {
          res.status(400).json({ error: 'Invalid PDA JSON.' });
          return;
        }
        if (!parsed.type) parsed.type = AutomatonType.PDA;
        automaton = parsed;
        break;
      }
      case 'tm-json': {
        const parsed = JSON.parse(input) as TMSchema;
        const result = validateTM(parsed);
        if (!result.valid) {
          res.status(400).json({ error: 'TM validation failed', details: result.errors });
          return;
        }
        automaton = parsed;
        break;
      }
      case 'natural-language': {
        if (machineType === AutomatonType.DFA || machineType === AutomatonType.NFA) {
          const result = await ai.extractRegex(input);
          console.log(`[Claude] Regex result: ${JSON.stringify(result)} for: "${input}"`);

          if (result) {
            let regex = result.regex.replace(/\bepsilon\b/gi, 'e').replace(/\bε\b/g, 'e');
            try {
              const nfaRaw = regexToNFA(regex);
              if (result.alphabet.length > 0)
                nfaRaw.alphabet = [...new Set([...nfaRaw.alphabet, ...result.alphabet])].sort();
              const minDFA = minimizeDFA(nfaToDFA(nfaRaw));
              if (machineType === AutomatonType.NFA) {
                automaton = { ...dfaToNFA(minDFA), type: AutomatonType.NFA } as NFASchema;
              } else {
                automaton = enforceDeadState(minDFA);
              }
              console.log(`[Claude] Compiled from regex "${regex}" → ${minDFA.states.length} states.`);
              break;
            } catch (regexErr) {
              console.warn(`[Claude] Regex compile failed (${(regexErr as Error).message}), falling back to full JSON.`);
            }
          }

          console.log('[Claude] Regex extraction failed — requesting full JSON.');
          const raw = await ai.generate(`Request: ${input}\nMachine type: ${machineType}\nIMPORTANT: include "regex" key.`);
          const parsed = JSON.parse(raw);
          const fallbackAlphabet: string[] = parsed.alphabet ?? extractAlphabetFromDescription(input);
          if (parsed.regex) {
            const nfaRaw = regexToNFA(parsed.regex);
            if (fallbackAlphabet.length > 0)
              nfaRaw.alphabet = [...new Set([...nfaRaw.alphabet, ...fallbackAlphabet])].sort();
            const minDFA = minimizeDFA(nfaToDFA(nfaRaw));
            automaton = machineType === AutomatonType.NFA
              ? { ...dfaToNFA(minDFA), type: AutomatonType.NFA } as NFASchema
              : enforceDeadState(minDFA);
          } else {
            automaton = machineType === AutomatonType.DFA
              ? enforceDeadState(parsed as DFASchema)
              : (parsed as AutomatonSchema);
          }
          break;
        }

        if (machineType === AutomatonType.PDA) {
          const safetyNet = deriveKnownCFG(input);
          if (safetyNet) {
            console.log(`[Safety-net] Using known CFG for: "${input.slice(0, 60)}"`);
            automaton = cfgToPDA(safetyNet);
            break;
          }
          let cfg: string | null = null;
          try {
            cfg = await extractCFGFromAI(ai, input);
          } catch (err) {
            throw new Error(`The AI determined this language is not context-free. Try rephrasing.`);
          }
          console.log(`[Claude PDA] Extracted CFG:\n${cfg}`);
          if (cfg) {
            automaton = cfgToPDA(cfg);
            break;
          }
          const raw = await ai.generate(`Generate a valid PDA JSON for: ${input}\nMachine type: PDA.`);
          automaton = JSON.parse(raw) as AutomatonSchema;
          break;
        }

        const raw = await ai.generate(`Request: ${input}\nMachine type: ${machineType}`);
        automaton = JSON.parse(raw) as AutomatonSchema;
        break;
      }
      default:
        res.status(400).json({ error: `Unknown inputType: ${(req.body as GenerateRequest).inputType}` });
        return;
    }

    res.json({ automaton });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}

// ─── Simulate — DFA ───────────────────────────────────────────────────────────

function simulateDFA(dfa: DFASchema, input: string): SimulateResponse {
  const steps: SimulationStep[] = [];
  let state = dfa.startState;
  steps.push({ stepIndex: 0, state, symbol: null, edgeId: null, memorySnapshot: null, accepted: false, rejected: false });
  for (let i = 0; i < input.length; i++) {
    const sym = input[i];
    const next = dfa.transitions[state]?.[sym];
    const edgeId = next ? `${state}-${sym}-${next}` : null;
    if (!next) {
      steps.push({ stepIndex: i+1, state, symbol: sym, edgeId: null, memorySnapshot: null, accepted: false, rejected: true });
      return { steps, accepted: false };
    }
    state = next;
    steps.push({ stepIndex: i+1, state, symbol: sym, edgeId, memorySnapshot: null, accepted: false, rejected: false });
  }
  const accepted = dfa.acceptStates.includes(state);
  steps[steps.length-1].accepted = accepted;
  steps[steps.length-1].rejected = !accepted;
  return { steps, accepted };
}

// ─── Simulate — NFA ───────────────────────────────────────────────────────────

function epsilonClosure(states: Set<string>, trans: NFASchema['transitions']): Set<string> {
  const cl = new Set(states); const q = [...states];
  while (q.length) { const s = q.pop()!; for (const t of trans[s]?.[''] ?? []) if (!cl.has(t)) { cl.add(t); q.push(t); } }
  return cl;
}

function simulateNFA(nfa: NFASchema, input: string): SimulateResponse {
  const steps: SimulationStep[] = [];
  let current = epsilonClosure(new Set([nfa.startState]), nfa.transitions);
  steps.push({ stepIndex: 0, state: [...current].join(','), symbol: null, edgeId: null, memorySnapshot: null, accepted: false, rejected: false });
  for (let i = 0; i < input.length; i++) {
    const sym = input[i];
    const next = new Set<string>();
    const crossedEdges: string[] = [];
    for (const s of current) {
      for (const t of nfa.transitions[s]?.[sym] ?? []) { next.add(t); crossedEdges.push(`${s}-${sym}-${t}`); }
    }
    const closure = epsilonClosure(next, nfa.transitions);
    if (closure.size === 0) {
      steps.push({ stepIndex: i+1, state: '∅', symbol: sym, edgeId: null, memorySnapshot: null, accepted: false, rejected: true });
      return { steps, accepted: false };
    }
    current = closure;
    steps.push({ stepIndex: i+1, state: [...current].join(','), symbol: sym, edgeId: crossedEdges[0]??null, memorySnapshot: null, accepted: false, rejected: false });
  }
  const accepted = [...current].some(s => nfa.acceptStates.includes(s));
  steps[steps.length-1].accepted = accepted;
  steps[steps.length-1].rejected = !accepted;
  return { steps, accepted };
}

// ─── Simulate — PDA ───────────────────────────────────────────────────────────

function simulatePDA(pda: PDASchema, input: string): SimulateResponse {
  type PDAConfig = { state: string; inputIdx: number; stack: string[]; history: SimulationStep[] };
  const initial: PDAConfig = {
    state: pda.startState, inputIdx: 0, stack: [pda.startStackSymbol],
    history: [{ stepIndex: 0, state: pda.startState, symbol: null, edgeId: null, memorySnapshot: [pda.startStackSymbol], accepted: false, rejected: false }],
  };
  const queue: PDAConfig[] = [initial];
  const seen = new Set<string>();
  const LIMIT = 100_000;
  let visited = 0;
  let longestRejectPath: SimulationStep[] = initial.history;

  while (queue.length && visited++ < LIMIT) {
    const cfg = queue.shift()!;
    const { state, inputIdx, stack, history } = cfg;
    const dedupKey = `${state}|${inputIdx}|${stack.slice(-10).join(',')}`;
    if (seen.has(dedupKey)) continue;
    seen.add(dedupKey);
    if (history.length > longestRejectPath.length) longestRejectPath = history;
    if (pda.acceptStates.includes(state) && inputIdx === input.length) {
      const steps = [...history];
      steps[steps.length-1].accepted = true;
      return { steps, accepted: true };
    }
    if (stack.length === 0) continue;
    const topOfStack = stack[stack.length-1];
    const tryTransitions = (symbol: string) => {
      const epsilonKeys = symbol === 'ε' ? ['ε', ''] : [symbol];
      for (const key of epsilonKeys) {
        for (const entry of pda.transitions[state]?.[key] ?? []) {
          if (entry.topOfStack !== topOfStack) continue;
          const newStack = [...stack.slice(0,-1), ...[...entry.pushSymbols].reverse()];
          const newIdx = symbol === 'ε' ? inputIdx : inputIdx+1;
          const step: SimulationStep = {
            stepIndex: history.length, state: entry.targetState,
            symbol: symbol === 'ε' ? null : symbol,
            edgeId: `${state}-${symbol === 'ε' ? 'ε' : symbol}-${entry.targetState}`,
            memorySnapshot: [...newStack].reverse(), accepted: false, rejected: false,
          };
          queue.push({ state: entry.targetState, inputIdx: newIdx, stack: newStack, history: [...history, step] });
        }
      }
    };
    tryTransitions('ε');
    if (inputIdx < input.length) tryTransitions(input[inputIdx]);
  }

  const steps = [...longestRejectPath];
  steps[steps.length-1] = { ...steps[steps.length-1], rejected: true };
  return { steps, accepted: false };
}

// ─── Simulate — TM ───────────────────────────────────────────────────────────

function simulateTM(tm: TMSchema, input: string): SimulateResponse {
  const steps: SimulationStep[] = [];
  const tape = input.split('');
  if (tape.length === 0) tape.push(tm.blankSymbol);
  let head = 0, state = tm.startState;
  const LIMIT = 1000;
  const snap = (): TapeSnapshot => ({ tape: [...tape], headPosition: head });
  steps.push({ stepIndex: 0, state, symbol: null, edgeId: null, memorySnapshot: snap(), accepted: false, rejected: false });
  for (let tick = 0; tick < LIMIT; tick++) {
    if (state === tm.acceptState) { steps[steps.length-1].accepted = true; return { steps, accepted: true }; }
    if (state === tm.rejectState) { steps[steps.length-1].rejected = true; return { steps, accepted: false }; }
    while (tape.length <= head) tape.push(tm.blankSymbol);
    const read = tape[head] ?? tm.blankSymbol;
    const tr = tm.transitions[state]?.[read];
    if (!tr) { steps[steps.length-1].rejected = true; return { steps, accepted: false }; }
    tape[head] = tr.writeSymbol;
    const edgeId = `${state}-${read}-${tr.targetState}`;
    if (tr.direction === 'L') head = Math.max(0, head-1);
    else if (tr.direction === 'R') head++;
    state = tr.targetState;
    steps.push({ stepIndex: tick+1, state, symbol: read, edgeId, memorySnapshot: snap(), accepted: false, rejected: false });
  }
  steps[steps.length-1].rejected = true;
  return { steps, accepted: false };
}

// ─── Simulate ─────────────────────────────────────────────────────────────────

export async function simulateAutomaton(req: Request, res: Response): Promise<void> {
  try {
    const { automaton, inputString }: SimulateRequest = req.body;
    let result: SimulateResponse;
    switch (automaton.type) {
      case AutomatonType.DFA: result = simulateDFA(automaton as DFASchema, inputString); break;
      case AutomatonType.NFA: result = simulateNFA(automaton as NFASchema, inputString); break;
      case AutomatonType.PDA: result = simulatePDA(automaton as PDASchema, inputString); break;
      case AutomatonType.TM:  result = simulateTM(automaton as TMSchema,  inputString); break;
      default:
        res.status(400).json({ error: 'Unknown automaton type' });
        return;
    }
    res.json(result);
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    res.status(500).json({ error: msg });
  }
}
