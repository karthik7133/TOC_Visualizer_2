/**
 * ε-NFA → NFA (Epsilon Elimination)
 *
 * Converts a Thompson ε-NFA into an equivalent NFA with NO epsilon transitions.
 * Algorithm:
 *   For each original state q and each real symbol a:
 *     new_trans[q][a] = ε-closure( move( ε-closure({q}), a ) )
 *   A state q is accepting if ε-closure({q}) ∩ acceptStates ≠ ∅
 *   Then prune states unreachable from the start state.
 *
 * This converts the Thompson output (typically 10–30 states for simple regexes)
 * into the canonical minimal NFA (e.g. 4 states for "contains 001").
 */

import { NFAResult } from './thompson';

type Trans = NFAResult['transitions'];

/** BFS ε-closure: all states reachable from `states` via ε-transitions only. */
function epsilonClosure(states: Set<string>, trans: Trans): Set<string> {
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

/** All NFA states reachable from `states` by consuming exactly symbol `a`. */
function move(states: Set<string>, a: string, trans: Trans): Set<string> {
  const result = new Set<string>();
  for (const s of states) {
    for (const t of trans[s]?.[a] ?? []) result.add(t);
  }
  return result;
}

/** Sorted array from a Set (for stable state labels). */
function sorted(s: Set<string>): string[] {
  return [...s].sort();
}

export function eliminateEpsilon(nfa: NFAResult): NFAResult {
  const { startState, acceptStates, transitions: trans, alphabet } = nfa;
  const acceptSet = new Set(acceptStates);

  // ── 1. For each original state, compute ε-closure and reachable transitions ──
  const allOriginalStates = Object.keys(trans);

  const newTrans: Trans = {};
  const newAccept: string[] = [];

  for (const q of allOriginalStates) {
    const closureQ = epsilonClosure(new Set([q]), trans);

    // If any state in ε-closure(q) is an accept state, q becomes an accept state
    if ([...closureQ].some(s => acceptSet.has(s))) {
      if (!newAccept.includes(q)) newAccept.push(q);
    }

    newTrans[q] = {};
    for (const a of alphabet) {
      // ε-closure(move(ε-closure({q}), a))
      const moved   = move(closureQ, a, trans);
      const reached = epsilonClosure(moved, trans);
      if (reached.size > 0) {
        newTrans[q][a] = sorted(reached);
      }
    }
  }

  // ── 2. Prune unreachable states (BFS from start state) ────────────────────
  const reachable = new Set<string>();
  const workList  = [startState];
  while (workList.length) {
    const s = workList.pop()!;
    if (reachable.has(s)) continue;
    reachable.add(s);
    for (const a of alphabet) {
      for (const t of newTrans[s]?.[a] ?? []) {
        if (!reachable.has(t)) workList.push(t);
      }
    }
  }

  // Keep only reachable states; also filter out states only reachable via dead paths
  const reachableStates = allOriginalStates.filter(s => reachable.has(s));

  const finalTrans: Trans = {};
  for (const s of reachableStates) {
    finalTrans[s] = {};
    for (const a of alphabet) {
      const targets = (newTrans[s]?.[a] ?? []).filter(t => reachable.has(t));
      if (targets.length > 0) finalTrans[s][a] = targets;
    }
  }

  // ── 3. Rename states to clean q0, q1, q2 … labels ────────────────────────
  // BFS-order assignment from start state for stable naming
  const order: string[] = [];
  const bfsQueue = [startState];
  const seen = new Set<string>();
  while (bfsQueue.length) {
    const s = bfsQueue.shift()!;
    if (seen.has(s)) continue;
    seen.add(s); order.push(s);
    for (const a of alphabet) {
      for (const t of finalTrans[s]?.[a] ?? []) {
        if (!seen.has(t)) bfsQueue.push(t);
      }
    }
  }

  const rename = new Map<string, string>();
  order.forEach((old, i) => rename.set(old, `q${i}`));

  const renamedTrans: Trans = {};
  for (const s of order) {
    const newS = rename.get(s)!;
    renamedTrans[newS] = {};
    for (const a of alphabet) {
      const targets = (finalTrans[s]?.[a] ?? []).map(t => rename.get(t)!).filter(Boolean);
      if (targets.length > 0) renamedTrans[newS][a] = [...new Set(targets)].sort();
    }
  }

  return {
    states:       order.map(s => rename.get(s)!),
    alphabet,
    startState:   rename.get(startState)!,
    acceptStates: newAccept.filter(s => reachable.has(s)).map(s => rename.get(s)!),
    transitions:  renamedTrans,
  };
}
