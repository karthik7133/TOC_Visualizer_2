import { useState } from 'react';
import axios from 'axios';
import { QuizQuestion, QuestionResult } from '../../pages/TOCSubjectPage';
import { Zap, Shuffle, Check, Play, Loader2, RotateCw, GitBranch, AlignLeft, Hash, Layers, Infinity } from 'lucide-react';

// ── Topic definitions ──────────────────────────────────────────────────────────
const TOPICS = [
  { id: 'DFA', label: 'Deterministic Finite Automata', short: 'DFA', color: '#6366f1', glow: 'rgba(99,102,241,0.4)', desc: 'States, transitions, acceptance conditions' },
  { id: 'NFA', label: 'Non-deterministic Finite Automata', short: 'NFA', color: '#8b5cf6', glow: 'rgba(139,92,246,0.4)', desc: 'ε-transitions, powerset construction' },
  { id: 'CFG', label: 'Context-Free Grammars', short: 'CFG', color: '#06b6d4', glow: 'rgba(6,182,212,0.4)', desc: 'Productions, parse trees, CNF/GNF' },
  { id: 'Regular Expressions', label: 'Regular Expressions', short: 'RegEx', color: '#10b981', glow: 'rgba(16,185,129,0.4)', desc: 'Kleene star, union, concatenation' },
  { id: 'PDA', label: 'Pushdown Automata', short: 'PDA', color: '#f59e0b', glow: 'rgba(245,158,11,0.4)', desc: 'Stack alphabet, NPDA vs DPDA' },
  { id: 'Turing Machine', label: 'Turing Machines', short: 'TM', color: '#ef4444', glow: 'rgba(239,68,68,0.4)', desc: 'Tape, head, decidability, halting' },
];

const TOPIC_ICONS: Record<string, React.ReactNode> = {
  'DFA': <RotateCw size={22} />,
  'NFA': <GitBranch size={22} />,
  'CFG': <AlignLeft size={22} />,
  'Regular Expressions': <Hash size={22} />,
  'PDA': <Layers size={22} />,
  'Turing Machine': <Infinity size={22} />,
};

const TIMER_OPTIONS = [
  { label: '30s', value: 30 },
  { label: '60s', value: 60 },
  { label: '90s', value: 90 },
  { label: 'No Limit', value: 0 },
];

interface Props {
  onStart: (topics: string[], questions: QuizQuestion[], merge: boolean, timer: number) => void;
}

