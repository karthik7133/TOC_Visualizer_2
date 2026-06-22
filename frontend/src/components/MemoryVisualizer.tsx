import { useEffect, useRef, useState } from 'react';
import { AutomatonSchema, AutomatonType, SimulationStep, TapeSnapshot } from '../types/schema';

interface Props {
  automaton: AutomatonSchema | null;
  step:      SimulationStep | null;
  prevStep?: SimulationStep | null;
}

// ─── Stack (PDA) ──────────────────────────────────────────────────────────────

function StackVisualizer({
  stack, prevStack,
}: { stack: string[]; prevStack?: string[] }) {
  // memorySnapshot already has top-of-stack at index 0 — display directly (no reverse needed)
  const display     = stack;         // index 0 = top
  const prevDisplay = prevStack ?? null;

  // Detect push/pop by comparing top (index 0) and length
  const topChanged = prevDisplay !== null && (
    display.length !== prevDisplay.length ||
    display[0] !== prevDisplay[0]
  );

  const pushed = prevDisplay && display.length > prevDisplay.length
    ? display.slice(0, display.length - prevDisplay.length)
    : [];
  const popped = prevDisplay && display.length < prevDisplay.length
    ? prevDisplay.slice(0, prevDisplay.length - display.length)
    : [];

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <p className="label" style={{ marginBottom: 0 }}>
          Stack <span style={{ color: 'var(--text-disabled)', textTransform: 'none', letterSpacing: 0 }}>(top ↑)</span>
        </p>
        {/* Push/pop indicator */}
        {topChanged && (
          <span style={{
            fontSize: 10, fontWeight: 700, letterSpacing: '0.04em',
            padding: '2px 7px', borderRadius: 99,
            background: pushed.length > 0 ? 'rgba(5,150,105,0.12)' : 'rgba(239,68,68,0.10)',
            color: pushed.length > 0 ? '#059669' : '#ef4444',
            border: `1px solid ${pushed.length > 0 ? 'rgba(5,150,105,0.25)' : 'rgba(239,68,68,0.2)'}`,
            animation: 'hud-in 0.2s ease-out',
          }}>
            {pushed.length > 0 ? `↑ push ${pushed.join('')}` : `↓ pop ${popped.join('')}`}
          </span>
        )}
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 3, maxHeight: 200, overflowY: 'auto' }}>
        {display.length === 0 ? (
          <span style={{ color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', fontSize: 12, textAlign: 'center', padding: '12px 0' }}>
            empty
          </span>
        ) : (
          display.map((sym, i) => {
            const isNew = pushed.length > 0 && i < pushed.length;
            const isTop = i === 0;
            return (
              <div
                key={`${i}-${sym}`}
                style={{
                  height: 34,
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 13,
                  fontWeight: isTop ? 700 : 500,
                  background: isNew
                    ? 'rgba(5,150,105,0.14)'
                    : isTop
                    ? 'var(--accent-muted)'
                    : 'var(--bg-overlay)',
                  border: `1.5px solid ${isNew ? 'rgba(5,150,105,0.4)' : isTop ? 'rgba(99,102,241,0.35)' : 'var(--border-subtle)'}`,
                  color: isNew ? '#059669' : isTop ? 'var(--accent-hover)' : 'var(--text-secondary)',
                  borderRadius: 'var(--radius-xs)',
                  animation: isNew ? 'hud-in 0.25s ease-out' : 'none',
                  transition: 'background 200ms, border-color 200ms, color 200ms',
                  position: 'relative',
                }}
              >
                {sym || 'ε'}
                {isTop && (
                  <span style={{
                    position: 'absolute', right: 8,
                    fontSize: 9, color: 'var(--text-tertiary)',
                    fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>top</span>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

// ─── Tape (TM) ────────────────────────────────────────────────────────────────

function TapeVisualizer({ snapshot }: { snapshot: TapeSnapshot }) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;
    const cellW = 40;
    const scrollTarget = snapshot.headPosition * cellW - el.clientWidth / 2 + cellW / 2;
    el.scrollTo({ left: Math.max(0, scrollTarget), behavior: 'smooth' });
  }, [snapshot.headPosition]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <p className="label" style={{ marginBottom: 4 }}>Tape</p>
      <div style={{ display: 'flex', overflow: 'hidden', marginBottom: 0 }}>
        <div style={{ width: 43 * snapshot.headPosition, flexShrink: 0 }} />
        <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--accent-hover)', fontSize: 12, width: 40, textAlign: 'center' }}>▼</span>
      </div>
      <div ref={scrollRef} style={{ display: 'flex', gap: 3, overflowX: 'auto', paddingBottom: 4 }}>
        {snapshot.tape.map((sym, i) => (
          <div
            key={i}
            className={`mem-cell ${i === snapshot.headPosition ? 'active' : ''}`}
            style={{
              width: 36, height: 36, flexShrink: 0,
              background: i === snapshot.headPosition ? 'var(--accent-muted)' : 'var(--bg-overlay)',
              border: `1px solid ${i === snapshot.headPosition ? 'rgba(99,102,241,0.3)' : 'var(--border-subtle)'}`,
              color: i === snapshot.headPosition ? 'var(--accent-hover)' : 'var(--text-secondary)',
              borderRadius: 'var(--radius-xs)', animation: 'none', fontSize: 12,
            }}
          >
            {sym}
          </div>
        ))}
      </div>
      <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'var(--text-tertiary)', marginTop: 2 }}>
        Head @ cell {snapshot.headPosition}
      </p>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function MemoryVisualizer({ automaton, step, prevStep }: Props) {
  const isDFA = automaton?.type === AutomatonType.DFA;
  const isNFA = automaton?.type === AutomatonType.NFA;
  const isPDA = automaton?.type === AutomatonType.PDA;
  const isTM  = automaton?.type === AutomatonType.TM;

  // Stable previous stack for animation comparison
  const [prevStackSnapshot, setPrevStackSnapshot] = useState<string[] | null>(null);
  useEffect(() => {
    if (prevStep && Array.isArray(prevStep.memorySnapshot)) {
      setPrevStackSnapshot(prevStep.memorySnapshot as string[]);
    }
  }, [step?.stepIndex]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>
      {/* Header */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{
            width: 24, height: 24,
            background: isPDA ? 'rgba(5,150,105,0.10)' : 'var(--danger-muted)',
            border: `1px solid ${isPDA ? 'rgba(5,150,105,0.2)' : 'rgba(225,29,72,0.15)'}`,
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12,
            color: isPDA ? '#059669' : 'var(--danger)',
          }}>
            {isPDA ? '⊟' : '⊞'}
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>Memory</span>
          {step && (
            <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--text-tertiary)' }}>
              step {step.stepIndex}
            </span>
          )}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          {isPDA ? 'Stack state' : isTM ? 'Tape state' : 'Register view'}
        </p>
      </div>

      {/* Body */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {!automaton && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, height: '100%', color: 'var(--text-disabled)', textAlign: 'center' }}>
            <span style={{ fontSize: 28, opacity: 0.4 }}>⊞</span>
            <span style={{ fontSize: 12 }}>No automaton loaded</span>
          </div>
        )}

        {automaton && (isDFA || isNFA) && (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8, paddingTop: 12, color: 'var(--text-tertiary)', textAlign: 'center' }}>
            <span style={{ fontSize: 12 }}>DFA / NFA have no auxiliary memory</span>
          </div>
        )}

        {/* State + symbol read cards */}
        {automaton && step && (isPDA || isTM) && (
          <>
            <div style={{ display: 'flex', gap: 12 }}>
              <div style={{ flex: 1, background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                <p className="label" style={{ marginBottom: 4 }}>State</p>
                <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--accent-hover)' }}>{step.state}</p>
              </div>
              {step.symbol !== null && (
                <div style={{ background: 'var(--bg-overlay)', border: '1px solid var(--border-subtle)', borderRadius: 'var(--radius-sm)', padding: '8px 12px' }}>
                  <p className="label" style={{ marginBottom: 4 }}>Read</p>
                  <p style={{ fontFamily: 'var(--font-mono)', fontSize: 15, fontWeight: 600, color: 'var(--warning)' }}>{step.symbol || 'ε'}</p>
                </div>
              )}
            </div>
            <div className="divider" />

            {isPDA && Array.isArray(step.memorySnapshot) && (
              <StackVisualizer
                stack={step.memorySnapshot as string[]}
                prevStack={prevStackSnapshot ?? undefined}
              />
            )}
            {isTM && !Array.isArray(step.memorySnapshot) && step.memorySnapshot && (
              <TapeVisualizer snapshot={step.memorySnapshot as TapeSnapshot} />
            )}
          </>
        )}

        {automaton && !step && (isPDA || isTM) && (
          <div style={{ color: 'var(--text-tertiary)', fontSize: 12, textAlign: 'center', paddingTop: 12 }}>
            Run a simulation to see memory state
          </div>
        )}
      </div>
    </div>
  );
}
