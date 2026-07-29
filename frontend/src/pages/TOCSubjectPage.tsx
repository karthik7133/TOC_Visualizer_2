import { useState } from 'react';
import { useNavigate, useLocation, Routes, Route, Navigate } from 'react-router-dom';
import { AutomatonSchema, InputType } from '../types/schema';
import { useAutomatonRunner } from '../hooks/useAutomatonRunner';
import ControlPanel from '../components/ControlPanel';
import GraphCanvas from '../components/GraphCanvas';
import ExecutionTimeline from '../components/ExecutionTimeline';
import MemoryVisualizer from '../components/MemoryVisualizer';
import TransitionTable from '../components/TransitionTable';
import RegexPanel from '../components/RegexPanel';
import TopicSelector from '../components/quiz/TopicSelector';
import QuizSession from '../components/quiz/QuizSession';
import ScoreCard from '../components/quiz/ScoreCard';
import { Component, ReactNode } from 'react';
import ScoreCardPage from './ScoreCardPage';
import BackgroundOrbs from '../components/BackgroundOrbs';
import TOCLandingPage from './TOCLandingPage';

// ── Error Boundary ─────────────────────────────────────────────────────────────
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
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', flexDirection: 'column', gap: 14, padding: 28, background: 'var(--bg-app)' }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: 'var(--danger-muted)', border: '1px solid rgba(244,63,94,0.25)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 22 }}>⚠️</div>
          <p style={{ fontSize: 13, color: 'var(--text-secondary)', textAlign: 'center', maxWidth: 320 }}>{this.props.fallback ?? 'A display error occurred.'}</p>
          <p style={{ fontSize: 11, color: 'var(--text-disabled)', fontFamily: 'var(--font-mono)', textAlign: 'center', maxWidth: 360 }}>{this.state.error}</p>
          <button className="btn primary" style={{ fontSize: 12, padding: '6px 18px' }} onClick={() => this.setState({ error: null })}>Dismiss</button>
        </div>
      );
    }
    return this.props.children;
  }
}

// ── Quiz flow types ────────────────────────────────────────────────────────────
export interface QuizQuestion {
  id: number;
  topic: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
}

export interface QuestionResult {
  questionId: number;
  topic: string;
  timeSpent: number;
  isCorrect: boolean;
  selectedIndex: number;
  correctIndex: number;
  question: string;
}

