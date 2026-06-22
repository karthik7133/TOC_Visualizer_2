/**
 * Turing Machine Validator
 * Checks AI-generated TM JSON for non-deterministic conflicts and structural errors.
 */
import { TMSchema } from '../../interfaces/schema.interface';

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

export function validateTM(tm: TMSchema): ValidationResult {
  const errors: string[] = [];
  const stateSet    = new Set(tm.states);
  const tapeAlpha   = new Set(tm.tapeAlphabet);

  // 1. Start / accept / reject states must exist
  if (!stateSet.has(tm.startState))  errors.push(`startState "${tm.startState}" not in states.`);
  if (!stateSet.has(tm.acceptState)) errors.push(`acceptState "${tm.acceptState}" not in states.`);
  if (!stateSet.has(tm.rejectState)) errors.push(`rejectState "${tm.rejectState}" not in states.`);

  // 2. Blank symbol must be in tape alphabet
  if (!tapeAlpha.has(tm.blankSymbol))
    errors.push(`blankSymbol "${tm.blankSymbol}" not in tapeAlphabet.`);

  // 3. Input alphabet must be a subset of tape alphabet
  for (const sym of tm.alphabet)
    if (!tapeAlpha.has(sym))
      errors.push(`Input symbol "${sym}" not in tapeAlphabet.`);

  // 4. Transition checks
  for (const [state, readMap] of Object.entries(tm.transitions)) {
    if (!stateSet.has(state))
      errors.push(`Transition source state "${state}" not in states.`);

    const seenSymbols = new Set<string>();
    for (const [readSym, entry] of Object.entries(readMap)) {
      // Non-determinism check (duplicate read symbol in same state)
      if (seenSymbols.has(readSym))
        errors.push(`Non-deterministic conflict: state "${state}" has duplicate read symbol "${readSym}".`);
      seenSymbols.add(readSym);

      // Target state must exist
      if (!stateSet.has(entry.targetState))
        errors.push(`Transition (${state}, ${readSym}) targets unknown state "${entry.targetState}".`);

      // Write symbol must be in tape alphabet
      if (!tapeAlpha.has(entry.writeSymbol))
        errors.push(`Transition (${state}, ${readSym}) writes unknown symbol "${entry.writeSymbol}".`);

      // Direction must be L, R, or S
      if (!['L', 'R', 'S'].includes(entry.direction))
        errors.push(`Transition (${state}, ${readSym}) has invalid direction "${entry.direction}".`);
    }
  }

  return { valid: errors.length === 0, errors };
}
