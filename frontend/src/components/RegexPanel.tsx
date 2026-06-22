import { useState, useEffect, useRef } from 'react';
import { AutomatonSchema, AutomatonType, DFASchema, NFASchema, InputType } from '../types/schema';

interface Props {
  automaton:  AutomatonSchema | null;
  inputType:  InputType;
  userPrompt: string;
  regexInput?: string;
}

// ─── Build a friendly regex-like description from DFA/NFA metadata ───────────
function buildRegexDescription(automaton: DFASchema | NFASchema): string {
  const { alphabet, states, acceptStates, startState } = automaton;
  if (!states.length || !alphabet.length) return '∅';

  if (states.length === 1 && acceptStates.includes(startState)) {
    return `(${alphabet.join('|')})*`;
  }

  const alpha     = alphabet.map(a => a).join('|');
  const alphaStar = alphabet.length === 1 ? `${alphabet[0]}*` : `(${alpha})*`;
  const acceptCount = acceptStates.length;
  const stateCount  = states.length;

  if (stateCount <= 3 && acceptCount === 1) {
    const sym = alphabet[0] ?? 'a';
    return `${alphaStar}${sym}${alphaStar}`;
  }

  return `(${alpha})*`;
}

// ─── Typewriter hook ──────────────────────────────────────────────────────────
function useTypewriter(text: string, speed = 32): { chars: string[]; done: boolean } {
  const [count, setCount] = useState(0);
  const ref = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    setCount(0);
    if (ref.current) clearInterval(ref.current);
    if (!text) return;
    // Small delay so state flush happens before interval starts
    const kickoff = setTimeout(() => {
      ref.current = setInterval(() => {
        setCount(c => {
          if (c >= text.length) { clearInterval(ref.current!); return c; }
          return c + 1;
        });
      }, speed);
    }, 30);
    return () => {
      clearTimeout(kickoff);
      if (ref.current) clearInterval(ref.current);
    };
  }, [text, speed]);

  const chars = text.slice(0, count).split('');
  return { chars, done: count >= text.length };
}

// ─── Copy button ──────────────────────────────────────────────────────────────
function CopyButton({ text }: { text: string }) {
  const [copied, setCopied] = useState(false);
  const copy = async () => {
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <button
      onClick={copy}
      title="Copy regex"
      style={{
        display: 'flex', alignItems: 'center', gap: 5,
        padding: '5px 12px', borderRadius: 6,
        border: '1px solid',
        borderColor: copied ? 'rgba(16,185,129,0.4)' : 'rgba(168,85,247,0.25)',
        background: copied ? 'rgba(16,185,129,0.1)' : 'rgba(168,85,247,0.08)',
        color: copied ? 'var(--success)' : '#c084fc',
        fontSize: 11, fontWeight: 600, cursor: 'pointer',
        transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
        transform: copied ? 'scale(1.05)' : 'scale(1)',
        boxShadow: copied ? '0 0 12px rgba(16,185,129,0.3)' : 'none',
      }}
    >
      {copied ? (
        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3"><polyline points="20 6 9 17 4 12"/></svg> Copied!</>
      ) : (
        <><svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 01-2-2V4a2 2 0 012-2h9a2 2 0 012 2v1"/></svg> Copy</>
      )}
    </button>
  );
}

