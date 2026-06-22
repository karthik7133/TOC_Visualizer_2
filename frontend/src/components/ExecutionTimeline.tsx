import { useState } from 'react';
import { AutomatonSchema, SimulationStep } from '../types/schema';
import { PlayState } from '../hooks/useAutomatonRunner';

interface Props {
  automaton:         AutomatonSchema | null;
  currentStep:       number;
  totalSteps:        number;
  playState:         PlayState;
  speed:             number;
  accepted:          boolean | null;
  steps:             SimulationStep[];
  onLoadSimulation:  (automaton: AutomatonSchema, input: string) => Promise<void>;
  onPlay:            () => void;
  onPause:           () => void;
  onStepForward:     () => void;
  onStepBack:        () => void;
  onReset:           () => void;
  onSpeedChange:     (ms: number) => void;
}

export default function ExecutionTimeline({
  automaton, currentStep, totalSteps, playState, speed, accepted, steps,
  onLoadSimulation, onPlay, onPause, onStepForward, onStepBack, onReset, onSpeedChange,
}: Props) {
  const [inputString, setInputString] = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const handleRun = async () => {
    if (!automaton) { setError('Generate an automaton first.'); return; }
    setError(null);
    setLoading(true);
    try {
      await onLoadSimulation(automaton, inputString);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  };

  const speedLabel = speed <= 200 ? 'Fast' : speed <= 600 ? 'Medium' : 'Slow';
  const hasSteps   = totalSteps > 0;

  // Reconstruct consumed input from steps (symbol at each step)
  const consumedSymbols: string[] = steps
    .slice(1) // step 0 is the start, no symbol consumed yet
    .map(s => s.symbol ?? '');
  const inputTape = consumedSymbols.join('');
  // Current read position = currentStep - 1 (0-indexed into consumedSymbols)
  const tapeHead = currentStep - 1;

  const statusBadge = () => {
    if (!hasSteps || playState === 'idle') return null;
    if (playState === 'playing') return <span className="badge running">Running</span>;
    if (accepted === true)       return <span className="badge accept">Accepted</span>;
    if (accepted === false)      return <span className="badge reject">Rejected</span>;
    return <span className="badge neutral">Paused</span>;
  };

  return (
    <div style={{
      display: 'flex',
      flexDirection: 'column',
      height: 'auto',
      flexShrink: 0,
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 16px 12px',
        borderBottom: '1px solid var(--border-subtle)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{
            width: 24,
            height: 24,
            background: 'rgba(168, 85, 247, 0.08)',
            border: '1px solid rgba(168,85,247,0.2)',
            borderRadius: 6,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: 12,
            color: '#7c3aed',
          }}>
            ▶
          </div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)', flex: 1 }}>
            Simulation
          </span>
          {statusBadge()}
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Step through execution
        </p>
      </div>

      {/* Body */}
      <div style={{ padding: '16px', display: 'flex', flexDirection: 'column', gap: 16 }}>

        {/* Input string */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Input String</p>
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              className="input"
              value={inputString}
              onChange={e => setInputString(e.target.value)}
              onKeyDown={e => e.key === 'Enter' && handleRun()}
              placeholder="e.g. abb or 0011"
              style={{ flex: 1 }}
            />
            <button
              className="btn success"
              onClick={handleRun}
              disabled={loading || !automaton}
              style={{ flexShrink: 0, width: 38 }}
            >
              {loading ? <span className="spinner" /> : '▶'}
            </button>
          </div>
          {error && <div className="error-box" style={{ marginTop: 8 }}>{error}</div>}
        </div>

        {/* Input Tape Visualizer */}
        {hasSteps && inputTape.length > 0 && (
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Input Tape</p>
            <div style={{
              display: 'flex',
              flexWrap: 'wrap',
              gap: 4,
              padding: '8px 10px',
              background: 'var(--bg-overlay)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 8,
              minHeight: 38,
              alignItems: 'center',
            }}>
              {inputTape.split('').map((ch, i) => {
                const isHead    = i === tapeHead;
                const isPast    = i < tapeHead;
                const isFuture  = i > tapeHead;
                return (
                  <div
                    key={i}
                    style={{
                      width: 28,
                      height: 28,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      borderRadius: 6,
                      fontFamily: 'Geist Mono, monospace',
                      fontSize: 13,
                      fontWeight: 700,
                      transition: 'all 250ms ease',
                      background: isHead
                        ? 'rgba(79,70,229,0.12)'
                        : isPast
                        ? 'rgba(0,0,0,0.03)'
                        : 'transparent',
                      border: isHead
                        ? '1.5px solid rgba(79,70,229,0.45)'
                        : isPast
                        ? '1.5px solid var(--border-subtle)'
                        : '1.5px solid transparent',
                      color: isHead
                        ? 'var(--accent)'
                        : isPast
                        ? 'var(--text-disabled)'
                        : isFuture
                        ? 'var(--text-disabled)'
                        : 'var(--text-secondary)',
                      boxShadow: isHead ? '0 0 8px rgba(79,70,229,0.15)' : 'none',
                      transform: isHead ? 'scale(1.1)' : 'scale(1)',
                    }}
                  >
                    {ch}
                  </div>
                );
              })}
              {/* End marker */}
              <div style={{
                width: 4, height: 20,
                background: tapeHead >= inputTape.length - 1
                  ? 'var(--success)'
                  : 'var(--border-default)',
                borderRadius: 2,
                marginLeft: 2,
                transition: 'background 300ms',
              }} />
            </div>
          </div>
        )}

        {/* Progress */}
        {hasSteps && (
          <div>
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: 6,
            }}>
              <span className="label">Progress</span>
              <span style={{
                fontSize: 11,
                fontFamily: 'var(--font-mono)',
                color: 'var(--text-secondary)',
              }}>
                {currentStep + 1} / {totalSteps}
              </span>
            </div>
            <div className="progress-track">
              <div
                className="progress-fill"
                style={{ width: `${((currentStep + 1) / totalSteps) * 100}%` }}
              />
            </div>
          </div>
        )}

        {/* Playback controls */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Playback</p>
          <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
            <button
              className="btn icon"
              title="Reset"
              onClick={onReset}
              disabled={!hasSteps}
              style={{ flex: 1 }}
            >
              ↺
            </button>
            <button
              className="btn icon"
              title="Step Back"
              onClick={onStepBack}
              disabled={!hasSteps || currentStep === 0}
              style={{ flex: 1 }}
            >
              ←
            </button>

            {playState === 'playing'
              ? (
                <button
                  className="btn icon"
                  title="Pause"
                  onClick={onPause}
                  style={{ flex: 2, background: 'var(--accent-muted)', borderColor: 'rgba(99,102,241,0.25)', color: 'var(--accent-hover)' }}
                >
                  ⏸
                </button>
              ) : (
                <button
                  className="btn success icon"
                  title="Play"
                  onClick={onPlay}
                  disabled={!hasSteps}
                  style={{ flex: 2 }}
                >
                  ▶
                </button>
              )
            }

            <button
              className="btn icon"
              title="Step Forward"
              onClick={onStepForward}
              disabled={!hasSteps || currentStep >= totalSteps - 1}
              style={{ flex: 1 }}
            >
              →
            </button>
          </div>
        </div>

        {/* Speed */}
        <div>
          <div style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: 8,
          }}>
            <span className="label">Speed</span>
            <span style={{
              fontSize: 11,
              color: 'var(--text-secondary)',
              fontFamily: 'var(--font-mono)',
            }}>
              {speedLabel}
            </span>
          </div>
          <input
            type="range"
            className="range"
            min={100}
            max={2000}
            step={100}
            value={2100 - speed}
            onChange={e => onSpeedChange(2100 - Number(e.target.value))}
          />
          <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
            <span style={{ fontSize: 10, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>Slow</span>
            <span style={{ fontSize: 10, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)' }}>Fast</span>
          </div>
        </div>

        {/* Verdict */}
        {(playState === 'done' || playState === 'paused') &&
          accepted !== null &&
          hasSteps &&
          currentStep === totalSteps - 1 && (
          <div className={`verdict ${accepted ? 'accept' : 'reject'} anim-in`}>
            {accepted ? '✓  Input Accepted' : '✗  Input Rejected'}
          </div>
        )}
      </div>
    </div>
  );
}
