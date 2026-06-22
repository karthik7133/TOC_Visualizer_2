// ─── Automaton Type Enum ──────────────────────────────────────────────────────

export enum AutomatonType {
  DFA = 'DFA',
  NFA = 'NFA',
  PDA = 'PDA',
  TM  = 'TM',
}

// ─── DFA ─────────────────────────────────────────────────────────────────────

/** transitions[state][char] = nextState */
export type DFATransitions = Record<string, Record<string, string>>;

export interface DFASchema {
  type: AutomatonType.DFA;
  states: string[];
  alphabet: string[];
  startState: string;
  acceptStates: string[];
  transitions: DFATransitions;
}

// ─── NFA ─────────────────────────────────────────────────────────────────────

/** transitions[state][char | ''] = string[] (epsilon = '') */
export type NFATransitions = Record<string, Record<string, string[]>>;

export interface NFASchema {
  type: AutomatonType.NFA;
  states: string[];
  alphabet: string[];
  startState: string;
  acceptStates: string[];
  transitions: NFATransitions;
}

// ─── PDA ─────────────────────────────────────────────────────────────────────

export interface PDATransitionEntry {
  /** Symbol to pop from stack top ('ε' for no-pop) */
  topOfStack: string;
  targetState: string;
  /** Symbols to push (in order, bottom first; empty = pop only) */
  pushSymbols: string[];
}

/** transitions[state][inputChar | 'ε'] = PDATransitionEntry[] */
export type PDATransitions = Record<string, Record<string, PDATransitionEntry[]>>;

export interface PDASchema {
  type: AutomatonType.PDA;
  states: string[];
  alphabet: string[];
  stackAlphabet: string[];
  startState: string;
  acceptStates: string[];
  startStackSymbol: string;
  transitions: PDATransitions;
}

// ─── Turing Machine ───────────────────────────────────────────────────────────

export type TMDirection = 'L' | 'R' | 'S';

export interface TMTransitionEntry {
  targetState: string;
  writeSymbol: string;
  direction: TMDirection;
}

/** transitions[state][readSymbol] = TMTransitionEntry (deterministic) */
export type TMTransitions = Record<string, Record<string, TMTransitionEntry>>;

export interface TMSchema {
  type: AutomatonType.TM;
  states: string[];
  alphabet: string[];
  tapeAlphabet: string[];
  startState: string;
  acceptState: string;
  rejectState: string;
  blankSymbol: string;
  transitions: TMTransitions;
}

// ─── Union ────────────────────────────────────────────────────────────────────

export type AutomatonSchema = DFASchema | NFASchema | PDASchema | TMSchema;

// ─── API Request / Response Shapes ───────────────────────────────────────────

export type InputType = 'natural-language' | 'regex' | 'cfg' | 'pda-json' | 'tm-json' | 'image';

export interface GenerateRequest {
  inputType: InputType;
  machineType: AutomatonType;
  input: string;
}

export interface GenerateResponse {
  automaton: AutomatonSchema;
}

// ─── Image Scan ───────────────────────────────────────────────────────────────

/** Flat transition as returned by the vision model before normalisation */
export interface RawImageTransition {
  from:  string;
  to:    string;
  label: string;
}

/** Raw vision model output (before converting to NFASchema) */
export interface ImageAutomatonRaw {
  states:       string[];
  alphabet:     string[];
  transitions:  RawImageTransition[];
  start_state:  string;
  final_states: string[];
}

/** Response from POST /api/scan-image */
export interface ScanImageResponse {
  /** ε-NFA (or plain NFA/DFA) extracted from the image, ready to visualise */
  automaton:  NFASchema;
  /** True if the automaton has ε-transitions — shows conversion buttons in UI */
  hasEpsilon: boolean;
  /** Raw JSON as returned by the vision model, for debugging */
  raw:        ImageAutomatonRaw;
}

/** Request body for POST /api/convert */
export interface ConvertRequest {
  automaton: NFASchema;
  target:    'nfa' | 'dfa';
}

/** Response from POST /api/convert */
export interface ConvertResponse {
  automaton: NFASchema | DFASchema;
}

// ─── Simulation ───────────────────────────────────────────────────────────────

export interface TapeSnapshot {
  tape: string[];
  headPosition: number;
}

export interface SimulationStep {
  stepIndex: number;
  /** Active state at this step */
  state: string;
  /** Symbol consumed (null for epsilon / TM internal) */
  symbol: string | null;
  /** ID of the edge crossed (for GraphCanvas highlight) */
  edgeId: string | null;
  /** PDA stack snapshot OR TM tape snapshot */
  memorySnapshot: string[] | TapeSnapshot | null;
  accepted: boolean;
  rejected: boolean;
}

export interface SimulateRequest {
  automaton: AutomatonSchema;
  inputString: string;
}

export interface SimulateResponse {
  steps: SimulationStep[];
  accepted: boolean;
}
