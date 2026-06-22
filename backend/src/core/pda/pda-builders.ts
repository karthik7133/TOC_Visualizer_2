import { AutomatonType, PDASchema, PDATransitionEntry } from '../../interfaces/schema.interface';

type Trans = Record<string, Record<string, PDATransitionEntry[]>>;

export function at(t: Trans, state: string, sym: string, entry: PDATransitionEntry) {
  (t[state] ??= {}); (t[state][sym] ??= []); t[state][sym].push(entry);
}

function pda(states: string[], alphabet: string[], stackAlphabet: string[], startState: string, acceptStates: string[], startStackSymbol: string, transitions: Trans): PDASchema {
  return { type: AutomatonType.PDA, states, alphabet, stackAlphabet, startState, acceptStates, startStackSymbol, transitions };
}

// Palindromes over alphabet (odd+even length)
export function buildPalindromePDA(alpha: string[]): PDASchema {
  const t: Trans = {};
  for (const a of alpha) {
    at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
    for (const top of alpha) at(t,'q0',a,{topOfStack:top,targetState:'q0',pushSymbols:[a,top]});
    // middle char (odd)
    at(t,'q0',a,{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
    for (const top of alpha) at(t,'q0',a,{topOfStack:top,targetState:'q1',pushSymbols:[top]});
    // match phase
    at(t,'q1',a,{topOfStack:a,targetState:'q1',pushSymbols:[]});
  }
  // ε midpoint (even)
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  for (const top of alpha) at(t,'q0','ε',{topOfStack:top,targetState:'q1',pushSymbols:[top]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],alpha,['Z',...alpha],'q0',['q2'],'Z',t);
}

// ww^R (even palindromes only)
export function buildWwrPDA(alpha: string[]): PDASchema {
  const t: Trans = {};
  for (const a of alpha) {
    at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
    for (const top of alpha) at(t,'q0',a,{topOfStack:top,targetState:'q0',pushSymbols:[a,top]});
    at(t,'q1',a,{topOfStack:a,targetState:'q1',pushSymbols:[]});
  }
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  for (const top of alpha) at(t,'q0','ε',{topOfStack:top,targetState:'q1',pushSymbols:[top]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],alpha,['Z',...alpha],'q0',['q2'],'Z',t);
}

// x^n y^n, minN=0 or 1
export function buildAnBnPDA(x: string, y: string, minN=1): PDASchema {
  const t: Trans = {};
  at(t,'q0',x,{topOfStack:'Z',targetState:'q0',pushSymbols:[x,'Z']});
  at(t,'q0',x,{topOfStack:x,targetState:'q0',pushSymbols:[x,x]});
  if (minN===0) at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:x,targetState:'q1',pushSymbols:[x]});
  at(t,'q1',y,{topOfStack:x,targetState:'q1',pushSymbols:[]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],[x,y],['Z',x],'q0',['q2'],'Z',t);
}

// x^n y^(k*n): push 1 per x, need k y's to pop each
export function buildAnKBnPDA(x: string, y: string, k: number): PDASchema {
  // States: q0 (push x's), q1..qk (count y's per X), qA (accept)
  // q0: push X per x
  // q1 --y--> q2 --y--> ... --y--> qk --y--> q1 (pop X each full cycle)
  // q1 ε (stack=Z) --> qA
  const states = ['q0'];
  for (let i = 1; i <= k; i++) states.push(`q${i}`);
  states.push('qA');

  const t: Trans = {};
  // q0: read x's, push X per x
  at(t,'q0',x,{topOfStack:'Z',targetState:'q0',pushSymbols:['X','Z']});
  at(t,'q0',x,{topOfStack:'X',targetState:'q0',pushSymbols:['X','X']});
  // ε: switch from push phase to match phase (need at least one X)
  at(t,'q0','ε',{topOfStack:'X',targetState:'q1',pushSymbols:['X']});

  // q1..qk-1: read one y, stay on same X, advance counter state
  for (let i = 1; i < k; i++) {
    at(t,`q${i}`,y,{topOfStack:'X',targetState:`q${i+1}`,pushSymbols:['X']});
  }
  // qk: read the k-th y, pop X, go back to q1 (for next X or accept)
  at(t,`q${k}`,y,{topOfStack:'X',targetState:'q1',pushSymbols:[]});

  // q1 ε when Z is on top: accept (all X's consumed)
  at(t,'q1','ε',{topOfStack:'Z',targetState:'qA',pushSymbols:['Z']});

  return pda(states,[x,y],['Z','X'],'q0',['qA'],'Z',t);
}

