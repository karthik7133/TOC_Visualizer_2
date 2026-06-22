/**
 * Natural Language → PDA Matcher
 *
 * Deterministically maps natural language / LaTeX / set-builder descriptions
 * of well-known context-free languages to provably-correct PDA constructions.
 *
 * Strategy:
 *   1. Normalise input  — strip LaTeX, lowercase, collapse whitespace.
 *   2. Run each category detector in priority order.
 *   3. Return the matching hardcoded PDA, or null to let the AI pipeline handle it.
 *
 * Adding a new language:
 *   • Add a builder in pda-builders.ts
 *   • Add one clearly-named detector section here
 *   • List all reasonable notation variants in comments
 */

import { PDASchema } from '../../interfaces/schema.interface';
import {
  buildPalindromePDA, buildWwrPDA, buildAnBnPDA,
  buildAnKBnPDA, buildKAnBnPDA,
  buildEqualCountPDA, buildMoreAPDA, buildMoreBPDA,
  buildAtLeastAPDA, buildAtLeastBPDA,
  buildAnBnCmPDA, buildAnBmCnmPDA, buildAnBmCnPDA,
  buildCentreMarkedPDA, buildAnBnCmDmPDA, buildBalancedPDA,
  buildAiBjCk_iEqJ_or_jEqK_PDA,
} from './pda-builders';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function log(msg: string) { console.log(`[NL→PDA] ${msg}`); }

/**
 * Normalise an arbitrary user prompt into a clean lowercase string.
 *
 * Handles:
 *   - LaTeX commands:  \text{or} → "or",  \mid → "|",  \ge → ">=", etc.
 *   - Math delimiters: $, {, }  removed
 *   - Subscript notation: n_a → na,  |w|_a → wa  (for count detection)
 *   - Unicode: ≥ → >=,  ≤ → <=,  ε → e,  ∈ → in
 */
function normalise(desc: string): string {
  return desc
    // LaTeX text blocks first (before removing backslash commands)
    .replace(/\\text\s*\{([^}]*)\}/g, ' $1 ')
    .replace(/\\mathrm\s*\{([^}]*)\}/g, ' $1 ')
    // Common LaTeX math operators
    .replace(/\\mid\b/g, ' | ')
    .replace(/\\ge\b/g, ' >= ')
    .replace(/\\geq\b/g, ' >= ')
    .replace(/\\le\b/g, ' <= ')
    .replace(/\\leq\b/g, ' <= ')
    .replace(/\\neq\b/g, ' != ')
    .replace(/\\ne\b/g, ' != ')
    .replace(/\\cdot\b/g, ' * ')
    .replace(/\\times\b/g, ' * ')
    .replace(/\\in\b/g, ' in ')
    .replace(/\\cup\b/g, ' or ')
    .replace(/\\cap\b/g, ' and ')
    .replace(/\\epsilon\b|\\varepsilon\b/g, ' e ')
    .replace(/\\lambda\b/g, ' e ')
    .replace(/\\Sigma\b/g, ' sigma ')
    // Remove remaining LaTeX commands (word commands like \frac, \cup, etc.)
    .replace(/\\[a-zA-Z]+[*]?/g, ' ')
    // Remove LaTeX brace escapes: \{ \} \| and lone backslashes
    .replace(/\\[^a-zA-Z\s]/g, ' ')
    // Math delimiters — keep ^ so a^n b^{2n} → a^n b^2n (not a n b 2n)
    .replace(/[${}]/g, ' ')
    // Unicode symbols
    .replace(/[≥]/g, ' >= ')
    .replace(/[≤]/g, ' <= ')
    .replace(/[≠]/g, ' != ')
    .replace(/[∈]/g, ' in ')
    .replace(/[∪]/g, ' or ')
    .replace(/[∩]/g, ' and ')
    .replace(/[ε]/g, ' e ')
    // Subscript count notations: n_a(w), |w|_a, #a  → keep recognisable
    // (keep underscores for later regex matching)
    // Cleanup
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .trim();
}

/** Extract single-character alphabet from a description */
function extractAlphabet(d: string): string[] {
  // Try {a, b, ...} notation
  const m = d.match(/\{\s*([^}]+)\s*\}/);
  if (m) {
    const candidates = m[1].split(/[,\s]+/).map(s => s.trim()).filter(s => s.length === 1);
    if (candidates.length >= 1) return [...new Set(candidates)];
  }
  return [];
}