// ── Automata Visualizer (self-contained) ──────────────────────────────────────
function AutomataVisualizerTab() {
  const [automaton, setAutomaton] = useState<AutomatonSchema | null>(null);
  const [inputType, setInputType] = useState<InputType>('regex');
  const [userPrompt, setUserPrompt] = useState('');
  const [regexInput, setRegexInput] = useState('');
  const runner = useAutomatonRunner();
  const currentStepData = runner.steps[runner.currentStep] ?? null;

  return (
    <div style={{ display: 'grid', gridTemplateColumns: '280px 1fr 300px', height: '100%', overflow: 'hidden', background: 'transparent' }}>
      <aside className="glass-sidebar-left" style={{ overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <ControlPanel
          onAutomatonGenerated={(a) => { setAutomaton(a); runner.reset(); }}
          onInputTypeChange={setInputType}
          onPromptChange={setUserPrompt}
          onRegexChange={setRegexInput}
        />
      </aside>
      <main style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden', background: 'transparent' }}>
        <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          <div style={{ flex: 1, overflow: 'hidden' }}>
            <ErrorBoundary fallback="Graph rendering failed.">
              <GraphCanvas automaton={automaton} activeNodeId={runner.activeNodeId} activeEdgeId={runner.activeEdgeId} currentStep={currentStepData} />
            </ErrorBoundary>
          </div>
          <ErrorBoundary fallback="Regex panel failed.">
            <RegexPanel automaton={automaton} inputType={inputType} userPrompt={userPrompt} regexInput={regexInput} />
          </ErrorBoundary>
          <ErrorBoundary fallback="Transition table failed.">
            <TransitionTable automaton={automaton} activeState={runner.activeNodeId} activeSymbol={currentStepData?.symbol ?? null} activeEdgeId={runner.activeEdgeId} />
          </ErrorBoundary>
        </div>
      </main>
      <aside className="glass-sidebar-right" style={{ display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        <ExecutionTimeline
          automaton={automaton} currentStep={runner.currentStep} totalSteps={runner.steps.length}
          steps={runner.steps} playState={runner.playState} speed={runner.speed} accepted={runner.accepted}
          onLoadSimulation={runner.loadSimulation} onPlay={runner.play} onPause={runner.pause}
          onStepForward={runner.stepForward} onStepBack={runner.stepBackward}
          onReset={runner.reset} onSpeedChange={runner.setSpeed}
        />
        <div style={{ borderTop: '1px solid var(--border-subtle)', flex: 1, overflow: 'hidden' }}>
          <MemoryVisualizer automaton={automaton} step={currentStepData} prevStep={runner.steps[runner.currentStep - 1] ?? null} />
        </div>
      </aside>
    </div>
  );
}

// ── Resources Tab ──────────────────────────────────────────────────────────────
function ResourcesTab() {
  const resources = [
    { cat: 'Textbooks', icon: '📘', items: [
      { title: 'Introduction to Automata Theory — Hopcroft, Ullman & Motwani', link: '#', tag: 'Classic' },
      { title: 'Sipser — Introduction to the Theory of Computation', link: '#', tag: 'Recommended' },
      { title: 'Linz — An Introduction to Formal Languages and Automata', link: '#', tag: 'Beginner Friendly' },
    ]},
    { cat: 'Video Lectures', icon: '🎥', items: [
      { title: 'MIT 18.404J — Theory of Computation (Michael Sipser)', link: '#', tag: 'MIT OCW' },
      { title: 'Stanford CS154 — Automata Theory', link: '#', tag: 'Stanford' },
      { title: 'NPTEL — Theory of Computation (IIT)', link: '#', tag: 'NPTEL' },
    ]},
    { cat: 'Quick References', icon: '⚡', items: [
      { title: 'Regular Expression Cheat Sheet', link: '#', tag: 'Reference' },
      { title: 'Pumping Lemma Guide', link: '#', tag: 'Concept' },
      { title: 'CYK Algorithm Walkthrough', link: '#', tag: 'Algorithm' },
    ]},
  ];

  return (
    <div className="resources-tab">
      <div className="resources-header">
        <h2>📖 TOC Learning Resources</h2>
        <p>Curated books, lectures and references for Theory of Computation</p>
      </div>
      <div className="resources-grid">
        {resources.map(cat => (
          <div key={cat.cat} className="resource-category">
            <h3 className="resource-cat-title"><span>{cat.icon}</span>{cat.cat}</h3>
            <div className="resource-items">
              {cat.items.map(item => (
                <a key={item.title} href={item.link} className="resource-item" target="_blank" rel="noopener noreferrer">
                  <div className="resource-item__content">
                    <span className="resource-item__title">{item.title}</span>
                    <span className="resource-item__tag">{item.tag}</span>
                  </div>
                  <span className="resource-item__arrow">→</span>
                </a>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── Quiz Flow Wrapper ──────────────────────────────────────────────────────────
function QuizFlowTab() {
  const navigate = useNavigate();
  const [step, setStep] = useState<'select' | 'quiz'>('select');
  const [questions, setQuestions] = useState<QuizQuestion[]>([]);
  const [selectedTopics, setSelectedTopics] = useState<string[]>([]);
  const [merged, setMerged] = useState(false);
  const [timerSeconds, setTimerSeconds] = useState(60);

  const handleStartQuiz = (topics: string[], qs: QuizQuestion[], merge: boolean, timer: number) => {
    setSelectedTopics(topics);
    setQuestions(qs);
    setMerged(merge);
    setTimerSeconds(timer);
    setStep('quiz');
  };

  const handleQuizComplete = (r: QuestionResult[]) => {
    navigate('/toc/scorecard', {
      state: {
        latestResults: r,
        questions,
        topics: selectedTopics,
        merged,
      },
    });
  };

  const handleRestart = () => {
    setStep('select');
    setQuestions([]);
  };

  if (step === 'select') return <TopicSelector onStart={handleStartQuiz} />;
  return (
    <QuizSession
      questions={questions}
      timerSeconds={timerSeconds}
      onComplete={handleQuizComplete}
      onExit={handleRestart}
    />
  );
}

// ── TOC Subject Page ───────────────────────────────────────────────────────────
type Tab = 'visualizer' | 'quiz' | 'scorecard' | 'resources' | '';

export default function TOCSubjectPage() {
  const navigate = useNavigate();
  const location = useLocation();

  const pathParts = location.pathname.split('/');
  const activeTab = pathParts[pathParts.length - 1] as Tab;
  const showTabs = ['visualizer', 'quiz', 'scorecard', 'resources'].includes(activeTab);

  const tabs: { id: Exclude<Tab, ''>; label: string; icon: string; path: string }[] = [
    { id: 'visualizer', label: 'Visualizer', icon: '🔬', path: '/toc/visualizer' },
    { id: 'quiz', label: 'Quiz', icon: '⚡', path: '/toc/quiz' },
    { id: 'scorecard', label: 'Scorecards', icon: '📊', path: '/toc/scorecard' },
    { id: 'resources', label: 'Resources', icon: '📖', path: '/toc/resources' },
  ];

  return (
    <div className="subject-page-root" style={{ height: '100vh', overflow: 'hidden', position: 'relative' }}>
      <BackgroundOrbs />
      {/* ── Top nav bar ── */}
      <header className="subject-page-navbar" style={{ position: 'relative', zIndex: 10 }}>
        <button className="subject-page-back" onClick={() => navigate(showTabs ? '/toc' : '/')}>
          {showTabs ? '← Back to Menu' : '← Back to CS Nexus'}
        </button>

        <div className="subject-page-brand">
          <div className="subject-page-brand__dot" style={{ background: '#6366f1', boxShadow: '0 0 12px #6366f1' }} />
          <span className="neon-glow-text-cyan" style={{ fontStyle: 'italic', fontWeight: 800, cursor: 'pointer' }} onClick={() => navigate('/toc')}>
            Automata Visualizer & Studio
          </span>
          <span className="subject-page-brand__code" style={{ background: 'rgba(99, 102, 241, 0.15)', border: '1px solid rgba(99, 102, 241, 0.3)', color: '#a5b4fc' }}>
            DFA · NFA · PDA · TM
          </span>
        </div>

        {showTabs && activeTab !== 'visualizer' && (
          <div className="subject-page-tabs">
            {tabs.map(tab => (
              <button
                key={tab.id}
                className={`subject-tab-btn${activeTab === tab.id ? ' active' : ''}`}
                onClick={() => navigate(tab.path)}
              >
                {tab.icon} {tab.label}
              </button>
            ))}
          </div>
        )}

        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8, background: 'rgba(16, 185, 129, 0.1)', border: '1px solid rgba(16, 185, 129, 0.25)', padding: '4px 12px', borderRadius: 99 }}>
          <div className="pulse-dot" style={{ background: '#10b981', boxShadow: '0 0 8px #10b981' }} />
          <span style={{ fontSize: 11, fontWeight: 700, color: '#34d399' }}>⚡ AI Engine Active (Groq / Local)</span>
        </div>
      </header>

      {/* ── Tab content ── */}
      <div className="subject-page-content" style={{ position: 'static', height: 'calc(100vh - 54px)' }}>
        <Routes>
          <Route path="/" element={<TOCLandingPage />} />
          <Route path="visualizer" element={<AutomataVisualizerTab />} />
          <Route path="quiz" element={<QuizFlowTab />} />
          <Route path="scorecard" element={<ScoreCardPage />} />
          <Route path="resources" element={<ResourcesTab />} />
          <Route path="*" element={<Navigate to="" replace />} />
        </Routes>
      </div>
    </div>
  );
}
