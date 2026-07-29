import { useMemo } from 'react';
import { QuizQuestion, QuestionResult } from '../../pages/TOCSubjectPage';
import { BarChart3, Check, X, Clock, Hourglass, TrendingUp, AlertTriangle, RefreshCw, Zap } from 'lucide-react';

// ── Animated donut chart ───────────────────────────────────────────────────────
function DonutChart({ percent, color }: { percent: number; color: string }) {
  const R = 54;
  const circumference = 2 * Math.PI * R;
  const offset = circumference * (1 - percent / 100);

  const grade =
    percent >= 90 ? { label: 'S', text: 'Outstanding!' } :
    percent >= 75 ? { label: 'A', text: 'Excellent!' } :
    percent >= 60 ? { label: 'B', text: 'Good Job!' } :
    percent >= 45 ? { label: 'C', text: 'Keep Practicing' } :
    { label: 'D', text: 'Needs Review' };

  return (
    <div className="sc-donut-wrap">
      <svg width="140" height="140" viewBox="0 0 140 140">
        {/* Background ring */}
        <circle cx="70" cy="70" r={R} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="10" />
        {/* Progress ring */}
        <circle
          cx="70" cy="70" r={R}
          fill="none"
          stroke={color}
          strokeWidth="10"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{
            transform: 'rotate(-90deg)',
            transformOrigin: 'center',
            transition: 'stroke-dashoffset 1.5s cubic-bezier(0.34,1.56,0.64,1)',
            filter: `drop-shadow(0 0 8px ${color})`,
          }}
        />
        {/* Center text */}
        <text x="70" y="62" textAnchor="middle" fill="white" fontSize="26" fontWeight="800" fontFamily="Inter, sans-serif">
          {Math.round(percent)}%
        </text>
        <text x="70" y="80" textAnchor="middle" fill={color} fontSize="13" fontWeight="700" fontFamily="Inter, sans-serif">
          Grade {grade.label}
        </text>
        <text x="70" y="96" textAnchor="middle" fill="rgba(255,255,255,0.4)" fontSize="9" fontFamily="Inter, sans-serif">
          {grade.text.toUpperCase()}
        </text>
      </svg>
    </div>
  );
}

// ── Time bar visualization ─────────────────────────────────────────────────────
function TimeBar({ avgTime, maxTime, color }: { avgTime: number; maxTime: number; color: string }) {
  const width = maxTime > 0 ? Math.min((avgTime / maxTime) * 100, 100) : 0;
  return (
    <div style={{ flex: 1, height: 6, background: 'rgba(255,255,255,0.05)', borderRadius: 99, overflow: 'hidden' }}>
      <div style={{ height: '100%', width: `${width}%`, background: color, borderRadius: 99, boxShadow: `0 0 6px ${color}88`, transition: 'width 1s ease' }} />
    </div>
  );
}

// ── Props ──────────────────────────────────────────────────────────────────────
interface Props {
  results: QuestionResult[];
  questions: QuizQuestion[];
  topics: string[];
  merged: boolean;
  onRetry: () => void;
}

const TOPIC_COLORS: Record<string, string> = {
  'DFA': '#6366f1', 'NFA': '#8b5cf6', 'CFG': '#06b6d4',
  'Regular Expressions': '#10b981', 'PDA': '#f59e0b', 'Turing Machine': '#ef4444',
};

