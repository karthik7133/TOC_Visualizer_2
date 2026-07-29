/**
 * Shared type declarations mirroring backend/src/interfaces/schema.interface.ts
 * Kept in sync manually — the frontend consumes these via the API, not imports.
 */

export enum AutomatonType {
  DFA = 'DFA',
  NFA = 'NFA',
  PDA = 'PDA',
  TM  = 'TM',
}

export type InputType = 'natural-language' | 'regex' | 'cfg' | 'pda-json' | 'tm-json' | 'image';

export type DFATransitions = Record<string, Record<string, string>>;
export type NFATransitions = Record<string, Record<string, string[]>>;

export interface PDATransitionEntry {
  topOfStack:  string;
  targetState: string;
  pushSymbols: string[];
}
export type PDATransitions = Record<string, Record<string, PDATransitionEntry[]>>;

export type TMDirection = 'L' | 'R' | 'S';
export interface TMTransitionEntry {
  targetState: string;
  writeSymbol: string;
  direction:   TMDirection;
}
export type TMTransitions = Record<string, Record<string, TMTransitionEntry>>;

export interface DFASchema {
  type: AutomatonType.DFA;
  regex?: string;
  states: string[]; alphabet: string[];
  startState: string; acceptStates: string[];
  transitions: DFATransitions;
}
export interface NFASchema {
  type: AutomatonType.NFA;
  regex?: string;
  states: string[]; alphabet: string[];
  startState: string; acceptStates: string[];
  transitions: NFATransitions;
}
export interface PDASchema {
  type: AutomatonType.PDA;
  states: string[]; alphabet: string[]; stackAlphabet: string[];
  startState: string; acceptStates: string[];
  startStackSymbol: string; transitions: PDATransitions;
}
export interface TMSchema {
  type: AutomatonType.TM;
  states: string[]; alphabet: string[]; tapeAlphabet: string[];
  startState: string; acceptState: string; rejectState: string;
  blankSymbol: string; transitions: TMTransitions;
}

export type AutomatonSchema = DFASchema | NFASchema | PDASchema | TMSchema;

export interface TapeSnapshot {
  tape: string[];
  headPosition: number;
}

export interface SimulationStep {
  stepIndex: number;
  state: string;
  symbol: string | null;
  edgeId: string | null;
  memorySnapshot: string[] | TapeSnapshot | null;
  accepted: boolean;
  rejected: boolean;
}
