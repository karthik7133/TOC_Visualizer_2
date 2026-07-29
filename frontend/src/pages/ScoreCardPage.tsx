import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import ScoreCard from '../components/quiz/ScoreCard';
import { QuizQuestion, QuestionResult } from './TOCSubjectPage';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { ArrowLeft, BarChart3, Trash2, Zap, TrendingUp, Clock, Trophy, Shuffle, ArrowRight } from 'lucide-react';

interface HistoryItem {
  id: string;
  date: string;
  topics: string[];
  merged: boolean;
  results: QuestionResult[];
  questions: QuizQuestion[];
  score: number;
  total: number;
  percentage: number;
  timeSpent: number;
  avgTime: number;
}

const TOPIC_COLORS: Record<string, string> = {
  'DFA': '#6366f1',
  'NFA': '#8b5cf6',
  'CFG': '#06b6d4',
  'Regular Expressions': '#10b981',
  'PDA': '#f59e0b',
  'Turing Machine': '#ef4444',
};

export default function ScoreCardPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [activeReportId, setActiveReportId] = useState<string | null>(null);

  const state = location.state as {
    latestResults: QuestionResult[];
    questions: QuizQuestion[];
    topics: string[];
    merged: boolean;
  } | null;

  // ── Load & Save History ────────────────────────────────────────────────────
  useEffect(() => {
    // 1. Load existing history
    const saved = localStorage.getItem('cs_nexus_toc_quiz_history');
    let historyList: HistoryItem[] = saved ? JSON.parse(saved) : [];

    // 2. Add latest results if redirected from completed quiz
    if (state?.latestResults && state.questions && state.topics) {
      const newId = `quiz_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      const score = state.latestResults.filter(r => r.isCorrect).length;
      const total = state.latestResults.length;
      const timeSpent = state.latestResults.reduce((s, r) => s + r.timeSpent, 0);

      const newItem: HistoryItem = {
        id: newId,
        date: new Date().toLocaleString(),
        topics: state.topics,
        merged: state.merged,
        results: state.latestResults,
        questions: state.questions,
        score,
        total,
        percentage: total > 0 ? Math.round((score / total) * 100) : 0,
        timeSpent,
        avgTime: total > 0 ? Math.round(timeSpent / total) : 0,
      };

      // Prevent duplicate saves on react hot reloads
      const isDuplicate = historyList.some(
        (h) =>
          h.score === newItem.score &&
          h.total === newItem.total &&
          JSON.stringify(h.topics) === JSON.stringify(newItem.topics) &&
          h.results[0]?.question === newItem.results[0]?.question
      );

      if (!isDuplicate) {
        historyList.unshift(newItem);
        localStorage.setItem('cs_nexus_toc_quiz_history', JSON.stringify(historyList));
      }

      // If we just came from a quiz, automatically view its detailed scorecard
      const matchedItem = historyList.find(
        (h) =>
          h.score === newItem.score &&
          h.total === newItem.total &&
          JSON.stringify(h.topics) === JSON.stringify(newItem.topics) &&
          h.results[0]?.question === newItem.results[0]?.question
      );
      setActiveReportId(matchedItem ? matchedItem.id : newId);
      
      // Clean up location state to prevent re-adding on back navigation
      window.history.replaceState({}, document.title);
    }

    setHistory(historyList);
  }, [state]);

  // ── Calculate Cumulative Analytics ─────────────────────────────────────────
  const analytics = useMemo(() => {
    if (history.length === 0) return null;

    const totalQuizzes = history.length;
    const avgScore = Math.round(history.reduce((sum, h) => sum + h.percentage, 0) / totalQuizzes);
    const avgSpeed = Math.round(history.reduce((sum, h) => sum + h.avgTime, 0) / totalQuizzes);

    // Topic Performance Breakdown
    const topicStats: Record<string, { correct: number; total: number }> = {};
    history.forEach((h) => {
      h.results.forEach((r) => {
        if (!topicStats[r.topic]) {
          topicStats[r.topic] = { correct: 0, total: 0 };
        }
        topicStats[r.topic].total++;
        if (r.isCorrect) {
          topicStats[r.topic].correct++;
        }
      });
    });

    const topicBreakdown = Object.entries(topicStats).map(([topic, s]) => ({
      name: topic,
      accuracy: Math.round((s.correct / s.total) * 100),
      color: TOPIC_COLORS[topic] ?? '#6366f1',
    })).sort((a, b) => b.accuracy - a.accuracy);

    const bestTopic = topicBreakdown[0] ? `${topicBreakdown[0].name} (${topicBreakdown[0].accuracy}%)` : 'N/A';

    return { totalQuizzes, avgScore, avgSpeed, bestTopic, topicBreakdown };
  }, [history]);

  // ── Clear History ──────────────────────────────────────────────────────────
  const handleClearHistory = () => {
    if (window.confirm('Are you sure you want to clear your quiz history? This action cannot be undone.')) {
      localStorage.removeItem('cs_nexus_toc_quiz_history');
      setHistory([]);
      setActiveReportId(null);
    }
  };

  const activeReport = history.find((h) => h.id === activeReportId);

  return (
    <div style={{ position: 'relative', height: '100%', overflow: 'hidden' }}>
      <BackgroundOrbs />

      {activeReport ? (
        <div style={{ height: '100%', overflowY: 'auto', padding: '24px 32px', position: 'relative', zIndex: 1 }}>
          <div className="sc-detail-header-nav">
            <button className="sc-detail-back-btn" onClick={() => setActiveReportId(null)} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
              <ArrowLeft size={14} /> Back to History Dashboard
            </button>
          </div>
          <ScoreCard
            results={activeReport.results}
            questions={activeReport.questions}
            topics={activeReport.topics}
            merged={activeReport.merged}
            onRetry={() => navigate('/toc/quiz')}
          />
        </div>
      ) : (
        <div className="sc-dashboard">
          {/* Header */}
          <div className="sc-dashboard-header">
            <div className="sc-dashboard-title-wrap">
              <div className="sc-dashboard-icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <BarChart3 size={20} />
              </div>
              <div>
                <h2 className="sc-dashboard-title neon-glow-text-cyan">TOC Scorecards</h2>
                <p className="sc-dashboard-subtitle">Track your performance and master theory concepts</p>
              </div>
            </div>
            {history.length > 0 && (
              <button className="btn danger" style={{ fontSize: 12, display: 'inline-flex', alignItems: 'center', gap: '6px' }} onClick={handleClearHistory}>
                <Trash2 size={12} /> Clear History
              </button>
            )}
          </div>

          {history.length === 0 ? (
            <div className="sc-panel-card" style={{ padding: '60px 24px' }}>
              <div className="sc-empty-state">
                <div className="sc-empty-state__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <Zap size={32} />
                </div>
                <h3 className="sc-empty-state__title">No Quiz History Yet</h3>
                <p className="sc-empty-state__desc">
                  Start generating AI-powered quizzes to view detailed performance metrics, answer speed analysis, and strengths indicators.
                </p>
                <button
                  className="btn primary"
                  style={{ padding: '10px 24px', fontSize: 13, marginTop: 8 }}
                  onClick={() => navigate('/toc/quiz')}
                >
                  Configure & Start Quiz
                </button>
              </div>
            </div>
          ) : (
            <>
              {/* Aggregate Stats Cards */}
              <div className="sc-stats-grid">
                <div className="sc-stat-card">
                  <div className="sc-stat-card__icon" style={{ background: 'rgba(99,102,241,0.15)', color: '#818cf8', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Zap size={16} />
                  </div>
                  <div className="sc-stat-card__info">
                    <span className="sc-stat-card__val">{analytics?.totalQuizzes}</span>
                    <span className="sc-stat-card__label">Quizzes Completed</span>
                  </div>
                </div>

                <div className="sc-stat-card">
                  <div className="sc-stat-card__icon" style={{ background: 'rgba(16,185,129,0.15)', color: '#34d399', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <TrendingUp size={16} />
                  </div>
                  <div className="sc-stat-card__info">
                    <span className="sc-stat-card__val">{analytics?.avgScore}%</span>
                    <span className="sc-stat-card__label">Avg Accuracy</span>
                  </div>
                </div>

                <div className="sc-stat-card">
                  <div className="sc-stat-card__icon" style={{ background: 'rgba(245,158,11,0.15)', color: '#fbbf24', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Clock size={16} />
                  </div>
                  <div className="sc-stat-card__info">
                    <span className="sc-stat-card__val">{analytics?.avgSpeed}s</span>
                    <span className="sc-stat-card__label">Avg Speed / Q</span>
                  </div>
                </div>

                <div className="sc-stat-card">
                  <div className="sc-stat-card__icon" style={{ background: 'rgba(6,182,212,0.15)', color: '#22d3ee', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    <Trophy size={16} />
                  </div>
                  <div className="sc-stat-card__info">
                    <span className="sc-stat-card__val" style={{ fontSize: 13, whiteSpace: 'nowrap', textOverflow: 'ellipsis', overflow: 'hidden', maxWidth: 170 }}>
                      {analytics?.bestTopic}
                    </span>
                    <span className="sc-stat-card__label">Best Subject Area</span>
                  </div>
                </div>
              </div>

              {/* Main Dashboard Layout */}
              <div className="sc-layout-grid">
                {/* History List */}
                <div className="sc-panel-card">
                  <h3 className="sc-panel-title">Recent Quiz Activity</h3>
                  <div className="sc-history-list">
                    {history.map((item) => (
                      <div
                        key={item.id}
                        className="sc-history-item"
                        onClick={() => setActiveReportId(item.id)}
                      >
                        <div className="sc-history-item__left">
                          <div className="sc-history-item__topics">
                            {item.topics.map((t) => (
                              <span
                                key={t}
                                className="sc-history-item__topic-pill"
                                style={{
                                  borderColor: (TOPIC_COLORS[t] ?? '#6366f1') + '33',
                                  color: TOPIC_COLORS[t] ?? '#6366f1',
                                  background: (TOPIC_COLORS[t] ?? '#6366f1') + '11',
                                }}
                              >
                                {t}
                              </span>
                            ))}
                            {item.merged && item.topics.length > 1 && (
                              <span className="sc-history-item__topic-pill" style={{ borderColor: '#f59e0b33', color: '#f59e0b', background: '#f59e0b11', display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                                <Shuffle size={10} /> Merged
                              </span>
                            )}
                          </div>
                          <span className="sc-history-item__date">{item.date}</span>
                        </div>

                        <div className="sc-history-item__right">
                          <div className="sc-history-item__score-badge">
                            <span
                              className="sc-history-item__pct"
                              style={{
                                color:
                                  item.percentage >= 80 ? '#34d399' :
                                  item.percentage >= 60 ? '#fbbf24' : '#f87171',
                              }}
                            >
                              {item.percentage}%
                            </span>
                            <span className="sc-history-item__ratio">
                              {item.score} / {item.total} correct
                            </span>
                          </div>
                          <span className="sc-history-item__chevron" style={{ display: 'inline-flex', alignItems: 'center' }}>
                            <ArrowRight size={14} />
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Strengths Breakdown */}
                <div className="sc-panel-card">
                  <h3 className="sc-panel-title">Concept Strengths</h3>
                  <div className="sc-topic-progress-list">
                    {analytics?.topicBreakdown.map((t) => (
                      <div key={t.name} className="sc-topic-progress-item">
                        <div className="sc-topic-progress-info">
                          <span className="sc-topic-progress-name">{t.name}</span>
                          <span className="sc-topic-progress-score" style={{ color: t.color }}>
                            {t.accuracy}%
                          </span>
                        </div>
                        <div className="sc-topic-progress-bar-track">
                          <div
                            className="sc-topic-progress-bar-fill"
                            style={{
                              width: `${t.accuracy}%`,
                              background: t.color,
                              boxShadow: `0 0 8px ${t.color}aa`,
                            }}
                          />
                        </div>
                      </div>
                    ))}
                  </div>
                  <button
                    className="btn secondary"
                    style={{ width: '100%', marginTop: 8, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}
                    onClick={() => navigate('/toc/quiz')}
                  >
                    <Zap size={12} /> Challenge Weak Areas
                  </button>
                </div>
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
