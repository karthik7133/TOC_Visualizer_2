import { useState, useRef, useEffect } from 'react';
import {
  AutomatonSchema, AutomatonType,
  DFASchema, NFASchema, PDASchema, TMSchema,
} from '../types/schema';

interface Props {
  automaton:    AutomatonSchema | null;
  activeState?: string | null;
  activeSymbol?: string | null;
  activeEdgeId?: string | null;
}

// ─── Cell renderers ───────────────────────────────────────────────────────────
function renderDFACell(dfa: DFASchema, state: string, sym: string): string {
  return dfa.transitions[state]?.[sym] ?? '—';
}
function renderNFACell(nfa: NFASchema, state: string, sym: string): string {
  const t = nfa.transitions[state]?.[sym] ?? [];
  return t.length === 0 ? '∅' : `{${t.join(', ')}}`;
}
function renderTMCell(tm: TMSchema, state: string, sym: string): string {
  const e = tm.transitions[state]?.[sym];
  return e ? `(${e.writeSymbol}, ${e.direction}, ${e.targetState})` : '—';
}

// ─── Shared style tokens ──────────────────────────────────────────────────────
const headerStyle: React.CSSProperties = {
  position: 'sticky', top: 0,
  background: 'rgba(13,21,38,0.95)',
  backdropFilter: 'blur(12px)',
  fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
  color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.06em',
  padding: '8px 14px', borderBottom: '1px solid var(--border-subtle)',
  whiteSpace: 'nowrap', textAlign: 'center',
  transition: 'color 250ms, background 250ms',
};

const cellBase: React.CSSProperties = {
  fontFamily: 'var(--font-mono)', fontSize: 12,
  padding: '7px 14px', borderBottom: '1px solid rgba(99,102,241,0.07)',
  whiteSpace: 'nowrap', textAlign: 'center',
  transition: 'all 250ms cubic-bezier(0.4,0,0.2,1)',
};

// ─── PDA Table ────────────────────────────────────────────────────────────────
interface PDARule {
  state: string; input: string; top: string; target: string; push: string; edgeId: string;
}

function buildPDARules(pda: PDASchema): PDARule[] {
  const rules: PDARule[] = [];
  const transitions = pda?.transitions;
  if (!transitions || typeof transitions !== 'object') return rules;
  for (const [state, inputMap] of Object.entries(transitions)) {
    if (!inputMap || typeof inputMap !== 'object') continue;
    for (const [inp, entryList] of Object.entries(inputMap)) {
      if (!Array.isArray(entryList)) continue;
      for (const e of entryList) {
        if (!e || typeof e !== 'object') continue;
        const pushSymbols = Array.isArray(e.pushSymbols) ? e.pushSymbols : [];
        const push = pushSymbols.length ? pushSymbols.join('') : 'ε';
        rules.push({
          state, input: inp === 'ε' || inp === '' ? 'ε' : inp,
          top: e.topOfStack ?? '?', target: e.targetState ?? '?',
          push, edgeId: `${state}-${inp}-${e.targetState}`,
        });
      }
    }
  }
  return rules;
}