// x^(k*n) y^n: push k per x, pop 1 per y
export function buildKAnBnPDA(x: string, y: string, k: number): PDASchema {
  // q0: initial state; after reading x, go through qp1..qp(k-1) to push k X's per x
  // After all x's, ε to q1; q1: pop X per y; accept when Z on top.
  const states = ['q0'];
  for (let i = 1; i < k; i++) states.push(`qp${i}`);
  states.push('q1','q2');

  const t: Trans = {};

  if (k === 1) {
    // trivial: same as AnBnPDA
    at(t,'q0',x,{topOfStack:'Z',targetState:'q0',pushSymbols:['X','Z']});
    at(t,'q0',x,{topOfStack:'X',targetState:'q0',pushSymbols:['X','X']});
  } else {
    // First x: go from q0 to qp1 (no push yet)
    at(t,'q0',x,{topOfStack:'Z',targetState:'qp1',pushSymbols:['Z']});
    at(t,'q0',x,{topOfStack:'X',targetState:'qp1',pushSymbols:['X']});
    // Middle x's: advance counter qpi -> qp(i+1)
    for (let i = 1; i < k - 1; i++) {
      at(t,`qp${i}`,x,{topOfStack:'Z',targetState:`qp${i+1}`,pushSymbols:['Z']});
      at(t,`qp${i}`,x,{topOfStack:'X',targetState:`qp${i+1}`,pushSymbols:['X']});
    }
    // Last x of group: push X and return to q0
    at(t,`qp${k-1}`,x,{topOfStack:'Z',targetState:'q0',pushSymbols:['X','Z']});
    at(t,`qp${k-1}`,x,{topOfStack:'X',targetState:'q0',pushSymbols:['X','X']});
  }

  // ε from q0 to match phase (need at least one X pushed)
  at(t,'q0','ε',{topOfStack:'X',targetState:'q1',pushSymbols:['X']});
  // q1: pop X per y
  at(t,'q1',y,{topOfStack:'X',targetState:'q1',pushSymbols:[]});
  // q1 ε when Z on top: accept
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});

  return pda(states,[x,y],['Z','X'],'q0',['q2'],'Z',t);
}

