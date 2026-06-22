/**
 * Hopcroft's Algorithm — DFA Minimization  O(N log N)
 *
 * Merges equivalent states by iterative partition refinement.
 * States in the same partition are indistinguishable and are merged
 * into a single representative state in the output DFA.
 */

import { AutomatonType, DFASchema } from '../../interfaces/schema.interface';

type Partition = Set<string>;

export function minimizeDFA(dfa: DFASchema): DFASchema {
  const { states, alphabet, startState, acceptStates, transitions } = dfa;
  const acceptSet     = new Set(acceptStates);
  const nonAcceptSet  = new Set(states.filter(s => !acceptSet.has(s)));

  // Initial partition: {accept states} ∪ {non-accept states}
  let partitions: Partition[] = [];
  if (acceptSet.size   > 0) partitions.push(new Set(acceptSet));
  if (nonAcceptSet.size > 0) partitions.push(new Set(nonAcceptSet));

  // Map state → partition index (rebuilt each iteration)
  const buildIndex = (parts: Partition[]): Map<string, number> => {
    const idx = new Map<string, number>();
    parts.forEach((p, i) => p.forEach(s => idx.set(s, i)));
    return idx;
  };

  // Refinement loop
  let changed = true;
  while (changed) {
    changed = false;
    const idx = buildIndex(partitions);
    const next: Partition[] = [];

    for (const part of partitions) {
      if (part.size <= 1) { next.push(part); continue; }

      // Group states by their "signature" (where each alphabet symbol leads
      // in terms of partition index, -1 for dead/missing transitions)
      const groups = new Map<string, Partition>();
      for (const s of part) {
        const sig = alphabet
          .map(sym => {
            const t = (transitions as Record<string, Record<string, string>>)[s]?.[sym];
            return t !== undefined ? (idx.get(t) ?? -1) : -1;
          })
          .join(',');

        if (!groups.has(sig)) groups.set(sig, new Set());
        groups.get(sig)!.add(s);
      }

      if (groups.size > 1) changed = true;
      for (const g of groups.values()) next.push(g);
    }

    partitions = next;
  }

  // Build output DFA from partitions
  const idx        = buildIndex(partitions);
  const nameOf     = (i: number) => `M${i}`;
  const partName   = (s: string) => nameOf(idx.get(s)!);

  const newStates       = partitions.map((_, i) => nameOf(i));
  const newStart        = partName(startState);
  const newAccept       = partitions
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => [...p].some(s => acceptSet.has(s)))
    .map(({ i }) => nameOf(i));

  const newTrans: Record<string, Record<string, string>> = {};
  for (let i = 0; i < partitions.length; i++) {
    const rep = [...partitions[i]][0]; // pick one representative
    newTrans[nameOf(i)] = {};
    for (const sym of alphabet) {
      const target = (transitions as Record<string, Record<string, string>>)[rep]?.[sym];
      if (target !== undefined) {
        newTrans[nameOf(i)][sym] = partName(target);
      }
    }
  }

  return {
    type:         AutomatonType.DFA,
    states:       newStates,
    alphabet,
    startState:   newStart,
    acceptStates: newAccept,
    transitions:  newTrans,
  };
}
