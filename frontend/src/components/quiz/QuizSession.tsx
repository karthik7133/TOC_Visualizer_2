import { useState, useEffect, useRef, useCallback } from 'react';
import { QuizQuestion, QuestionResult } from '../../pages/TOCSubjectPage';
import { X, Check, ArrowRight, BarChart3, AlertCircle, CheckCircle, Clock } from 'lucide-react';

// ── Timer ring SVG ─────────────────────────────────────────────────────────────
function TimerRing({ timeLeft, total, accent }: { timeLeft: number; total: number; accent: string }) {
  const R = 38;
  const circumference = 2 * Math.PI * R;
  const progress = total > 0 ? timeLeft / total : 1;
  const offset = circumference * (1 - progress);
  const isWarning = total > 0 && timeLeft <= Math.min(10, total * 0.2);
  const color = isWarning ? '#ef4444' : accent;

  return (
    <div className="qs-timer-ring" style={{ position: 'relative', width: 90, height: 90 }}>
      <svg width="90" height="90" viewBox="0 0 90 90" style={{ transform: 'rotate(-90deg)' }}>
        <circle cx="45" cy="45" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="6" />
        <circle
          cx="45" cy="45" r={R}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 1s linear, stroke 0.3s ease', filter: `drop-shadow(0 0 6px ${color})` }}
        />
      </svg>
      <div style={{ position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
        {total === 0 ? (
          <span style={{ fontSize: 11, color: 'var(--text-tertiary)', fontFamily: 'var(--font-mono)' }}>∞</span>
        ) : (
          <>
            <span style={{ fontSize: 20, fontWeight: 700, fontFamily: 'var(--font-mono)', color: isWarning ? '#ef4444' : 'var(--text-primary)', lineHeight: 1 }}>
              {timeLeft}
            </span>
            <span style={{ fontSize: 9, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>sec</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
interface Props {
  questions: QuizQuestion[];
  timerSeconds: number;
  onComplete: (results: QuestionResult[]) => void;
  onExit: () => void;
}

const ACCENT_MAP: Record<string, string> = {
  'DFA': '#6366f1',
  'NFA': '#8b5cf6',
  'CFG': '#06b6d4',
  'Regular Expressions': '#10b981',
  'PDA': '#f59e0b',
  'Turing Machine': '#ef4444',
};

export default function QuizSession({ questions, timerSeconds, onComplete, onExit }: Props) {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [selected, setSelected] = useState<number | null>(null);
  const [revealed, setRevealed] = useState(false);
  const [timeLeft, setTimeLeft] = useState(timerSeconds);
  const [results, setResults] = useState<QuestionResult[]>([]);

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const questionStartRef = useRef(Date.now());

  const question = questions[currentIdx];
  const accent = ACCENT_MAP[question?.topic] ?? '#6366f1';

  // ── Reset timer on question change ──────────────────────────────────────────
  useEffect(() => {
    setSelected(null);
    setRevealed(false);
    setTimeLeft(timerSeconds);
    questionStartRef.current = Date.now();

    if (timerRef.current) clearInterval(timerRef.current);
    if (timerSeconds === 0) return;

    timerRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(timerRef.current!);
          handleTimeUp();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => { if (timerRef.current) clearInterval(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentIdx]);

  const handleTimeUp = useCallback(() => {
    setRevealed(true);
    setSelected(-1); // -1 = timed out
  }, []);

  const handleOptionClick = (idx: number) => {
    if (revealed) return;
    if (timerRef.current) clearInterval(timerRef.current);
    const spent = Math.round((Date.now() - questionStartRef.current) / 1000);
    setSelected(idx);
    setRevealed(true);

    const result: QuestionResult = {
      questionId: question.id,
      topic: question.topic,
      timeSpent: timerSeconds > 0 ? Math.min(spent, timerSeconds) : spent,
      isCorrect: idx === question.correctIndex,
      selectedIndex: idx,
      correctIndex: question.correctIndex,
      question: question.question,
    };
    setResults(prev => [...prev, result]);
  };

  const handleNext = () => {
    if (!revealed) return;
    // If user timed out and hasn't submitted result yet, record it
    if (selected === -1 && results.length === currentIdx) {
      // already recorded in handleTimeUp path
    }
    const isLast = currentIdx === questions.length - 1;
    if (isLast) {
      onComplete(results);
    } else {
      setCurrentIdx(prev => prev + 1);
    }
  };

  // Record timed-out result
  useEffect(() => {
    if (revealed && selected === -1 && results.length === currentIdx) {
      const result: QuestionResult = {
        questionId: question.id,
        topic: question.topic,
        timeSpent: timerSeconds,
        isCorrect: false,
        selectedIndex: -1,
        correctIndex: question.correctIndex,
        question: question.question,
      };
      setResults(prev => [...prev, result]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [revealed]);

  if (!question) return null;

  const progress = ((currentIdx) / questions.length) * 100;
  const isLast = currentIdx === questions.length - 1;
  const answeredCorrectly = results.filter(r => r.isCorrect).length;

  const getOptionStyle = (idx: number) => {
    if (!revealed) {
      return {
        borderColor: 'rgba(255,255,255,0.08)',
        background: 'rgba(255,255,255,0.02)',
        color: 'var(--text-primary)',
      };
    }
    if (idx === question.correctIndex) {
      return {
        borderColor: 'rgba(16,185,129,0.6)',
        background: 'rgba(16,185,129,0.12)',
        color: '#6ee7b7',
        boxShadow: '0 0 16px rgba(16,185,129,0.2)',
      };
    }
    if (idx === selected && selected !== question.correctIndex) {
      return {
        borderColor: 'rgba(239,68,68,0.6)',
        background: 'rgba(239,68,68,0.10)',
        color: '#fca5a5',
        boxShadow: '0 0 16px rgba(239,68,68,0.2)',
      };
    }
    return {
      borderColor: 'rgba(255,255,255,0.04)',
      background: 'transparent',
      color: 'var(--text-tertiary)',
      opacity: 0.5,
    };
  };

  return (
    <div className="qs-root">
      {/* ── Top bar ── */}
      <div className="qs-topbar">
        <button className="qs-exit-btn" onClick={onExit} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <X size={14} /> Exit
        </button>

        <div className="qs-progress-info">
          <span className="qs-progress-counter">
            <span style={{ color: accent, fontWeight: 700 }}>{currentIdx + 1}</span>
            <span style={{ color: 'var(--text-tertiary)' }}> / {questions.length}</span>
          </span>
          <div className="qs-progress-track">
            <div className="qs-progress-fill" style={{ width: `${progress}%`, background: accent, boxShadow: `0 0 8px ${accent}88` }} />
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span className="qs-score-live" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Check size={14} style={{ color: 'var(--success)' }} /> {answeredCorrectly} correct
          </span>
          <TimerRing timeLeft={timeLeft} total={timerSeconds} accent={accent} />
        </div>
      </div>

      {/* ── Question card ── */}
      <div className="qs-card" style={{ borderColor: accent + '33', boxShadow: `0 0 40px ${accent}18` }}>
        {/* Topic badge */}
        <div className="qs-topic-badge" style={{ color: accent, background: accent + '18', borderColor: accent + '44' }}>
          {question.topic} · Q{currentIdx + 1}
        </div>

        {/* Question text */}
        <h2 className="qs-question-text">{question.question}</h2>

        {/* Options */}
        <div className="qs-options">
          {question.options.map((opt, idx) => (
            <button
              key={idx}
              className={`qs-option${selected === idx ? ' selected' : ''}${revealed && idx === question.correctIndex ? ' correct' : ''}${revealed && selected === idx && idx !== question.correctIndex ? ' wrong' : ''}`}
              style={getOptionStyle(idx)}
              onClick={() => handleOptionClick(idx)}
              disabled={revealed}
            >
              <span className="qs-option__letter">
                {['A', 'B', 'C', 'D'][idx]}
              </span>
              <span className="qs-option__text">{opt.replace(/^[A-D]\)\s*/, '')}</span>
              {revealed && idx === question.correctIndex && (
                <span className="qs-option__result correct" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Check size={12} strokeWidth={3} />
                </span>
              )}
              {revealed && idx === selected && idx !== question.correctIndex && (
                <span className="qs-option__result wrong" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={12} strokeWidth={3} />
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Explanation */}
        {revealed && (
          <div className="qs-explanation anim-in">
            <div className="qs-explanation__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', color: selected === -1 ? '#f59e0b' : selected === question.correctIndex ? '#10b981' : '#f43f5e' }}>
              {selected === -1 ? <Clock size={20} /> : selected === question.correctIndex ? <CheckCircle size={20} /> : <AlertCircle size={20} />}
            </div>
            <div>
              <div className="qs-explanation__verdict">
                {selected === -1 ? 'Time\'s Up!' : selected === question.correctIndex ? 'Correct!' : 'Incorrect'}
              </div>
              <div className="qs-explanation__text">{question.explanation}</div>
            </div>
          </div>
        )}
      </div>

      {/* ── Next button ── */}
      {revealed && (
        <div className="qs-footer anim-in">
          <button
            className="qs-next-btn"
            onClick={handleNext}
            style={{ background: `linear-gradient(135deg, ${accent}, ${accent}99)`, boxShadow: `0 4px 20px ${accent}44`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
          >
            {isLast ? (
              <>
                <BarChart3 size={14} /> View Results
              </>
            ) : (
              <>
                Next Question <ArrowRight size={14} />
              </>
            )}
          </button>
        </div>
      )}
    </div>
  );
}
