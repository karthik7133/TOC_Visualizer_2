/**
 * Thompson's Construction — Regex → ε-NFA
 *
 * Pipeline:
 *   1. Tokenize the regex string
 *   2. Insert explicit concatenation (·) operators
 *   3. Shunting-Yard → postfix notation
 *   4. Build NFA fragments bottom-up from the postfix stack
 */

// ─── Types ────────────────────────────────────────────────────────────────────

interface NFAEdge {
  to: string;
  /** Empty string = epsilon transition */
  label: string;
}

interface NFAFragment {
  start: string;
  accept: string;
}

type TokenType =
  | 'CHAR' | 'STAR' | 'PLUS' | 'QUESTION'
  | 'PIPE' | 'LPAREN' | 'RPAREN' | 'CONCAT';

interface Token {
  type: TokenType;
  value: string;
}

export interface NFAResult {
  states: string[];
  alphabet: string[];
  startState: string;
  acceptStates: string[];
  /** transitions[state][label] = string[] */
  transitions: Record<string, Record<string, string[]>>;
}

// ─── State factory ────────────────────────────────────────────────────────────

let _counter = 0;
function resetCounter() { _counter = 0; }
function freshState(): string { return `q${_counter++}`; }

// ─── Graph helpers ────────────────────────────────────────────────────────────

const graph = new Map<string, NFAEdge[]>();

function addState(id: string) {
  if (!graph.has(id)) graph.set(id, []);
}

function addEdge(from: string, to: string, label: string) {
  graph.get(from)!.push({ to, label });
}

function makeFragment(startId: string, acceptId: string): NFAFragment {
  return { start: startId, accept: acceptId };
}

// ─── Tokenizer ────────────────────────────────────────────────────────────────

function tokenize(regex: string): Token[] {
  const tokens: Token[] = [];
  let i = 0;
  while (i < regex.length) {
    const ch = regex[i];
    if (ch === '\\' && i + 1 < regex.length) {
      tokens.push({ type: 'CHAR', value: regex[++i] });
    } else {
      const map: Record<string, TokenType> = {
        '*': 'STAR', '+': 'PLUS', '?': 'QUESTION',
        '|': 'PIPE', '(': 'LPAREN', ')': 'RPAREN',
      };
      tokens.push({ type: map[ch] ?? 'CHAR', value: ch });
    }
    i++;
  }
  return tokens;
}

// ─── Insert explicit concatenation operator ───────────────────────────────────

function insertConcat(tokens: Token[]): Token[] {
  const result: Token[] = [];
  const concatDot: Token = { type: 'CONCAT', value: '·' };

  const isRightOperand = (t: Token) =>
    t.type === 'CHAR' || t.type === 'LPAREN';
  const isLeftOperand  = (t: Token) =>
    t.type === 'CHAR' || t.type === 'STAR' || t.type === 'PLUS' ||
    t.type === 'QUESTION' || t.type === 'RPAREN';

  for (let i = 0; i < tokens.length; i++) {
    result.push(tokens[i]);
    if (i + 1 < tokens.length && isLeftOperand(tokens[i]) && isRightOperand(tokens[i + 1])) {
      result.push(concatDot);
    }
  }
  return result;
}

// ─── Shunting-Yard → postfix ──────────────────────────────────────────────────

const PREC: Record<string, number> = { PIPE: 1, CONCAT: 2, STAR: 3, PLUS: 3, QUESTION: 3 };

function toPostfix(tokens: Token[]): Token[] {
  const output: Token[] = [];
  const opStack: Token[] = [];

  for (const tok of tokens) {
    if (tok.type === 'CHAR') {
      output.push(tok);
    } else if (tok.type === 'LPAREN') {
      opStack.push(tok);
    } else if (tok.type === 'RPAREN') {
      while (opStack.length && opStack[opStack.length - 1].type !== 'LPAREN') {
        output.push(opStack.pop()!);
      }
      opStack.pop(); // discard '('
    } else {
      const p = PREC[tok.type] ?? 0;
      while (
        opStack.length &&
        opStack[opStack.length - 1].type !== 'LPAREN' &&
        (PREC[opStack[opStack.length - 1].type] ?? 0) >= p
      ) {
        output.push(opStack.pop()!);
      }
      opStack.push(tok);
    }
  }
  while (opStack.length) output.push(opStack.pop()!);
  return output;
}

// ─── NFA Fragment Construction ────────────────────────────────────────────────

function buildNFA(postfix: Token[]): NFAFragment {
  const stack: NFAFragment[] = [];

  for (const tok of postfix) {
    if (tok.type === 'CHAR') {
      // Single-character fragment: s --[ch]--> a
      const s = freshState(); addState(s);
      const a = freshState(); addState(a);
      addEdge(s, a, tok.value);
      stack.push(makeFragment(s, a));

    } else if (tok.type === 'CONCAT') {
      // a.accept --ε--> b.start
      const b = stack.pop()!;
      const a = stack.pop()!;
      addEdge(a.accept, b.start, '');
      stack.push(makeFragment(a.start, b.accept));

    } else if (tok.type === 'PIPE') {
      // New start with ε to both; both accepts ε to new accept
      const b = stack.pop()!;
      const a = stack.pop()!;
      const s = freshState(); addState(s);
      const f = freshState(); addState(f);
      addEdge(s, a.start, ''); addEdge(s, b.start, '');
      addEdge(a.accept, f, ''); addEdge(b.accept, f, '');
      stack.push(makeFragment(s, f));

    } else if (tok.type === 'STAR') {
      const a = stack.pop()!;
      const s = freshState(); addState(s);
      const f = freshState(); addState(f);
      addEdge(s, a.start, ''); addEdge(s, f, '');
      addEdge(a.accept, a.start, ''); addEdge(a.accept, f, '');
      stack.push(makeFragment(s, f));

    } else if (tok.type === 'PLUS') {
      // a followed by a* : must match at least once
      const a = stack.pop()!;
      const s = freshState(); addState(s);
      const f = freshState(); addState(f);
      addEdge(s, a.start, '');
      addEdge(a.accept, a.start, '');
      addEdge(a.accept, f, '');
      stack.push(makeFragment(s, f));

    } else if (tok.type === 'QUESTION') {
      const a = stack.pop()!;
      const s = freshState(); addState(s);
      const f = freshState(); addState(f);
      addEdge(s, a.start, ''); addEdge(s, f, '');
      addEdge(a.accept, f, '');
      stack.push(makeFragment(s, f));
    }
  }

  if (stack.length !== 1) throw new Error('Invalid regex — could not reduce to a single NFA fragment.');
  return stack[0];
}

// ─── Public API ───────────────────────────────────────────────────────────────

export function regexToNFA(regex: string): NFAResult {
  // Reset global state
  resetCounter();
  graph.clear();

  const tokens  = tokenize(regex);
  const concat  = insertConcat(tokens);
  const postfix = toPostfix(concat);
  const frag    = buildNFA(postfix);

  const transitions: Record<string, Record<string, string[]>> = {};
  const alphabet   = new Set<string>();

  for (const [state, edges] of graph.entries()) {
    transitions[state] = {};
    for (const edge of edges) {
      if (edge.label !== '') alphabet.add(edge.label);
      (transitions[state][edge.label] ??= []).push(edge.to);
    }
  }

  return {
    states:       Array.from(graph.keys()),
    alphabet:     Array.from(alphabet),
    startState:   frag.start,
    acceptStates: [frag.accept],
    transitions,
  };
}