// ─── State info pill ──────────────────────────────────────────────────────────
function InfoPill({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{
      display: 'flex', alignItems: 'center', gap: 6,
      padding: '4px 10px', borderRadius: 99,
      background: `${color}14`, border: `1px solid ${color}30`,
      fontSize: 11, color,
    }}>
      <span style={{ color: `${color}90`, fontWeight: 500 }}>{label}</span>
      <span style={{ fontFamily: 'var(--font-mono)', fontWeight: 700 }}>{value}</span>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function RegexPanel({ automaton, inputType, userPrompt, regexInput = '' }: Props) {
  const [expanded, setExpanded] = useState(true);
  const [visible,  setVisible]  = useState(false);

  const isRegexMode = inputType === 'regex';
  const isNLMode    = inputType === 'natural-language';

  // Show for regex mode (has input + automaton) OR NL mode (DFA/NFA result)
  const show =
    (isRegexMode && !!regexInput.trim() && automaton !== null &&
      (automaton.type === AutomatonType.DFA || automaton.type === AutomatonType.NFA))
    ||
    (isNLMode && automaton !== null &&
      (automaton.type === AutomatonType.DFA || automaton.type === AutomatonType.NFA));

  useEffect(() => {
    if (show) {
      const t = setTimeout(() => setVisible(true), 80);
      return () => clearTimeout(t);
    } else {
      setVisible(false);
    }
  }, [show, automaton, regexInput]);

  if (!show || !visible) return null;

  const fa = automaton as DFASchema | NFASchema;
  // Regex mode: show the actual user expression; NL mode: derive approximation
  const regex      = isRegexMode ? regexInput.trim() : buildRegexDescription(fa);
  const typeLabel  = fa.type === AutomatonType.DFA ? 'DFA' : 'NFA';
  const panelTitle = isRegexMode ? 'Compiled Regular Expression' : 'Equivalent Regular Expression';
  const panelSub   = isRegexMode
    ? `Compiled to ${typeLabel} · ${fa.states.length} states`
    : `Derived from ${typeLabel} · ${fa.states.length} states`;

  return (
    <RegexPanelInner
      automaton={fa}
      regex={regex}
      panelTitle={panelTitle}
      panelSub={panelSub}
      userPrompt={isNLMode ? userPrompt : ''}
      expanded={expanded}
      onToggle={() => setExpanded(e => !e)}
    />
  );
}

// ─── Inner renderer (keeps typewriter isolated so it restarts on regex change) ─
function RegexPanelInner({
  automaton, regex, panelTitle, panelSub, userPrompt, expanded, onToggle,
}: {
  automaton:  DFASchema | NFASchema;
  regex:      string;
  panelTitle: string;
  panelSub:   string;
  userPrompt: string;
  expanded:   boolean;
  onToggle:   () => void;
}) {
  const { chars, done } = useTypewriter(regex, 32);

  return (
    <div
      className="regex-panel"
      style={{
        margin: '10px 12px', padding: 0, overflow: 'hidden',
        maxHeight: expanded ? 340 : 50,
        transition: 'max-height 500ms cubic-bezier(0.34,1.10,0.64,1)',
        flexShrink: 0,
      }}
    >
      {/* ── Header ── */}
      <div
        onClick={onToggle}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '12px 16px', cursor: 'pointer',
          borderBottom: expanded ? '1px solid rgba(168,85,247,0.15)' : 'none',
          userSelect: 'none',
        }}
      >
        <div style={{
          width: 26, height: 26, borderRadius: 7, flexShrink: 0,
          background: 'linear-gradient(135deg, rgba(168,85,247,0.3), rgba(99,102,241,0.2))',
          border: '1px solid rgba(168,85,247,0.35)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 13, boxShadow: '0 0 12px rgba(168,85,247,0.25)',
        }}>✦</div>

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '-0.01em' }}>
            {panelTitle}
          </div>
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', marginTop: 1 }}>
            {panelSub}
          </div>
        </div>

        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"
          style={{
            transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 350ms cubic-bezier(0.34,1.56,0.64,1)', flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* ── Body ── */}
      {expanded && (
        <div style={{ padding: '14px 18px', display: 'flex', flexDirection: 'column', gap: 12 }}>

          {/* Prompt echo — NL mode only */}
          {userPrompt && (
            <div style={{
              fontSize: 11, color: 'var(--text-tertiary)', fontStyle: 'italic',
              borderLeft: '2px solid rgba(168,85,247,0.3)',
              paddingLeft: 10, lineHeight: 1.5,
            }}>
              "{userPrompt}"
            </div>
          )}

          {/* Regex display box */}
          <div style={{
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 10, padding: '12px 16px',
            position: 'relative', minHeight: 52,
            display: 'flex', alignItems: 'center',
            boxShadow: 'inset 0 0 20px rgba(168,85,247,0.05)',
          }}>
            <div className="regex-text" style={{ flex: 1, wordBreak: 'break-all' }}>
              {chars.length === 0 && done ? (
                <span style={{ color: 'var(--text-disabled)', fontStyle: 'italic', fontSize: 12 }}>
                  (empty expression)
                </span>
              ) : (
                chars.map((ch, i) => (
                  <span key={i} className="regex-char" style={{ animationDelay: `${i * 18}ms` }}>
                    {ch === ' ' ? '\u00a0' : ch}
                  </span>
                ))
              )}
              {!done && (
                <span style={{
                  display: 'inline-block', width: 2, height: 18,
                  background: '#c084fc', marginLeft: 2, verticalAlign: 'text-bottom',
                  animation: 'pulse-dot 0.8s ease-in-out infinite', borderRadius: 1,
                }} />
              )}
            </div>

            {done && regex && (
              <div style={{ marginLeft: 10, flexShrink: 0, animation: 'fade-up 0.25s var(--ease) forwards' }}>
                <CopyButton text={regex} />
              </div>
            )}
          </div>

          {/* State info pills */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            <InfoPill label="Start"  value={automaton.startState}                    color="#10b981" />
            {automaton.acceptStates.map(s => (
              <InfoPill key={s} label="Accept" value={s}                             color="#c084fc" />
            ))}
            <InfoPill label="Σ" value={`{${automaton.alphabet.join(', ')}}`}         color="#38bdf8" />
          </div>

          {/* Footnote */}
          <div style={{ fontSize: 10, color: 'var(--text-disabled)', display: 'flex', alignItems: 'center', gap: 5 }}>
            <span style={{ color: 'var(--warning)', fontSize: 10 }}>ⓘ</span>
            Approximated from automaton structure — may not be minimal.
          </div>
        </div>
      )}
    </div>
  );
}
