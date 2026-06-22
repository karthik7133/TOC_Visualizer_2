import { useState, Component, ReactNode } from 'react';
import { AutomatonSchema, InputType } from './types/schema';
import { useAutomatonRunner } from './hooks/useAutomatonRunner';
import ControlPanel      from './components/ControlPanel';
import GraphCanvas       from './components/GraphCanvas';
import ExecutionTimeline from './components/ExecutionTimeline';
import MemoryVisualizer  from './components/MemoryVisualizer';
import TransitionTable   from './components/TransitionTable';
import RegexPanel        from './components/RegexPanel';

// ── Error Boundary ────────────────────────────────────────────────────────────
class ErrorBoundary extends Component<
  { children: ReactNode; fallback?: string },
  { error: string | null }
> {
  constructor(props: { children: ReactNode; fallback?: string }) {
    super(props);
    this.state = { error: null };
  }
  static getDerivedStateFromError(err: unknown) {
    return { error: err instanceof Error ? err.message : String(err) };
  }
  componentDidCatch(err: unknown, info: unknown) { console.error('[ErrorBoundary]', err, info); }
  render() {
    if (this.state.error) {
      return (
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          height: '100%', flexDirection: 'column', gap: 14, padding: 28,
          background: 'var(--bg-app)',
        }}>
          <div style={{
            width: 48, height: 48, borderRadius: 12,
            background: 'var(--danger-muted)',
            border: '1px solid rgba(244,63,94,0.25)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 22,
          }}>⚠️</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320 }}>
            {this.props.fallback ?? 'A display error occurred.'}
          </p>
          <p style={{ fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', textAlign: 'center', maxWidth: 360 }}>
            {this.state.error}
          </p>
          <button
            className="btn primary"
            style={{ fontSize: 12, padding: '6px 18px' }}
            onClick={() => this.setState({ error: null })}
          >
            Dismiss
          </button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── App ───────────────────────────────────────────────────────────────────────
export default function App() {
  const [automaton,  setAutomaton]  = useState<AutomatonSchema | null>(null);
  const [inputType,  setInputType]  = useState<InputType>('regex');
  const [userPrompt, setUserPrompt] = useState('');
  const [regexInput, setRegexInput] = useState('');
  const runner = useAutomatonRunner();

  const handleAutomatonGenerated = (a: AutomatonSchema) => {
    setAutomaton(a);
    runner.reset();
  };

  const currentStepData = runner.steps[runner.currentStep] ?? null;

  return (
    <div style={{
      display: 'grid',
      gridTemplateColumns: '280px 1fr 300px',
      gridTemplateRows: '100vh',
      gap: 0,
      width: '100vw',
      height: '100vh',
      overflow: 'hidden',
      background: 'var(--bg-app)',
    }}>

      {/* ── Left sidebar ──────────────────────────────────────────────────── */}
      <aside style={{
        borderRight: '1px solid var(--border-subtle)',
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        background: 'rgba(13,21,38,0.98)',
        backdropFilter: 'blur(20px)',
      }}>
        <ControlPanel
          onAutomatonGenerated={handleAutomatonGenerated}
          onInputTypeChange={setInputType}
          onPromptChange={setUserPrompt}
          onRegexChange={setRegexInput}
        />
      </aside>

      {/* ── Center ────────────────────────────────────────────────────────── */}
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'var(--bg-app)' }}>

        {/* Top bar */}
        <header style={{
          display: 'flex', alignItems: 'center', gap: 12,
          padding: '0 20px', height: 52,
          borderBottom: '1px solid var(--border-subtle)',
          flexShrink: 0,
          background: 'rgba(13,21,38,0.95)',
          backdropFilter: 'blur(16px)',
        }}>
          {/* Logo */}
          <div style={{
            width: 28, height: 28,
            background: 'linear-gradient(135deg, var(--accent), #7c3aed)',
            borderRadius: 7,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 14, color: '#fff', fontWeight: 800, flexShrink: 0,
            boxShadow: '0 0 14px rgba(99,102,241,0.45)',
          }}>A</div>

          <span style={{
            fontSize: 14, fontWeight: 700,
            color: 'var(--text-primary)',
            letterSpacing: '-0.03em',
            background: 'linear-gradient(135deg, #f1f5f9, #94a3b8)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}>
            Automata Visualizer
          </span>

          {automaton && (
            <span className="badge neutral" style={{ marginLeft: 4 }}>
              {automaton.type}
            </span>
          )}

          <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
            {/* Live indicator */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: 'var(--success)',
                boxShadow: '0 0 6px var(--success)',
                animation: 'pulse-dot 2s ease-in-out infinite',
              }} />
              <span style={{ fontSize: 11, color: 'var(--text-tertiary)' }}>
                DFA · NFA · PDA · TM
              </span>
            </div>
          </div>
        </header>

        {/* Graph + RegexPanel + Transition Table */}
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>

          {/* Graph canvas */}
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ErrorBoundary fallback="Graph rendering failed. Try regenerating the automaton.">
              <GraphCanvas
                automaton={automaton}
                activeNodeId={runner.activeNodeId}
                activeEdgeId={runner.activeEdgeId}
                currentStep={currentStepData}
              />
            </ErrorBoundary>
          </div>

          {/* Regex panel — shown for NL→DFA/NFA and regex mode */}
          <ErrorBoundary fallback="Regex panel failed.">
            <RegexPanel
              automaton={automaton}
              inputType={inputType}
              userPrompt={userPrompt}
              regexInput={regexInput}
            />
          </ErrorBoundary>

          {/* Transition Table */}
          <ErrorBoundary fallback="Transition table failed to render.">
            <TransitionTable
              automaton={automaton}
              activeState={runner.activeNodeId}
              activeSymbol={currentStepData?.symbol ?? null}
              activeEdgeId={runner.activeEdgeId}
            />
          </ErrorBoundary>
        </div>
      </main>

      {/* ── Right sidebar ─────────────────────────────────────────────────── */}
      <aside style={{
        borderLeft: '1px solid var(--border-subtle)',
        display: 'flex', flexDirection: 'column', overflow: 'hidden',
        background: 'rgba(13,21,38,0.98)',
        backdropFilter: 'blur(20px)',
      }}>
        <ExecutionTimeline
          automaton={automaton}
          currentStep={runner.currentStep}
          totalSteps={runner.steps.length}
          steps={runner.steps}
          playState={runner.playState}
          speed={runner.speed}
          accepted={runner.accepted}
          onLoadSimulation={runner.loadSimulation}
          onPlay={runner.play}
          onPause={runner.pause}
          onStepForward={runner.stepForward}
          onStepBack={runner.stepBackward}
          onReset={runner.reset}
          onSpeedChange={runner.setSpeed}
        />

        <div style={{ borderTop: '1px solid var(--border-subtle)', flex: 1, overflow: 'hidden' }}>
          <MemoryVisualizer
            automaton={automaton}
            step={currentStepData}
            prevStep={runner.steps[runner.currentStep - 1] ?? null}
          />
        </div>
      </aside>
    </div>
  );
}