/** Find what single alphabet symbols appear in a^? b^? c^? style */
function extractSymbolsFromExponents(d: string): string[] {
  const matches = [...d.matchAll(/([a-z0-9])\s*\^/g)];
  return [...new Set(matches.map(m => m[1]))];
}

// ─── Main Matcher ─────────────────────────────────────────────────────────────

export function matchNLtoPDA(desc: string): PDASchema | null {
  const d = normalise(desc);
  const alpha = extractAlphabet(d);

  // ===========================================================================
  // 1. PALINDROMES
  //    Notations: "palindrome", "w = w^R", "w equals its reverse",
  //               "reverse of w equals w", "w reversed"
  // ===========================================================================
  if (
    /palindrome/.test(d) ||
    /w\s*=\s*w\s*\^?\s*r\b/.test(d) ||
    /equals?\s+its\s+reverse/.test(d) ||
    /reverse\s+of\s+w\s+equals?\s+w/.test(d) ||
    /w\s+reversed/.test(d)
  ) {
    const a = alpha.length >= 2 ? alpha : /binary|0.*1/.test(d) ? ['0','1'] : ['a','b'];
    log(`Palindromes over {${a}}`); return buildPalindromePDA(a);
  }

  // ===========================================================================
  // 2. ww^R  (even-length palindromes only)
  //    Notations: "ww^R", "ww reverse", "even palindrome", "of the form ww^r"
  // ===========================================================================
  if (
    /ww\s*\^?\s*r\b/.test(d) ||
    /ww\s+reverse/.test(d) ||
    /even.{0,20}palindrome/.test(d) ||
    /of\s+the\s+form\s+ww/.test(d)
  ) {
    const a = alpha.length >= 2 ? alpha : ['a','b'];
    log(`ww^R over {${a}}`); return buildWwrPDA(a);
  }

  // ===========================================================================
  // 3. CENTRE-MARKED PALINDROME  xcx^R
  //    Notations: "centre marker", "center marked", "middle mark", xcx^R
  // ===========================================================================
  if (/centre|center|middle\s*mark|marked\s*palindrome|xcx/.test(d)) {
    const centreMatch = d.match(/marker[^\w]*['"]?([a-z0-9])['"]?/);
    const centre = centreMatch?.[1] ?? 'c';
    const a = alpha.filter(s => s !== centre).length >= 1
      ? alpha.filter(s => s !== centre) : ['a','b'];
    log(`Centre-marked xcx^R, centre=${centre}`); return buildCentreMarkedPDA(a, centre);
  }

  // ===========================================================================
  // 4. BALANCED BRACKETS
  //    Notations: "balanced parentheses", "balanced brackets", "matching braces",
  //               "properly nested", "Dyck language"
  // ===========================================================================
  if (
    /balanced\s+(?:parenthes|bracket|paren|brace|square)/.test(d) ||
    /properly\s+nested/.test(d) ||
    /matching\s+(?:parenthes|bracket|brace)/.test(d) ||
    /dyck/.test(d)
  ) {
    const [o, c] = /curly|brace|\{/.test(d) ? ['{','}']
                 : /square|\[/.test(d)       ? ['[',']']
                 : ['(',')'];
    log(`Balanced ${o}${c}`); return buildBalancedPDA(o, c);
  }

  // ===========================================================================
  // 5. EQUAL COUNTS  —  #a = #b, n_a(w) = n_b(w), equal number of a's and b's
  //    This is extremely common in textbooks — match it very broadly.
  //
  //    Notations:
  //      n_a(w) = n_b(w),  n_a = n_b
  //      #a = #b,  #(a) = #(b)
  //      |w|_a = |w|_b
  //      count of a = count of b
  //      equal number of a's and b's
  //      same number of a and b
  //      number of a's equals number of b's
  //      strings with as many a's as b's
  //      w has equal a's and b's
  // ===========================================================================
  {
    // n_x(w) = n_y(w)  or  n_x = n_y  (any surrounding parens/args)
    const nxMatch = d.match(/n_([a-z0-9])\s*(?:\([^)]*\))?\s*=\s*n_([a-z0-9])\s*(?:\([^)]*\))?/);
    if (nxMatch && nxMatch[1] !== nxMatch[2]) {
      log(`n_${nxMatch[1]} = n_${nxMatch[2]} (equal counts)`);
      return buildEqualCountPDA(nxMatch[1], nxMatch[2]);
    }

    // #x = #y  or  #(x) = #(y)
    const hashMatch = d.match(/#\s*\(?\s*([a-z0-9])\s*\)?\s*=\s*#\s*\(?\s*([a-z0-9])\s*\)?/);
    if (hashMatch && hashMatch[1] !== hashMatch[2]) {
      log(`#${hashMatch[1]} = #${hashMatch[2]} (equal counts)`);
      return buildEqualCountPDA(hashMatch[1], hashMatch[2]);
    }

    // |w|_x = |w|_y  (word-length subscript notation)
    const wlMatch = d.match(/\|w\|_([a-z0-9])\s*=\s*\|w\|_([a-z0-9])/);
    if (wlMatch && wlMatch[1] !== wlMatch[2]) {
      log(`|w|_${wlMatch[1]} = |w|_${wlMatch[2]} (equal counts)`);
      return buildEqualCountPDA(wlMatch[1], wlMatch[2]);
    }

    // English: "equal number/count of X and Y", "same number/count of X and Y"
    const engEq = d.match(
      /(?:equal|same)\s+(?:number|count|occurrences?)\s+of\s+([a-z0-9])['s]*\s+and\s+([a-z0-9])/
    );
    if (engEq) {
      log(`equal counts of ${engEq[1]} and ${engEq[2]}`);
      return buildEqualCountPDA(engEq[1], engEq[2]);
    }

    // English: "number of X's equals number of Y's" / "X's equal Y's count"
    const engEq2 = d.match(
      /(?:number|count)\s+of\s+([a-z0-9])['s]*\s+(?:equals?|is\s+(?:equal\s+to|the\s+same\s+as))\s+(?:(?:number|count)\s+of\s+)?([a-z0-9])/
    );
    if (engEq2) {
      log(`count of ${engEq2[1]} equals count of ${engEq2[2]}`);
      return buildEqualCountPDA(engEq2[1], engEq2[2]);
    }

    // English: "as many X's as Y's" / "X's equal to Y's"
    const engEq3 = d.match(/as\s+many\s+([a-z0-9])['s]*\s+as\s+([a-z0-9])/);
    if (engEq3) {
      log(`as many ${engEq3[1]}s as ${engEq3[2]}s (equal counts)`);
      return buildEqualCountPDA(engEq3[1], engEq3[2]);
    }

    // English: "equal a's and b's" / "equal number of a and b"
    const engEq4 = d.match(/equal\s+([a-z0-9])['s]*\s+and\s+([a-z0-9])/);
    if (engEq4) {
      log(`equal ${engEq4[1]}s and ${engEq4[2]}s`);
      return buildEqualCountPDA(engEq4[1], engEq4[2]);
    }

    // Symbolic: |a| = |b|
    if (/\|a\|\s*=\s*\|b\|/.test(d)) {
      log('equal counts a,b'); return buildEqualCountPDA('a','b');
    }
  }

  // ===========================================================================
  // 6. MORE X THAN Y  /  n > m
  //    Notations: "more a's than b's", "a's exceed b's", "a outnumbers b",
  //               "n > m" with ^n and ^m exponents
  // ===========================================================================
  {
    const mMore = d.match(
      /more\s+([a-z0-9])['s]*\s+than\s+([a-z0-9])|([a-z0-9])['s]*\s+(?:exceed|outnumber)\s+([a-z0-9])/
    );
    if (mMore) {
      const a = mMore[1] ?? mMore[3], b = mMore[2] ?? mMore[4];
      log(`more ${a}s than ${b}s`); return buildMoreAPDA(a, b);
    }
    if (/n\s*>\s*m/.test(d) && /\^n/.test(d) && /\^m/.test(d)) {
      const xm = d.match(/([a-z0-9])\s*\^n/), ym = d.match(/([a-z0-9])\s*\^m/);
      if (xm && ym) { log(`${xm[1]}^n ${ym[1]}^m n>m`); return buildMoreAPDA(xm[1], ym[1]); }
    }
    // fewer / less
    if (/fewer\s+([a-z0-9])|less\s+([a-z0-9])|n\s*<\s*m/.test(d)) {
      const xm = d.match(/([a-z0-9])\s*\^n/), ym = d.match(/([a-z0-9])\s*\^m/);
      if (xm && ym) { log(`${xm[1]}^n ${ym[1]}^m n<m`); return buildMoreBPDA(xm[1], ym[1]); }
    }
  }

  // ===========================================================================
  // 7. AT LEAST AS MANY X AS Y  /  n >= m
  // ===========================================================================
  {
    const mGe = d.match(/at\s+least\s+as\s+many\s+([a-z0-9])['s]*\s+as\s+([a-z0-9])/);
    if (mGe) { log(`#${mGe[1]} >= #${mGe[2]}`); return buildAtLeastAPDA(mGe[1], mGe[2]); }
    if (/n\s*>=\s*m/.test(d) && /\^n/.test(d) && /\^m/.test(d)) {
      const xm = d.match(/([a-z0-9])\s*\^n/), ym = d.match(/([a-z0-9])\s*\^m/);
      if (xm && ym) { log(`${xm[1]}^n ${ym[1]}^m n>=m`); return buildAtLeastAPDA(xm[1], ym[1]); }
    }
    if (/n\s*<=\s*m/.test(d) && /\^n/.test(d) && /\^m/.test(d)) {
      const xm = d.match(/([a-z0-9])\s*\^n/), ym = d.match(/([a-z0-9])\s*\^m/);
      if (xm && ym) { log(`${xm[1]}^n ${ym[1]}^m n<=m`); return buildAtLeastBPDA(xm[1], ym[1]); }
    }
  }

  // ===========================================================================
  // 8. UNION CONDITION  —  {a^i b^j c^k | i=j OR j=k}
  //    Notations: "i = j or j = k", "i=j or j=k",
  //               "i equals j or j equals k"
  //    Uses index-variable set [ijknmp] to avoid matching alphabet letters.
  // ===========================================================================
  {
    const IDX = '[ijknmp]';
    const unionRe = new RegExp(
      `(${IDX})\\s*=\\s*(${IDX})\\s+or\\s+(${IDX})\\s*=\\s*(${IDX})` +
      `|(${IDX})\\s+equals?\\s+(${IDX})\\s+or\\s+(${IDX})\\s+equals?\\s+(${IDX})`
    );
    const um = d.match(unionRe);
    if (um) {
      const i1 = um[1] ?? um[5], j1 = um[2] ?? um[6];
      const j2 = um[3] ?? um[7], k2 = um[4] ?? um[8];
      // Detect three-symbol order: a^i b^j c^k
      const symMatch = d.match(
        /([a-z0-9])\s*\^\s*(?:i|n).*?([a-z0-9])\s*\^\s*(?:j|m).*?([a-z0-9])\s*\^\s*(?:k|p)/
      );
      const sa = symMatch?.[1] ?? 'a';
      const sb = symMatch?.[2] ?? 'b';
      const sc = symMatch?.[3] ?? 'c';
      log(`Union PDA: ${sa}^i ${sb}^j ${sc}^k, ${i1}=${j1} or ${j2}=${k2}`);
      return buildAiBjCk_iEqJ_or_jEqK_PDA(sa, sb, sc);
    }
  }

  // ===========================================================================
  // 9. FOUR-SYMBOL  a^n b^n c^m d^m
  //    Notations: "a^n b^n c^m d^m"
  // ===========================================================================
  {
    const m4 = d.match(/([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^m\s*([a-z0-9])\s*\^m/);
    if (m4) { log(`${m4[1]}^n ${m4[2]}^n ${m4[3]}^m ${m4[4]}^m`); return buildAnBnCmDmPDA(m4[1],m4[2],m4[3],m4[4]); }
  }

  // ===========================================================================
  // 10. THREE-SYMBOL  a^n b^m c^(n+m)
  //     Notations: "a^n b^m c^(n+m)", "c^(n+m)", "n+m c's"
  // ===========================================================================
  if (/c\s*\^\s*\(\s*n\s*\+\s*m\s*\)|c\s*\^\s*n\s*\+\s*m|n\s*\+\s*m\s*c/.test(d)) {
    const m3 = d.match(/([a-z0-9])\s*\^n.*?([a-z0-9])\s*\^m.*?([a-z0-9])\s*\^\s*[(\s]*n\s*\+\s*m/);
    const a = m3?.[1] ?? 'a', b = m3?.[2] ?? 'b', c = m3?.[3] ?? 'c';
    log(`${a}^n ${b}^m ${c}^(n+m)`); return buildAnBmCnmPDA(a, b, c);
  }

  // ===========================================================================
  // 11. THREE-SYMBOL  a^n b^m c^n  (first = last)
  //     Notations: "a^n b^m c^n", "same number of a's and c's"
  // ===========================================================================
  {
    const m3 = d.match(/([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^m\s*([a-z0-9])\s*\^n/);
    if (m3 && m3[1] !== m3[3]) { log(`${m3[1]}^n ${m3[2]}^m ${m3[3]}^n`); return buildAnBmCnPDA(m3[1],m3[2],m3[3]); }
  }

  // ===========================================================================
  // 12. x^(kn) y^n  and  x^n y^(kn)  — generic multiplier, any symbols
  //     Notations: "a^2n b^n", "1^n 0^2n", "twice as many a's as b's",
  //                "a^3n b^n", "x^n y^3n", etc.
  // ===========================================================================
  {
    // x^(kn) y^n — first symbol has multiplier
    const m_kn_n = d.match(/([a-z0-9])\s*\^(\d+)n\s+([a-z0-9])\s*\^n/);
    if (m_kn_n) {
      const x = m_kn_n[1], k = parseInt(m_kn_n[2], 10), y = m_kn_n[3];
      log(`${x}^${k}n ${y}^n`); return buildKAnBnPDA(x, y, k);
    }
    // x^n y^(kn) — second symbol has multiplier
    const m_n_kn = d.match(/([a-z0-9])\s*\^n\s+([a-z0-9])\s*\^(\d+)n/);
    if (m_n_kn) {
      const x = m_n_kn[1], y = m_n_kn[2], k = parseInt(m_n_kn[3], 10);
      log(`${x}^n ${y}^${k}n`); return buildAnKBnPDA(x, y, k);
    }
    // English fallbacks: "twice as many X as Y"
    if (/twice\s+as\s+many\s+([a-z0-9])/.test(d)) {
      const xm = d.match(/twice\s+as\s+many\s+([a-z0-9])/), ym = extractSymbolsFromExponents(d);
      const x = xm?.[1] ?? 'a', y = ym.find(s => s !== x) ?? 'b';
      log(`${x}^2n ${y}^n (english)`); return buildKAnBnPDA(x, y, 2);
    }
  }

  // ===========================================================================
  // 13. TWO-SYMBOL  a^n b^n  (including a^n b^n c^m — n,n then free)
  //     Notations: "a^n b^n", "n a's followed by n b's",
  //                "equal number of a's then b's", "a^i b^i"
  // ===========================================================================
  {
    // a^n b^n c^m (a^nb^n followed by any c's)
    const m3 = d.match(/([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^m/);
    if (m3) { log(`${m3[1]}^n ${m3[2]}^n ${m3[3]}^m`); return buildAnBnCmPDA(m3[1],m3[2],m3[3]); }

    // Plain a^n b^n (with any exponent variable: n, i, j, k, m)
    const m2 = d.match(/([a-z0-9])\s*\^\s*([ijknm])\s+([a-z0-9])\s*\^\s*\2\b/);
    if (m2) {
      const minN = />=\s*0|=\s*0/.test(d) ? 0 : 1;
      log(`${m2[1]}^${m2[2]} ${m2[3]}^${m2[2]} (minN=${minN})`);
      return buildAnBnPDA(m2[1], m2[3], minN);
    }
    // Same variable, no explicit exponent notation: catch "^n ... ^n"
    const m2b = d.match(/([a-z0-9])\s*\^n\s*([a-z0-9])\s*\^n/);
    if (m2b) {
      const minN = />=\s*0|=\s*0/.test(d) ? 0 : 1;
      log(`${m2b[1]}^n ${m2b[2]}^n (minN=${minN})`); return buildAnBnPDA(m2b[1],m2b[2],minN);
    }
    // English: "n X's followed by n Y's"
    const eng = d.match(/n\s+([a-z0-9])['s]*\s+followed\s+by\s+n\s+([a-z0-9])/);
    if (eng) { log(`${eng[1]}^n ${eng[2]}^n`); return buildAnBnPDA(eng[1],eng[2],1); }
    // English: "n copies of X then n copies of Y"
    const eng2 = d.match(/n\s+copies\s+of\s+([a-z0-9]).*n\s+copies\s+of\s+([a-z0-9])/);
    if (eng2) { log(`${eng2[1]}^n ${eng2[2]}^n`); return buildAnBnPDA(eng2[1],eng2[2],1); }
  }

  return null;
}