// Equal counts (any order)
export function buildEqualCountPDA(a: string, b: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0',a,{topOfStack:b,targetState:'q0',pushSymbols:[]});
  at(t,'q0',b,{topOfStack:'Z',targetState:'q0',pushSymbols:[b,'Z']});
  at(t,'q0',b,{topOfStack:b,targetState:'q0',pushSymbols:[b,b]});
  at(t,'q0',b,{topOfStack:a,targetState:'q0',pushSymbols:[]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  return pda(['q0','q1'],[a,b],['Z',a,b],'q0',['q1'],'Z',t);
}

// n > m: strictly more a's than b's
export function buildMoreAPDA(a: string, b: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0',a,{topOfStack:b,targetState:'q0',pushSymbols:[]});
  at(t,'q0',b,{topOfStack:'Z',targetState:'q0',pushSymbols:[b,'Z']});
  at(t,'q0',b,{topOfStack:b,targetState:'q0',pushSymbols:[b,b]});
  at(t,'q0',b,{topOfStack:a,targetState:'q0',pushSymbols:[]});
  at(t,'q0','ε',{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  return pda(['q0','q1'],[a,b],['Z',a,b],'q0',['q1'],'Z',t);
}

// n >= m: at least as many a's as b's
export function buildAtLeastAPDA(a: string, b: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0',a,{topOfStack:b,targetState:'q0',pushSymbols:[]});
  at(t,'q0',b,{topOfStack:'Z',targetState:'q0',pushSymbols:[b,'Z']});
  at(t,'q0',b,{topOfStack:b,targetState:'q0',pushSymbols:[b,b]});
  at(t,'q0',b,{topOfStack:a,targetState:'q0',pushSymbols:[]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  return pda(['q0','q1'],[a,b],['Z',a,b],'q0',['q1'],'Z',t);
}

// n < m: strictly more b's than a's
export function buildMoreBPDA(a: string, b: string): PDASchema {
  return buildMoreAPDA(b,a);
}

// n <= m: at least as many b's as a's
export function buildAtLeastBPDA(a: string, b: string): PDASchema {
  return buildAtLeastAPDA(b,a);
}

// a^n b^n c^m: a^nb^n then any c's
export function buildAnBnCmPDA(a: string, b: string, c: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  at(t,'q1',b,{topOfStack:a,targetState:'q1',pushSymbols:[]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  at(t,'q2',c,{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],[a,b,c],['Z',a],'q0',['q2'],'Z',t);
}

// a^n b^m c^(n+m): push X per a and b, pop per c
export function buildAnBmCnmPDA(a: string, b: string, c: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:['X','Z']});
  at(t,'q0',a,{topOfStack:'X',targetState:'q0',pushSymbols:['X','X']});
  at(t,'q0',b,{topOfStack:'Z',targetState:'q0',pushSymbols:['X','Z']});
  at(t,'q0',b,{topOfStack:'X',targetState:'q0',pushSymbols:['X','X']});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:'X',targetState:'q1',pushSymbols:['X']});
  at(t,'q1',c,{topOfStack:'X',targetState:'q1',pushSymbols:[]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],[a,b,c],['Z','X'],'q0',['q2'],'Z',t);
}

// a^n b^m c^n: n a's, any b's, n c's (a's = c's)
export function buildAnBmCnPDA(a: string, b: string, c: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  at(t,'q1',b,{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q1',b,{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  at(t,'q1','ε',{topOfStack:a,targetState:'q2',pushSymbols:[a]});
  at(t,'q2',c,{topOfStack:a,targetState:'q2',pushSymbols:[]});
  at(t,'q2','ε',{topOfStack:'Z',targetState:'q3',pushSymbols:['Z']});
  return pda(['q0','q1','q2','q3'],[a,b,c],['Z',a],'q0',['q3'],'Z',t);
}

// xcx^R: palindrome with centre marker
export function buildCentreMarkedPDA(alpha: string[], centre: string): PDASchema {
  const t: Trans = {};
  for (const a of alpha) {
    at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
    for (const top of alpha) at(t,'q0',a,{topOfStack:top,targetState:'q0',pushSymbols:[a,top]});
    at(t,'q1',a,{topOfStack:a,targetState:'q1',pushSymbols:[]});
  }
  at(t,'q0',centre,{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  for (const top of alpha) at(t,'q0',centre,{topOfStack:top,targetState:'q1',pushSymbols:[top]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  return pda(['q0','q1','q2'],[...alpha,centre],['Z',...alpha],'q0',['q2'],'Z',t);
}

// a^n b^n c^m d^m
export function buildAnBnCmDmPDA(a: string, b: string, c: string, d: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',a,{topOfStack:'Z',targetState:'q0',pushSymbols:[a,'Z']});
  at(t,'q0',a,{topOfStack:a,targetState:'q0',pushSymbols:[a,a]});
  at(t,'q0','ε',{topOfStack:a,targetState:'q1',pushSymbols:[a]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  at(t,'q1',b,{topOfStack:a,targetState:'q1',pushSymbols:[]});
  at(t,'q1','ε',{topOfStack:'Z',targetState:'q2',pushSymbols:['Z']});
  at(t,'q2',c,{topOfStack:'Z',targetState:'q2',pushSymbols:[c,'Z']});
  at(t,'q2',c,{topOfStack:c,targetState:'q2',pushSymbols:[c,c]});
  at(t,'q2','ε',{topOfStack:c,targetState:'q3',pushSymbols:[c]});
  at(t,'q2','ε',{topOfStack:'Z',targetState:'q3',pushSymbols:['Z']});
  at(t,'q3',d,{topOfStack:c,targetState:'q3',pushSymbols:[]});
  at(t,'q3','ε',{topOfStack:'Z',targetState:'q4',pushSymbols:['Z']});
  return pda(['q0','q1','q2','q3','q4'],[a,b,c,d],['Z',a,c],'q0',['q4'],'Z',t);
}

// {a^i b^j c^k | i=j OR j=k, i,j,k >= 1}
// Nondeterministic union: two arms from q0 via ε-fork.
// Arm 1 (i=j): p0 -push a's-> p1 -pop b's-> p2 -require ≥1 c-> pA
// Arm 2 (j=k): r0 -require ≥1 a-> r1 -push b's-> r2 -pop c's-> rA
export function buildAiBjCk_iEqJ_or_jEqK_PDA(
  a = 'a', b = 'b', c = 'c'
): PDASchema {
  const t: Trans = {};

  // ── Arm 1: i = j (push a's, pop for b's, read ≥1 c's) ─────────────────────
  // p0: read a's (≥1), push each onto stack
  at(t,'p0',a,{topOfStack:'Z', targetState:'p0', pushSymbols:['A','Z']});
  at(t,'p0',a,{topOfStack:'A', targetState:'p0', pushSymbols:['A','A']});
  // ε: transition to pop-b phase (stack must have ≥1 A, enforcing i≥1)
  at(t,'p0','ε',{topOfStack:'A', targetState:'p1', pushSymbols:['A']});
  // p1: pop one A for each b
  at(t,'p1',b,{topOfStack:'A', targetState:'p1', pushSymbols:[]});
  // ε: done matching (stack must be empty down to Z only), go to c-reading phase
  at(t,'p1','ε',{topOfStack:'Z', targetState:'p2', pushSymbols:['Z']});
  // p2: read FIRST c (enforces k≥1) → go to p3
  at(t,'p2',c,{topOfStack:'Z', targetState:'p3', pushSymbols:['Z']});
  // p3: read remaining c's (0 or more) → stay in p3; then ε→pA
  at(t,'p3',c,{topOfStack:'Z', targetState:'p3', pushSymbols:['Z']});
  at(t,'p3','ε',{topOfStack:'Z', targetState:'pA', pushSymbols:['Z']});

  // ── Arm 2: j = k (read ≥1 a's, push b's, pop for c's) ─────────────────────
  // r0: read FIRST a (enforces i≥1) → go to r0b
  at(t,'r0',a,{topOfStack:'Z', targetState:'r0b', pushSymbols:['Z']});
  // r0b: read more a's (0 or more) → stay; then ε→r1
  at(t,'r0b',a,{topOfStack:'Z', targetState:'r0b', pushSymbols:['Z']});
  at(t,'r0b','ε',{topOfStack:'Z', targetState:'r1', pushSymbols:['Z']});
  // r1: read b's (≥1), push each onto stack
  at(t,'r1',b,{topOfStack:'Z', targetState:'r1', pushSymbols:['B','Z']});
  at(t,'r1',b,{topOfStack:'B', targetState:'r1', pushSymbols:['B','B']});
  // ε: done reading b's, go match c's (need ≥1 B on stack, enforcing j≥1)
  at(t,'r1','ε',{topOfStack:'B', targetState:'r2', pushSymbols:['B']});
  // r2: pop one B for each c
  at(t,'r2',c,{topOfStack:'B', targetState:'r2', pushSymbols:[]});
  // accept when all B's consumed (only Z left)
  at(t,'r2','ε',{topOfStack:'Z', targetState:'rA', pushSymbols:['Z']});

  // ── Fork state: q0 ε-forks into p0 (arm1) or r0 (arm2) ────────────────────
  at(t,'q0','ε',{topOfStack:'Z', targetState:'p0', pushSymbols:['Z']});
  at(t,'q0','ε',{topOfStack:'Z', targetState:'r0', pushSymbols:['Z']});

  const states = ['q0','p0','p1','p2','p3','pA','r0','r0b','r1','r2','rA'];
  return pda(
    states, [a,b,c], ['Z','A','B'], 'q0', ['pA','rA'], 'Z', t
  );
}


// Balanced parentheses
export function buildBalancedPDA(open: string, close: string): PDASchema {
  const t: Trans = {};
  at(t,'q0',open,{topOfStack:'Z',targetState:'q0',pushSymbols:['P','Z']});
  at(t,'q0',open,{topOfStack:'P',targetState:'q0',pushSymbols:['P','P']});
  at(t,'q0',close,{topOfStack:'P',targetState:'q0',pushSymbols:[]});
  at(t,'q0','ε',{topOfStack:'Z',targetState:'q1',pushSymbols:['Z']});
  return pda(['q0','q1'],[open,close],['Z','P'],'q0',['q1'],'Z',t);
}
