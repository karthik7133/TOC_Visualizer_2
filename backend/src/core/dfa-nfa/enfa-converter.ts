/**
 * ε-NFA Converter
 *
 * Provides two public functions that wrap the existing pipeline:
 *   - enfaToNfa:  ε-NFA → standard NFA  (via epsilon-elim.ts)
 *   - enfaToDfa:  ε-NFA → minimal DFA   (via subset.ts + hopcroft.ts + complete.ts)
 *
 * The ImageAutomatonJSON transition list (flat array) is first normalised
 * into the NFASchema transition map format before conversion.
 */

import { NFASchema, DFASchema, AutomatonType } from '../../interfaces/schema.interface';
import { NFAResult }       from './thompson';
import { eliminateEpsilon } from './epsilon-elim';
import { nfaToDFA }        from './subset';
import { minimizeDFA }     from './hopcroft';
import { enforceDeadState, dfaToNFA } from './complete';

// ─── Flat-list → NFASchema ────────────────────────────────────────────────────

/** Normalise the flat transition list from the vision model into NFATransitions map. */
export function flatTransitionsToNFASchema(raw: {
  states:      string[];
  alphabet:    string[];
  transitions: { from: string; to: string; label: string }[];
  start_state: string;
  final_states: string[];
}): NFASchema {
  const trans: NFASchema['transitions'] = {};

  // Initialise every state
  for (const s of raw.states) trans[s] = {};

  for (const t of raw.transitions) {
    const sym = normaliseEpsilon(t.label);    // '' for epsilon transitions
    if (!trans[t.from]) trans[t.from] = {};
    if (!trans[t.from][sym]) trans[t.from][sym] = [];
    if (!trans[t.from][sym].includes(t.to)) {
      trans[t.from][sym].push(t.to);
    }
  }

  // Build actual alphabet (exclude epsilon key '')
  const alphabet = raw.alphabet.length > 0
    ? raw.alphabet
    : [...new Set(
        raw.transitions
          .map(t => t.label)
          .filter(l => !isEpsilonLabel(l)),
      )].sort();

  return {
    type:         AutomatonType.NFA,
    states:       raw.states,
    alphabet,
    startState:   raw.start_state,
    acceptStates: raw.final_states,
    transitions:  trans,
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isEpsilonLabel(label: string): boolean {
  return ['eps', 'epsilon', 'λ', 'ε', ''].includes(label.trim().toLowerCase());
}

/** Map 'eps'/'epsilon'/'λ'/'ε' → '' (empty string = epsilon key in NFATransitions). */
export function normaliseEpsilon(label: string): string {
  return isEpsilonLabel(label) ? '' : label.trim();
}

/** True if the NFA has any ε-transitions. */
export function hasEpsilonTransitions(nfa: NFASchema): boolean {
  for (const charMap of Object.values(nfa.transitions)) {
    if ('' in charMap && (charMap['']?.length ?? 0) > 0) return true;
  }
  return false;
}

// ─── NFASchema → NFAResult bridge ────────────────────────────────────────────
// epsilon-elim.ts works on NFAResult (Thompson output type) which has the same
// shape as NFASchema — we just need to drop the `type` field.

function toNFAResult(nfa: NFASchema): NFAResult {
  return {
    states:       nfa.states,
    alphabet:     nfa.alphabet,
    startState:   nfa.startState,
    acceptStates: nfa.acceptStates,
    transitions:  nfa.transitions,
  };
}

function fromNFAResult(result: NFAResult): NFASchema {
  return {
    type:         AutomatonType.NFA,
    states:       result.states,
    alphabet:     result.alphabet,
    startState:   result.startState,
    acceptStates: result.acceptStates,
    transitions:  result.transitions,
  };
}

// ─── Public conversions ───────────────────────────────────────────────────────

/**
 * Remove all ε-transitions from an ε-NFA, returning an equivalent standard NFA.
 * Uses the existing eliminateEpsilon algorithm from epsilon-elim.ts.
 */
export function enfaToNfa(enfa: NFASchema): NFASchema {
  const result = eliminateEpsilon(toNFAResult(enfa));
  return fromNFAResult(result);
}

/**
 * Convert an ε-NFA (or plain NFA) directly to a minimal DFA.
 * Pipeline: eliminateEpsilon → nfaToDFA → minimizeDFA → enforceDeadState
 */
export function enfaToDfa(enfa: NFASchema): DFASchema {
  // Step 1: remove ε-transitions
  const nfaResult = eliminateEpsilon(toNFAResult(enfa));
  // Step 2: subset construction → DFA
  const rawDFA    = nfaToDFA(nfaResult);
  // Step 3: Hopcroft minimisation
  const minDFA    = minimizeDFA(rawDFA);
  // Step 4: ensure total function (add dead/trap state for missing transitions)
  return enforceDeadState(minDFA);
}

/**
 * Convert an ε-NFA to an NFA and then return a DFA-backed NFA
 * (used when the user requests "NFA" output from the DFA pipeline).
 */
export function enfaToNfaViaDfa(enfa: NFASchema): NFASchema {
  const dfa = enfaToDfa(enfa);
  return { ...dfaToNFA(dfa), type: AutomatonType.NFA };
}
