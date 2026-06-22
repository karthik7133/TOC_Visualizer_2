/**
 * CFG → PDA Conversion  (Universal Grammar-Simulation Construction)
 *
 * Given any context-free grammar, builds the standard 3-state nondeterministic
 * PDA using the leftmost-derivation (grammar-simulation) method.
 *
 * This construction is PROVABLY CORRECT for every CFG, so no hardcoded
 * pattern-matching is needed.  The AI is responsible for providing a correct
 * CFG; this module turns that CFG into a PDA automatically.
 *
 * Construction:
 *   q0 →(ε, Z / S Z)→ q1   (push start symbol)
 *   q1 →(ε, A / α)→  q1   for every production A → α  (expand non-terminals)
 *   q1 →(a, a / ε)→  q1   for every terminal a         (match input symbol)
 *   q1 →(ε, Z / Z)→  q2   (accept when only Z remains)
 */

import { AutomatonType, PDASchema, PDATransitionEntry } from '../../interfaces/schema.interface';

interface Production { lhs: string; rhs: string[]; }

// ─── CFG Parser ───────────────────────────────────────────────────────────────

/**
 * Parse a raw CFG string into structured productions.
 *
 * Supports:
 *   S -> aSb | ab | e
 *   S → aSa | bSb | a | b | ε
 *   Multiple lines, uppercase non-terminals, lowercase/digit terminals
 */