function PDATable({ pda, activeState, activeEdgeId, renderEpoch }: {
  pda: PDASchema; activeState?: string | null; activeEdgeId?: string | null; renderEpoch: number;
}) {
  const rules = buildPDARules(pda);
  const acceptSet = new Set(pda.acceptStates);

  return (
    <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }} className="table-3d">
      <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
        <thead>
          <tr>
            {(['State','Input','Top','→','Target','Push'] as const).map((label, i) => (
              <th key={i} style={{
                ...headerStyle,
                textAlign: label === '→' ? 'center' : 'left',
                paddingLeft: label === 'State' ? 18 : 14,
                ...(label === 'State' ? { position: 'sticky', left: 0, zIndex: 2, background: 'rgba(13,21,38,0.98)' } : {}),
              }}>{label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rules.map((rule, i) => {
            const isEdge   = activeEdgeId === rule.edgeId;
            const isActive = !!(activeState && activeState.split(',').map(s => s.trim()).includes(rule.state));
            const isStart  = rule.state === pda.startState;
            const isAccept = acceptSet.has(rule.state);
            return (
              <tr
                key={`${renderEpoch}-${i}`}
                className={isActive ? 'table-active-row table-row-enter' : 'table-row-enter'}
                style={{ animationDelay: `${i * 28}ms` }}
              >
                <td style={{
                  ...cellBase, textAlign: 'left', paddingLeft: 18,
                  borderRight: '1px solid var(--border-subtle)',
                  position: 'sticky', left: 0, zIndex: 1,
                  background: isActive
                    ? 'rgba(99,102,241,0.10)'
                    : i % 2 === 0 ? 'rgba(13,21,38,0.95)' : 'rgba(26,34,54,0.95)',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                    {isStart  && <StartBadge />}
                    {isAccept && <AcceptBadge />}
                    <span style={{ fontWeight: isEdge ? 800 : 500, color: isEdge ? 'var(--accent-hover)' : 'var(--text-primary)' }}>
                      {rule.state}
                    </span>
                  </div>
                </td>
                <td style={{ ...cellBase, textAlign: 'left', color: rule.input === 'ε' ? 'var(--text-tertiary)' : 'var(--warning)', fontWeight: 600 }}>
                  {rule.input}
                </td>
                <td style={{ ...cellBase, textAlign: 'left', color: 'var(--accent)' }}>{rule.top}</td>
                <td style={{ ...cellBase, color: 'var(--text-disabled)', fontSize: 14, textAlign: 'center' }}>→</td>
                <td style={{ ...cellBase, textAlign: 'left', color: isEdge ? 'var(--accent-hover)' : acceptSet.has(rule.target) ? 'var(--success)' : 'var(--text-primary)', fontWeight: isEdge ? 700 : 500 }}>
                  {rule.target}
                </td>
                <td style={{ ...cellBase, textAlign: 'left', color: rule.push === 'ε' ? 'var(--text-tertiary)' : 'var(--text-secondary)' }}>
                  {rule.push}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

// ─── Badge helpers ────────────────────────────────────────────────────────────
function StartBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: 'var(--success)',
      background: 'rgba(16,185,129,0.12)',
      border: '1px solid rgba(16,185,129,0.3)',
      borderRadius: 4, padding: '0 5px',
      animation: 'badge-pop 0.35s var(--ease-spring) both',
    }}>→</span>
  );
}
function AcceptBadge() {
  return (
    <span style={{
      fontSize: 10, fontWeight: 800, color: '#c084fc',
      background: 'rgba(192,132,252,0.12)',
      border: '1px solid rgba(192,132,252,0.3)',
      borderRadius: 4, padding: '0 5px',
      animation: 'badge-pop 0.35s var(--ease-spring) 0.06s both',
    }}>*</span>
  );
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function TransitionTable({ automaton, activeState, activeSymbol, activeEdgeId }: Props) {
  const [isOpen, setIsOpen] = useState(true);
  const renderEpochRef = useRef(0);
  const prevAutomaton  = useRef<AutomatonSchema | null>(null);

  // Bump epoch each time the automaton changes so rows re-animate
  if (prevAutomaton.current !== automaton) {
    renderEpochRef.current += 1;
    prevAutomaton.current = automaton;
  }
  const epoch = renderEpochRef.current;

  if (!automaton) return null;

  const isDFA = automaton.type === AutomatonType.DFA;
  const isNFA = automaton.type === AutomatonType.NFA;
  const isPDA = automaton.type === AutomatonType.PDA;
  const isTM  = automaton.type === AutomatonType.TM;

  const states: string[] = isTM
    ? (automaton as TMSchema).states
    : (automaton as DFASchema | NFASchema | PDASchema).states;

  const startState   = automaton.startState;
  const acceptStates: string[] = isTM
    ? [(automaton as TMSchema).acceptState]
    : (automaton as DFASchema | NFASchema | PDASchema).acceptStates;

  let columns: string[] = [...automaton.alphabet];
  if (isNFA) {
    const nfa = automaton as NFASchema;
    if (Object.values(nfa.transitions).some(m => m[''] && m[''].length > 0))
      columns = [...columns, ''];
  }
  if (isTM) columns = (automaton as TMSchema).tapeAlphabet;

  const renderCell = (state: string, sym: string): string => {
    if (isDFA) return renderDFACell(automaton as DFASchema, state, sym);
    if (isNFA) return renderNFACell(automaton as NFASchema, state, sym);
    if (isTM)  return renderTMCell(automaton as TMSchema, state, sym);
    return '—';
  };

  const summary = isPDA
    ? `${buildPDARules(automaton as PDASchema).length} rules`
    : `${states.length} states · ${columns.length} symbols`;

  return (
    <div style={{
      borderTop: '1px solid var(--border-subtle)',
      background: 'rgba(10,15,30,0.95)',
      backdropFilter: 'blur(16px)',
      flexShrink: 0,
      display: 'flex',
      flexDirection: 'column',
      maxHeight: isOpen ? 300 : 44,
      transition: 'max-height 500ms cubic-bezier(0.34,1.10,0.64,1)',
      overflow: 'hidden',
      position: 'relative',
    }}>

      {/* Ambient glow strip */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 1,
        background: 'linear-gradient(90deg, transparent 0%, rgba(99,102,241,0.6) 50%, transparent 100%)',
        opacity: isOpen ? 1 : 0,
        transition: 'opacity 400ms',
      }} />

      {/* ── Header / toggle ── */}
      <div
        onClick={() => setIsOpen(o => !o)}
        style={{
          display: 'flex', alignItems: 'center', gap: 10,
          padding: '0 18px', height: 44, cursor: 'pointer', flexShrink: 0,
          borderBottom: isOpen ? '1px solid var(--border-subtle)' : 'none',
          userSelect: 'none',
          background: 'rgba(255,255,255,0.02)',
          transition: 'background 200ms',
        }}
      >
        {/* δ icon */}
        <div style={{
          width: 22, height: 22,
          background: 'linear-gradient(135deg, rgba(99,102,241,0.25), rgba(168,85,247,0.15))',
          border: '1px solid rgba(99,102,241,0.3)',
          borderRadius: 6,
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 12, color: 'var(--accent-hover)', fontWeight: 800, flexShrink: 0,
          boxShadow: '0 0 8px rgba(99,102,241,0.2)',
        }}>δ</div>

        <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
          {isPDA ? 'PDA Transition Rules' : (isNFA ? 'NFA' : isDFA ? 'DFA' : 'TM') + ' Transition Table'}
        </span>

        <span style={{
          fontSize: 10, color: 'var(--text-tertiary)',
          fontFamily: 'var(--font-mono)',
          background: 'rgba(99,102,241,0.06)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 99, padding: '2px 8px',
        }}>{summary}</span>

        {/* Animated chevron */}
        <svg
          width="14" height="14" viewBox="0 0 24 24" fill="none"
          stroke="var(--text-tertiary)" strokeWidth="2" strokeLinecap="round"
          style={{
            transform: isOpen ? 'rotate(180deg)' : 'rotate(0deg)',
            transition: 'transform 350ms cubic-bezier(0.34,1.56,0.64,1)',
            flexShrink: 0,
          }}
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </div>

      {/* ── PDA ── */}
      {isOpen && isPDA && (
        <PDATable
          key={`pda-${epoch}`}
          pda={automaton as PDASchema}
          activeState={activeState}
          activeEdgeId={activeEdgeId}
          renderEpoch={epoch}
        />
      )}

      {/* ── DFA / NFA / TM grid ── */}
      {isOpen && !isPDA && (
        <div style={{ overflowX: 'auto', overflowY: 'auto', flex: 1 }} className="table-3d">
          <table style={{ borderCollapse: 'collapse', width: '100%', minWidth: 'max-content' }}>
            <thead>
              <tr>
                <th style={{
                  ...headerStyle, textAlign: 'left', paddingLeft: 18, minWidth: 90,
                  left: 0, zIndex: 2, position: 'sticky',
                  background: 'rgba(13,21,38,0.98)',
                }}>State</th>
                {columns.map(sym => {
                  const isActiveSym = activeSymbol !== null && activeSymbol !== undefined && sym === activeSymbol;
                  return (
                    <th key={`h-${sym}`} style={{
                      ...headerStyle,
                      color: isActiveSym ? 'var(--accent-hover)' : 'var(--text-tertiary)',
                      background: isActiveSym
                        ? 'rgba(99,102,241,0.15)'
                        : 'rgba(13,21,38,0.95)',
                      minWidth: 72,
                      boxShadow: isActiveSym ? 'inset 0 -2px 0 var(--accent)' : 'none',
                    }}>
                      {sym === '' ? 'ε' : sym}
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {states.map((state, rowIdx) => {
                const isStart  = state === startState;
                const isAccept = acceptStates.includes(state);
                const isDead   = state === '∅';
                const isActive = !!(activeState && activeState.split(',').map(s => s.trim()).includes(state));

                return (
                  <tr
                    key={`${epoch}-${state}`}
                    className={isActive ? 'table-active-row table-row-enter' : 'table-row-enter'}
                    style={{ animationDelay: `${rowIdx * 30}ms` }}
                  >
                    {/* State cell */}
                    <td style={{
                      ...cellBase,
                      position: 'sticky', left: 0, zIndex: 1,
                      background: isActive
                        ? 'rgba(99,102,241,0.12)'
                        : isDead
                        ? 'rgba(100,116,139,0.08)'
                        : rowIdx % 2 === 0 ? 'rgba(13,21,38,0.95)' : 'rgba(20,28,46,0.95)',
                      textAlign: 'left', paddingLeft: 18,
                      borderRight: '1px solid var(--border-subtle)',
                    }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
                        {isStart  && <StartBadge />}
                        {isAccept && <AcceptBadge />}
                        <span style={{
                          fontWeight: isActive ? 800 : 500,
                          color: isDead ? 'var(--text-disabled)' : isActive ? 'var(--accent-hover)' : 'var(--text-primary)',
                        }}>
                          {state}
                        </span>
                      </div>
                    </td>

                    {/* Symbol cells */}
                    {columns.map(sym => {
                      const val = renderCell(state, sym);
                      const isHL = isActive && (activeSymbol === sym || (sym === '' && activeSymbol === ''));
                      const isEmpty = val === '∅' || val === '—';
                      return (
                        <td
                          key={`${state}-${sym}`}
                          className={isHL ? 'table-active-cell' : undefined}
                          style={{
                            ...cellBase,
                            color: isHL ? '#fff' : isEmpty ? 'var(--text-disabled)' : 'var(--text-secondary)',
                            fontWeight: isHL ? 700 : 400,
                          }}
                        >
                          {isEmpty ? (
                            <span style={{ fontSize: 13, opacity: 0.3 }}>{val}</span>
                          ) : val}
                        </td>
                      );
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
