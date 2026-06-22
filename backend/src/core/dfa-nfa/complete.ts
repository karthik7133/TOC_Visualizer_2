import { DFASchema, AutomatonType } from '../../interfaces/schema.interface';
import { NFAResult } from './thompson';

/**
 * Enforce the correct alphabet on an NFA.
 * After Thompson's construction, the alphabet only contains symbols
 * that actually appear in the regex. If the description mentions e.g. "over {0,1}"
 * but the regex only uses "0", symbol "1" would be missing.
 * This adds empty-array entries for any missing symbol in every state.
 */
export function enforceAlphabet(nfa: NFAResult): NFAResult {
  const { states, alphabet, transitions } = nfa;
  const newTrans = JSON.parse(JSON.stringify(transitions)) as NFAResult['transitions'];

  for (const state of states) {
    newTrans[state] = newTrans[state] ?? {};
    for (const sym of alphabet) {
      if (!newTrans[state][sym]) {
        newTrans[state][sym] = []; // NFA: empty array = no transition on this symbol
      }
    }
  }

  return { ...nfa, transitions: newTrans };
}

/**
 * Renames a specific state in the DFA to a new name.
 */
function renameState(dfa: DFASchema, oldName: string, newName: string): DFASchema {
  if (oldName === newName) return dfa;

  const newStates = dfa.states.map(s => (s === oldName ? newName : s));
  const newStart = dfa.startState === oldName ? newName : dfa.startState;
  const newAccept = dfa.acceptStates.map(s => (s === oldName ? newName : s));

  const newTrans: Record<string, Record<string, string>> = {};
  for (const s of dfa.states) {
    const stateKey = s === oldName ? newName : s;
    newTrans[stateKey] = {};
    for (const sym of dfa.alphabet) {
      const target = dfa.transitions[s]?.[sym];
      if (target !== undefined) {
        newTrans[stateKey][sym] = target === oldName ? newName : target;
      }
    }
  }

  return {
    type: AutomatonType.DFA,
    states: newStates,
    alphabet: dfa.alphabet,
    startState: newStart,
    acceptStates: newAccept,
    transitions: newTrans,
  };
}

/**
 * Ensures the DFA is complete by adding a explicit Dead state for any missing transitions.
 * Also renames any trap/dead state to "Dead" for better visual clarity.
 */
export function enforceDeadState(dfa: DFASchema): DFASchema {
  const { states, alphabet, startState, acceptStates, transitions } = dfa;
  const newTrans = JSON.parse(JSON.stringify(transitions));
  let needsDead = false;
  const deadStateName = 'Dead';

  // 1. Fill missing transitions
  for (const state of states) {
    newTrans[state] = newTrans[state] || {};
    for (const sym of alphabet) {
      if (newTrans[state][sym] === undefined) {
        newTrans[state][sym] = deadStateName;
        needsDead = true;
      }
    }
  }

  let newStates = [...states];
  if (needsDead && !newStates.includes(deadStateName)) {
    newStates.push(deadStateName);
    newTrans[deadStateName] = {};
    for (const sym of alphabet) {
      newTrans[deadStateName][sym] = deadStateName;
    }
  }

  let completeDFA: DFASchema = {
    type: AutomatonType.DFA,
    states: newStates,
    alphabet,
    startState,
    acceptStates,
    transitions: newTrans,
  };

  // 2. Find any state that acts as a dead state (non-accepting, self-loops on all symbols)
  // and rename it to 'Dead' to be explicit to the user.
  const deadStates = completeDFA.states.filter(s =>
    !completeDFA.acceptStates.includes(s) &&
    completeDFA.alphabet.every(sym => completeDFA.transitions[s][sym] === s)
  );

  if (deadStates.length > 0) {
    const primaryDead = deadStates[0];
    if (primaryDead !== 'Dead') {
      completeDFA = renameState(completeDFA, primaryDead, 'Dead');
    }
  }

  return completeDFA;
}

/**
 * Convert a minimal DFA into a clean NFA format.
 *
 * Key difference from a raw DFA→NFA wrap:
 *   - Trap/dead states (non-accepting, self-loops on ALL symbols) are REMOVED.
 *     In an NFA, a missing transition means the path simply dies — no explicit
 *     dead state is needed or desired.
 *   - All transitions pointing TO the trap state are also omitted.
 *   - States are renumbered q0, q1, q2 … in BFS order from the start state.
 *
 * Result: the simplest, cleanest NFA for the language.
 */
export function dfaToNFA(dfa: DFASchema): NFAResult {
  const { states, alphabet, startState, acceptStates, transitions } = dfa;
  const acceptSet = new Set(acceptStates);

  // ── 1. Identify ALL trap/dead states ──────────────────────────────────────
  // A trap state is: non-accepting AND every symbol self-loops back to itself.
  const trapStates = new Set(
    states.filter(s =>
      !acceptSet.has(s) &&
      alphabet.every(sym => transitions[s]?.[sym] === s)
    )
  );

  // ── 2. BFS from start, skipping traps ─────────────────────────────────────
  const order: string[] = [];
  const seen  = new Set<string>();
  const queue = [startState];
  while (queue.length) {
    const s = queue.shift()!;
    if (seen.has(s) || trapStates.has(s)) continue;
    seen.add(s); order.push(s);
    for (const sym of alphabet) {
      const t = transitions[s]?.[sym];
      if (t && !seen.has(t) && !trapStates.has(t)) queue.push(t);
    }
  }

  // ── 3. Rename to q0, q1, q2 … ─────────────────────────────────────────────
  const rename = new Map<string, string>();
  order.forEach((old, i) => rename.set(old, `q${i}`));

  // ── 4. Build NFA transitions (skip transitions into trap states) ───────────
  const nfaTrans: NFAResult['transitions'] = {};
  for (const s of order) {
    const newS = rename.get(s)!;
    nfaTrans[newS] = {};
    for (const sym of alphabet) {
      const target = transitions[s]?.[sym];
      // Omit if: no transition, OR target is a trap state
      if (target === undefined || trapStates.has(target)) continue;
      const newTarget = rename.get(target);
      if (newTarget) nfaTrans[newS][sym] = [newTarget];
    }
  }

  return {
    states:       order.map(s => rename.get(s)!),
    alphabet,
    startState:   rename.get(startState)!,
    acceptStates: acceptStates
      .filter(s => !trapStates.has(s))
      .map(s => rename.get(s)!)
      .filter(Boolean),
    transitions:  nfaTrans,
  };
}