function parseCFG(cfg: string): {
  variables: Set<string>;
  terminals: Set<string>;
  productions: Production[];
  startSymbol: string;
} {
  // Normalise arrow styles and epsilon spellings
  const normalised = cfg
    .replace(/→/g, '->')
    .replace(/\bepsilon\b/gi, 'e')
    .replace(/\beps\b/gi, 'e')
    .replace(/\bλ\b/g, 'e')
    .replace(/ε/g, 'e');

  const EPSILON_TOKENS = new Set(['e', 'ε', 'λ', 'eps', 'epsilon']);

  const lines = normalised
    .split('\n')
    .map(l => l.trim())
    .filter(l => l.includes('->') && l.length > 2);

  if (!lines.length) throw new Error('No productions found in CFG string.');

  const productions: Production[] = [];
  const variables = new Set<string>();
  let startSymbol = '';

  for (const line of lines) {
    const arrow = line.indexOf('->');
    const lhs   = line.slice(0, arrow).trim();
    const rhs   = line.slice(arrow + 2).trim();

    if (!lhs || !/^[A-Z]/.test(lhs)) continue; // skip malformed lines

    if (!startSymbol) startSymbol = lhs;
    variables.add(lhs);

    for (const alt of rhs.split('|')) {
      const tok = alt.trim();
      if (!tok) continue;

      // Epsilon production
      if (EPSILON_TOKENS.has(tok)) {
        productions.push({ lhs, rhs: [] });
        continue;
      }

      // Parse symbols using two-pass approach:
      // Pass 1: greedily group uppercase runs as potential non-terminal names.
      //         Non-terminals are [A-Z][A-Z']* (digits are ALWAYS separate terminals)
      //         Example: "aaSbb" → ['a','a','S','b','b'], "1S00" → ['1','S','0','0']
      // Pass 2 (done after all variables are known): split unknown uppercase
      //         sequences into single-char lookups, e.g. "SS" → ['S','S'], "AB" → ['A','B']
      const rawSymbols: string[] = [];
      let i = 0;
      while (i < tok.length) {
        if (tok[i] === ' ') { i++; continue; }
        if (/[A-Z]/.test(tok[i])) {
          // Grab uppercase-only run (no digits)
          let j = i + 1;
          while (j < tok.length && /[A-Z']/.test(tok[j])) j++;
          rawSymbols.push(tok.slice(i, j));
          i = j;
        } else {
          rawSymbols.push(tok[i]);
          i++;
        }
      }
      // Defer split of ambiguous uppercase sequences — store raw for now
      if (rawSymbols.length) productions.push({ lhs, rhs: rawSymbols });
    }
  }

  if (!startSymbol) throw new Error('Could not determine start symbol from CFG.');

  // Pass 2: fix ambiguous uppercase sequences now that all variables are known.
  // "SS" is not a variable → split into [S, S]
  // "AB" is not a variable but A and B might be → split into [A, B]
  // "TC" is not a variable but T and C might be → split into [T, C]
  for (const prod of productions) {
    prod.rhs = prod.rhs.flatMap(sym => {
      // If the symbol is a known variable or a single char, keep it as-is
      if (variables.has(sym) || sym.length === 1) return [sym];
      // Multi-char uppercase sequence: split into individual chars
      // Each char might be a variable or a terminal — let the terminal-detection below decide
      return sym.split('');
    });
  }

  const terminals = new Set<string>();
  for (const p of productions)
    for (const s of p.rhs)
      if (!variables.has(s)) terminals.add(s);

  return { variables, terminals, productions, startSymbol };
}

// ─── Grammar-Simulation PDA Construction ─────────────────────────────────────

/**
 * Builds the standard 3-state grammar-simulation PDA for any CFG.
 *
 * Works for ALL context-free languages — palindromes, a^n b^n,
 * balanced brackets, equal counts, complex union languages, etc.
 *
 * The PDA accepts by final state (q2) when the entire input has been
 * consumed and the stack contains only the bottom marker Z.
 */
function buildGrammarSimulationPDA(
  variables: Set<string>,
  terminals: Set<string>,
  productions: Production[],
  startSymbol: string,
): PDASchema {
  const Q0 = 'q0';   // initial state: push start symbol
  const Q1 = 'q1';   // main loop: expand / match
  const Q2 = 'q2';   // accept state

  const stackAlphabet = [
    'Z',
    ...Array.from(variables).sort(),
    ...Array.from(terminals).sort(),
  ];
  const alphabet = Array.from(terminals).sort();

  const trans: Record<string, Record<string, PDATransitionEntry[]>> = {
    [Q0]: {},
    [Q1]: { 'ε': [] },
    [Q2]: {},
  };

  // q0 → q1: push start symbol on top of Z
  trans[Q0]['ε'] = [
    { topOfStack: 'Z', targetState: Q1, pushSymbols: [startSymbol, 'Z'] },
  ];

  // q1: for every production A → α, expand A by pushing α onto stack.
  // pushSymbols is stored left-to-right where index 0 = top of stack.
  // simulatePDA reverses pushSymbols when applying to the stack, so we
  // store them in the ORIGINAL RHS order (no pre-reverse here).
  for (const prod of productions) {
    trans[Q1]['ε'].push({
      topOfStack:  prod.lhs,
      targetState: Q1,
      pushSymbols: [...prod.rhs],   // left = top of stack, right = bottom
    });
  }

  // q1: for every terminal a, match input symbol a by popping a off stack
  for (const t of terminals) {
    trans[Q1][t] ??= [];
    trans[Q1][t].push({ topOfStack: t, targetState: Q1, pushSymbols: [] });
  }

  // q1 → q2: accept when only Z remains on stack
  trans[Q1]['ε'].push({ topOfStack: 'Z', targetState: Q2, pushSymbols: ['Z'] });

  return {
    type:             AutomatonType.PDA,
    states:           [Q0, Q1, Q2],
    alphabet,
    stackAlphabet,
    startState:       Q0,
    acceptStates:     [Q2],
    startStackSymbol: 'Z',
    transitions:      trans,
  };
}

// ─── Public Entry-Point ───────────────────────────────────────────────────────

export function cfgToPDA(cfg: string): PDASchema {
  const { variables, terminals, productions, startSymbol } = parseCFG(cfg);

  if (productions.length === 0) {
    throw new Error('CFG has no valid productions. Cannot build PDA.');
  }

  console.log(
    `[cfgToPDA] Grammar: ${productions.length} productions, ` +
    `vars={${[...variables].join(',')}}, terms={${[...terminals].join(',')}}, start=${startSymbol}`
  );

  const pda = buildGrammarSimulationPDA(variables, terminals, productions, startSymbol);
  console.log(`[cfgToPDA] Built grammar-simulation PDA with ${pda.states.length} states.`);
  return pda;
}
