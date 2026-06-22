/**
 * Subset Construction — ε-NFA → DFA
 *
 * Converts the NFA produced by Thompson's Construction into an equivalent DFA
 * by tracking sets of simultaneously reachable NFA states as DFA "macro-states".
 */

import { NFAResult } from './thompson';
import { AutomatonType, DFASchema } from '../../interfaces/schema.interface';

// ─── Helpers ──────────────────────────────────────────────────────────────────

type NFATransitions = NFAResult['transitions'];

/** Compute the ε-closure of a set of NFA states (BFS). */
function epsilonClosure(states: Set<string>, trans: NFATransitions): Set<string> {
  const closure = new Set(states);
  const queue   = [...states];
  while (queue.length) {
    const s = queue.pop()!;
    for (const t of trans[s]?.[''] ?? []) {
      if (!closure.has(t)) { closure.add(t); queue.push(t); }
    }
  }
  return closure;
}

/** Compute the set of NFA states reachable from `states` on `symbol`. */
function move(states: Set<string>, symbol: string, trans: NFATransitions): Set<string> {
  const result = new Set<string>();
  for (const s of states) {
    for (const t of trans[s]?.[symbol] ?? []) result.add(t);
  }
  return result;
}

/** Canonical string key for a set of NFA states (sorted for stability). */
function setKey(s: Set<string>): string {
  return [...s].sort().join('\x00');
}

// ─── Main Export ──────────────────────────────────────────────────────────────

export function nfaToDFA(nfa: NFAResult): DFASchema {
  const { alphabet, startState, acceptStates, transitions: nfaTrans } = nfa;
  const nfaAccept = new Set(acceptStates);

  // ε-closure of the NFA start state is the DFA start state
  const startClosure = epsilonClosure(new Set([startState]), nfaTrans);

  // Map: setKey → DFA state name
  const keyToName = new Map<string, string>();
  const nameToSet = new Map<string, Set<string>>();
  let counter = 0;

  const intern = (set: Set<string>): string => {
    const k = setKey(set);
    if (!keyToName.has(k)) {
      const name = `D${counter++}`;
      keyToName.set(k, name);
      nameToSet.set(name, set);
    }
    return keyToName.get(k)!;
  };

  const startName  = intern(startClosure);
  const worklist   = [startName];
  const visited    = new Set<string>();
  const dfaTrans:  Record<string, Record<string, string>> = {};
  const dfaStates: string[] = [];
  const dfaAccept: string[] = [];

  // ── Phase 1: standard subset construction ──────────────────────────────────
  while (worklist.length) {
    const current = worklist.pop()!;
    if (visited.has(current)) continue;
    visited.add(current);
    dfaStates.push(current);
    dfaTrans[current] = {};

    const currentSet = nameToSet.get(current)!;

    // Is this a DFA accept state?
    if ([...currentSet].some(s => nfaAccept.has(s))) {
      dfaAccept.push(current);
    }

    for (const sym of alphabet) {
      const moved   = move(currentSet, sym, nfaTrans);
      const closure = epsilonClosure(moved, nfaTrans);
      if (closure.size === 0) continue; // will be wired to dead state below

      const nextName = intern(closure);
      dfaTrans[current][sym] = nextName;
      if (!visited.has(nextName)) worklist.push(nextName);
    }
  }

  // ── Phase 2: add explicit dead/trap state for DFA completeness ─────────────
  // A complete DFA must have a transition for every symbol at every state.
  // Any missing transition is routed to the dead state "∅" (non-accepting, self-loops).
  const DEAD = '∅';
  let needsDead = false;

  for (const state of dfaStates) {
    for (const sym of alphabet) {
      if (!dfaTrans[state][sym]) {
        dfaTrans[state][sym] = DEAD;
        needsDead = true;
      }
    }
  }

  if (needsDead) {
    dfaStates.push(DEAD);
    dfaTrans[DEAD] = {};
    for (const sym of alphabet) {
      dfaTrans[DEAD][sym] = DEAD; // dead state loops on all symbols
    }
    // DEAD is not an accept state (correct — it's a trap/reject sink)
  }

  return {
    type:         AutomatonType.DFA,
    states:       dfaStates,
    alphabet,
    startState:   startName,
    acceptStates: dfaAccept,
    transitions:  dfaTrans,
  };
}