export default function ScoreCard({ results, questions, topics, merged, onRetry }: Props) {
  // ── Analytics computations ────────────────────────────────────────────────
  const analytics = useMemo(() => {
    const total = results.length;
    const correct = results.filter(r => r.isCorrect).length;
    const overallPct = total > 0 ? Math.round((correct / total) * 100) : 0;
    const totalTime = results.reduce((s, r) => s + r.timeSpent, 0);
    const avgTime = total > 0 ? Math.round(totalTime / total) : 0;

    // Per-topic stats
    const topicMap: Record<string, { correct: number; total: number; totalTime: number; times: number[] }> = {};
    results.forEach(r => {
      if (!topicMap[r.topic]) topicMap[r.topic] = { correct: 0, total: 0, totalTime: 0, times: [] };
      topicMap[r.topic].total++;
      topicMap[r.topic].totalTime += r.timeSpent;
      topicMap[r.topic].times.push(r.timeSpent);
      if (r.isCorrect) topicMap[r.topic].correct++;
    });

    const topicStats = Object.entries(topicMap).map(([topic, s]) => ({
      topic,
      correct: s.correct,
      total: s.total,
      accuracy: Math.round((s.correct / s.total) * 100),
      avgTime: Math.round(s.totalTime / s.total),
      color: TOPIC_COLORS[topic] ?? '#6366f1',
    }));

    // Slowest 3 questions
    const slowest = [...results].sort((a, b) => b.timeSpent - a.timeSpent).slice(0, 3);

    // Weak areas: accuracy < 60% OR avg time > overall avg * 1.5
    const weakAreas = topicStats.filter(
      t => t.accuracy < 60 || t.avgTime > avgTime * 1.5
    );

    const maxAvgTime = Math.max(...topicStats.map(t => t.avgTime), 1);

    return { total, correct, overallPct, avgTime, totalTime, topicStats, slowest, weakAreas, maxAvgTime };
  }, [results]);

  const gradeColor =
    analytics.overallPct >= 90 ? '#10b981' :
    analytics.overallPct >= 75 ? '#6366f1' :
    analytics.overallPct >= 60 ? '#f59e0b' : '#ef4444';

  return (
    <div className="sc-root">
      {/* ── Header ── */}
      <div className="sc-header">
        <h2 className="sc-header__title" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
          <BarChart3 size={22} style={{ color: '#06b6d4' }} /> Quiz Analytics
        </h2>
        <p className="sc-header__sub">
          {merged ? `${topics.join(' + ')} (Merged)` : topics.join(', ')} · {analytics.total} questions
        </p>
      </div>

      {/* ── Hero row ── */}
      <div className="sc-hero">
        {/* Donut */}
        <div className="sc-hero__donut">
          <DonutChart percent={analytics.overallPct} color={gradeColor} />
        </div>

        {/* Summary stats */}
        <div className="sc-hero__stats">
          {[
            { icon: <Check size={16} />, label: 'Correct', value: `${analytics.correct} / ${analytics.total}`, color: '#10b981' },
            { icon: <X size={16} />, label: 'Wrong', value: `${analytics.total - analytics.correct} / ${analytics.total}`, color: '#ef4444' },
            { icon: <Clock size={16} />, label: 'Avg Time/Q', value: `${analytics.avgTime}s`, color: '#6366f1' },
            { icon: <Hourglass size={16} />, label: 'Total Time', value: `${analytics.totalTime}s`, color: '#f59e0b' },
          ].map(stat => (
            <div key={stat.label} className="sc-stat" style={{ borderColor: stat.color + '33' }}>
              <span className="sc-stat__icon" style={{ color: stat.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{stat.icon}</span>
              <span className="sc-stat__value">{stat.value}</span>
              <span className="sc-stat__label">{stat.label}</span>
            </div>
          ))}
        </div>
      </div>

      {/* ── Per-topic breakdown ── */}
      <div className="sc-section">
        <h3 className="sc-section__title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
          <TrendingUp size={18} style={{ color: '#3b82f6' }} /> Per-Topic Breakdown
        </h3>
        <div className="sc-topic-table">
          <div className="sc-topic-table__head">
            <span>Topic</span>
            <span>Score</span>
            <span>Avg Time</span>
            <span>Time Chart</span>
          </div>
          {analytics.topicStats.map(t => (
            <div key={t.topic} className="sc-topic-row">
              <div className="sc-topic-row__name">
                <div className="sc-topic-row__dot" style={{ background: t.color, boxShadow: `0 0 6px ${t.color}` }} />
                <span>{t.topic}</span>
              </div>
              <div className="sc-topic-row__score">
                <div className="sc-accuracy-bar">
                  <div style={{ width: `${t.accuracy}%`, background: t.color, height: '100%', borderRadius: 99, boxShadow: `0 0 4px ${t.color}88`, transition: 'width 1s ease' }} />
                </div>
                <span style={{ color: t.accuracy >= 70 ? '#10b981' : t.accuracy >= 50 ? '#f59e0b' : '#ef4444', fontWeight: 700, fontSize: 13, minWidth: 40, textAlign: 'right' }}>
                  {t.accuracy}%
                </span>
              </div>
              <span className="sc-topic-row__time">{t.avgTime}s</span>
              <TimeBar avgTime={t.avgTime} maxTime={analytics.maxAvgTime} color={t.color} />
            </div>
          ))}
        </div>
      </div>

      {/* ── Weak areas ── */}
      {analytics.weakAreas.length > 0 && (
        <div className="sc-section">
          <h3 className="sc-section__title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <AlertTriangle size={18} style={{ color: '#f59e0b' }} /> Areas Needing Attention
          </h3>
          <div className="sc-weak-areas">
            {analytics.weakAreas.map(w => (
              <div key={w.topic} className="sc-weak-card" style={{ borderColor: '#f59e0b44', background: 'rgba(245,158,11,0.05)' }}>
                <div className="sc-weak-card__topic" style={{ color: w.color }}>
                  <div style={{ width: 8, height: 8, borderRadius: '50%', background: w.color, boxShadow: `0 0 6px ${w.color}` }} />
                  {w.topic}
                </div>
                <div className="sc-weak-card__issues">
                  {w.accuracy < 60 && (
                    <span className="sc-weak-tag error">Low accuracy: {w.accuracy}%</span>
                  )}
                  {w.avgTime > analytics.avgTime * 1.5 && (
                    <span className="sc-weak-tag warning">Slow: {w.avgTime}s avg (overall: {analytics.avgTime}s)</span>
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Slowest questions ── */}
      {analytics.slowest.length > 0 && (
        <div className="sc-section">
          <h3 className="sc-section__title" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <Clock size={18} style={{ color: '#6366f1' }} /> Most Time-Consuming Questions
          </h3>
          <div className="sc-slow-list">
            {analytics.slowest.map((r, i) => (
              <div key={r.questionId} className="sc-slow-item">
                <div className="sc-slow-item__rank">#{i + 1}</div>
                <div className="sc-slow-item__content">
                  <div className="sc-slow-item__q">{r.question}</div>
                  <div className="sc-slow-item__meta">
                    <span className="sc-topic-pill" style={{ color: TOPIC_COLORS[r.topic] ?? '#6366f1', borderColor: (TOPIC_COLORS[r.topic] ?? '#6366f1') + '44', background: (TOPIC_COLORS[r.topic] ?? '#6366f1') + '11' }}>{r.topic}</span>
                    <span style={{ color: 'var(--text-tertiary)', fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: '3px' }}><Clock size={12} /> {r.timeSpent}s</span>
                    <span style={{ color: r.isCorrect ? '#10b981' : '#ef4444', fontSize: 12, fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '3px' }}>
                      {r.isCorrect ? <Check size={12} strokeWidth={2.5} /> : <X size={12} strokeWidth={2.5} />} {r.isCorrect ? 'Correct' : 'Wrong'}
                    </span>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Actions ── */}
      <div className="sc-actions">
        <button className="btn" onClick={onRetry} style={{ flex: 1, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <RefreshCw size={14} /> New Quiz
        </button>
        <button className="btn primary" onClick={onRetry} style={{ flex: 2, padding: '12px 28px', fontSize: 15, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
          <Zap size={16} /> Try Again
        </button>
      </div>
    </div>
  );
}