export default function TopicSelector({ onStart }: Props) {
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [merge, setMerge] = useState(false);
  const [timer, setTimer] = useState(60);
  const [count, setCount] = useState(10);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const toggleTopic = (id: string) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      if (next.size < 2) setMerge(false);
      return next;
    });
  };

  const handleStart = async () => {
    if (selected.size === 0) { setError('Please select at least one topic.'); return; }
    setError('');
    setLoading(true);
    try {
      const topics = Array.from(selected);
      const res = await axios.post('/api/quiz/questions', { topics, count, merge });
      onStart(topics, res.data.questions, merge, timer);
    } catch (e: any) {
      setError(e?.response?.data?.error ?? 'Failed to generate questions. Is the backend running?');
    } finally {
      setLoading(false);
    }
  };

  const selCount = selected.size;

  return (
    <div className="topic-selector-root">
      {/* Header */}
      <div className="ts-header" style={{ position: 'relative', zIndex: 1 }}>
        <div className="ts-header__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          <Zap size={20} />
        </div>
        <div>
          <h2 className="ts-header__title neon-glow-text-cyan">TOC Quiz</h2>
          <p className="ts-header__sub">Select topics and configure your quiz session</p>
        </div>
      </div>

      {/* Topic grid */}
      <div className="ts-topics-grid">
        {TOPICS.map(topic => {
          const isSelected = selected.has(topic.id);
          return (
            <button
              key={topic.id}
              className={`ts-topic-card${isSelected ? ' selected' : ''}`}
              style={{
                borderColor: isSelected ? topic.color : 'rgba(255,255,255,0.07)',
                background: isSelected
                  ? `linear-gradient(135deg, ${topic.color}18 0%, ${topic.color}08 100%)`
                  : 'rgba(255,255,255,0.02)',
                boxShadow: isSelected ? `0 0 20px ${topic.glow}, inset 0 1px 0 ${topic.color}22` : 'none',
              }}
              onClick={() => toggleTopic(topic.id)}
            >
              {isSelected && (
                <div className="ts-topic-card__check" style={{ background: topic.color, boxShadow: `0 0 10px ${topic.glow}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} strokeWidth={3} />
                </div>
              )}
              <div className="ts-topic-card__icon" style={{ color: topic.color, textShadow: `0 0 12px ${topic.glow}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', minHeight: '36px' }}>
                {TOPIC_ICONS[topic.id] ?? <Zap size={22} />}
              </div>
              <div className="ts-topic-card__short" style={{ color: topic.color }}>{topic.short}</div>
              <div className="ts-topic-card__label">{topic.label}</div>
              <div className="ts-topic-card__desc">{topic.desc}</div>
            </button>
          );
        })}
      </div>

      {/* Config panel */}
      <div className="ts-config">
        {/* Questions count */}
        <div className="ts-config__group">
          <label className="label">Questions</label>
          <div className="seg-group">
            {[5, 10, 15, 20].map(n => (
              <button key={n} className={`seg-btn${count === n ? ' active' : ''}`} onClick={() => setCount(n)}>{n}</button>
            ))}
          </div>
        </div>

        {/* Timer */}
        <div className="ts-config__group">
          <label className="label">Time per Question</label>
          <div className="seg-group">
            {TIMER_OPTIONS.map(opt => (
              <button key={opt.label} className={`seg-btn${timer === opt.value ? ' active' : ''}`} onClick={() => setTimer(opt.value)}>
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Merge toggle (only when 2+ selected) */}
        {selCount >= 2 && (
          <div className="ts-config__group">
            <label className="label">Topic Mode</label>
            <div className="seg-group">
              <button className={`seg-btn${!merge ? ' active' : ''}`} onClick={() => setMerge(false)}>Separate</button>
              <button className={`seg-btn${merge ? ' active' : ''}`} onClick={() => setMerge(true)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                <Shuffle size={12} /> Merged
              </button>
            </div>
            {merge && (
              <p className="ts-merge-hint">Questions will blend concepts from all selected topics</p>
            )}
          </div>
        )}
      </div>

      {/* Selection summary */}
      {selCount > 0 && (
        <div className="ts-summary">
          <div className="ts-summary__topics">
            {Array.from(selected).map(id => {
              const t = TOPICS.find(x => x.id === id)!;
              return (
                <span key={id} className="ts-summary__pill" style={{ borderColor: t.color + '55', color: t.color, background: t.color + '15' }}>
                  {t.short}
                </span>
              );
            })}
            {merge && selCount > 1 && (
              <span className="ts-summary__pill" style={{ borderColor: '#f59e0b55', color: '#f59e0b', background: '#f59e0b15', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                <Shuffle size={10} /> Merged
              </span>
            )}
          </div>
          <span className="ts-summary__desc">{count} questions · {timer === 0 ? 'No time limit' : `${timer}s per question`}</span>
        </div>
      )}

      {/* Error */}
      {error && <div className="error-box">{error}</div>}

      {/* Start button */}
      <button
        className="ts-start-btn"
        disabled={selCount === 0 || loading}
        onClick={handleStart}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
      >
        {loading ? (
          <>
            <Loader2 className="spinner" size={16} style={{ animation: 'spin 1s linear infinite' }} />
            Generating {count} questions with AI...
          </>
        ) : selCount === 0 ? (
          'Select at least one topic'
        ) : (
          <>
            <Play size={14} fill="currentColor" /> Start Quiz · {count} Questions
            {merge && selCount > 1 ? ` (${selCount} topics merged)` : selCount > 1 ? ` (${selCount} topics)` : ` on ${TOPICS.find(t => t.id === Array.from(selected)[0])?.short}`}
          </>
        )}
      </button>
    </div>
  );
}
