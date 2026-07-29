import React, { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, Zap, Binary, Activity, TrendingUp, Clock, Trophy } from 'lucide-react';

interface HistoryItem {
  id: string;
  date: string;
  topics: string[];
  percentage: number;
  timeSpent: number;
  results: { topic: string; isCorrect: boolean }[];
}

export default function TOCLandingPage() {
  const navigate = useNavigate();
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setTimeout(() => setMounted(true), 50);
    const saved = localStorage.getItem('cs_nexus_toc_quiz_history');
    if (saved) {
      setHistory(JSON.parse(saved));
    }
  }, []);

  const stats = useMemo(() => {
    if (history.length === 0) {
      return {
        avgScore: 78,
        quizzesDone: 24,
        weakestTopic: 'PDAs',
        timeStudied: '11.4h',
        trend: [62, 70, 65, 74, 80, 71, 78],
        topics: [
          { name: 'DFA Construction', score: 88, color: '#5ef2d6' },
          { name: 'NFA → DFA Conversion', score: 74, color: '#a78bfa' },
          { name: 'Context-Free Grammars', score: 69, color: '#38bdf8' },
          { name: 'Pushdown Automata', score: 52, color: '#f472b6' },
          { name: 'Turing Machines', score: 81, color: '#fbbf24' },
        ],
        recent: [
          { icon: '🎯', text: 'Scored 9/10 on CFG Ambiguity quiz', time: '2 hours ago' },
          { icon: '🔁', text: 'Traced NFA for string "aabb" in visualizer', time: '5 hours ago' },
          { icon: '❌', text: 'Missed 4/10 on Pushdown Automata drill', time: 'Yesterday' },
          { icon: '🔥', text: 'Hit a 6-day learning streak!', time: 'Yesterday' },
        ],
        streak: 6
      };
    }

    // Compute actual stats from history
    const totalQuizzes = history.length;
    const avgScore = Math.round(history.reduce((sum, h) => sum + h.percentage, 0) / totalQuizzes);
    const totalTimeSec = history.reduce((sum, h) => sum + h.timeSpent, 0);
    const timeStudied = totalTimeSec > 3600 ? (totalTimeSec / 3600).toFixed(1) + 'h' : Math.round(totalTimeSec / 60) + 'm';

    const topicStats: Record<string, { correct: number; total: number }> = {};
    history.forEach((h) => {
      h.results.forEach((r) => {
        if (!topicStats[r.topic]) topicStats[r.topic] = { correct: 0, total: 0 };
        topicStats[r.topic].total++;
        if (r.isCorrect) topicStats[r.topic].correct++;
      });
    });

    const TOPIC_COLORS: Record<string, string> = {
      'DFA': '#5ef2d6',
      'NFA': '#a78bfa',
      'CFG': '#38bdf8',
      'PDA': '#f472b6',
      'Turing Machine': '#fbbf24',
      'Regular Expressions': '#10b981',
    };

    const topicsArray = Object.entries(topicStats).map(([topic, s]) => ({
      name: topic,
      score: Math.round((s.correct / s.total) * 100),
      color: TOPIC_COLORS[topic] || '#a78bfa'
    })).sort((a, b) => b.score - a.score);

    const weakestTopic = topicsArray.length > 0 ? topicsArray[topicsArray.length - 1].name : 'N/A';

    // Mock trend for now (unless grouped by day)
    const trend = [62, 70, 65, 74, 80, 71, avgScore];

    const recent = history.slice(0, 4).map(h => ({
      icon: h.percentage >= 80 ? '🎯' : h.percentage < 50 ? '❌' : '⚡',
      text: `Scored ${h.percentage}% on ${h.topics.join(', ')} quiz`,
      time: h.date.split(',')[0]
    }));

    return {
      avgScore,
      quizzesDone: totalQuizzes,
      weakestTopic,
      timeStudied,
      trend,
      topics: topicsArray,
      recent,
      streak: 1
    };
  }, [history]);

  const dashStyles = { opacity: mounted ? 1 : 0, transition: 'opacity 0.6s ease' };

  return (
    <div className="dash-root" style={{ position: 'relative' }}>
      <div className="dash-wrap" style={dashStyles}>
        
        {/* Back and Title */}
        <div className="dash-top">
          <div className="dash-title">
            <button className="chip-link" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginBottom: 12 }}>
              <ArrowLeft size={14} /> Back to CS Nexus
            </button>
            <h1 className="neon-glow-text" style={{ margin: 0 }}>Your TOC Dashboard</h1>
            <p>Automaton drills, live visualizer, and where your score is actually coming from.</p>
          </div>
          <div className="streak-chip">
            <span style={{ fontSize: '20px' }}>🔥</span>
            <div>
              <div className="n">{stats.streak} days</div>
              <div className="l">current streak</div>
            </div>
          </div>
        </div>

        {/* Stats Row */}
        <div className="stat-row">
          <div className="stat-card">
            <div className="top">
              <div className="ico" style={{ background: 'rgba(94,242,214,0.15)', color: 'var(--accent-cyan)' }}>
                <TrendingUp size={18} />
              </div>
              <span className="delta up">▲ 6% vs last week</span>
            </div>
            <div className="val">{stats.avgScore}%</div>
            <div className="lbl">Avg. Score</div>
          </div>
          <div className="stat-card">
            <div className="top">
              <div className="ico" style={{ background: 'rgba(167,139,250,0.15)', color: 'var(--accent-violet)' }}>
                <Zap size={18} />
              </div>
              <span className="delta up">▲ {history.length === 0 ? 3 : history.length} this week</span>
            </div>
            <div className="val">{stats.quizzesDone}</div>
            <div className="lbl">Quizzes Done</div>
          </div>
          <div className="stat-card">
            <div className="top">
              <div className="ico" style={{ background: 'rgba(244,114,182,0.15)', color: 'var(--accent-pink)' }}>
                <Activity size={18} />
              </div>
              <span className="delta down">
                ▼ {stats.topics.find(t => t.name === stats.weakestTopic)?.score ?? 52}% accuracy
              </span>
            </div>
            <div className="val" style={{ fontSize: '20px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {stats.weakestTopic}
            </div>
            <div className="lbl">Weakest Topic</div>
          </div>
          <div className="stat-card">
            <div className="top">
              <div className="ico" style={{ background: 'rgba(251,191,36,0.15)', color: 'var(--accent-amber)' }}>
                <Clock size={18} />
              </div>
              <span className="delta up">▲ this month</span>
            </div>
            <div className="val">{stats.timeStudied}</div>
            <div className="lbl">Time Studied</div>
          </div>
        </div>

        {/* Practice and Explore Tiles */}
        <div className="c-panel">
          <div className="c-panel-head">
            <div>
              <span className="eyebrow">Practice & Explore</span>
              <h3 style={{ margin: 0 }}>Jump In</h3>
            </div>
          </div>
          <div className="action-tiles">
            <div className="dash-tile quiz" onClick={() => navigate('/toc/quiz')}>
              <div className="glow"></div>
              <div className="dash-tile-ico"><Zap size={20} /></div>
              <h4>Quiz Section</h4>
              <p>Timed MCQs on DFA, NFA, CFG & PDA construction.</p>
              <div className="go">Start Drill →</div>
            </div>
            <div className="dash-tile viz" onClick={() => navigate('/toc/visualizer')}>
              <div className="glow"></div>
              <div className="dash-tile-ico"><Binary size={20} /></div>
              <h4>Automata Visualizer</h4>
              <p>Step through states & transitions for any input string.</p>
              <div className="go">Open Sandbox →</div>
            </div>
          </div>
        </div>

        {/* 2 Column Layout */}
        <div className="dash-grid">
          {/* Left Column */}
          <div>
            <div className="c-panel">
              <div className="c-panel-head">
                <div>
                  <span className="eyebrow">Breakdown</span>
                  <h3 style={{ margin: 0 }}>Score by Topic</h3>
                </div>
                <button className="chip-link" onClick={() => navigate('/toc/scorecard')}>View all</button>
              </div>
              <div>
                {stats.topics.map(t => (
                  <div key={t.name} className="topic-row">
                    <div className="topic-left">
                      <div className="topic-dot" style={{ color: t.color, backgroundColor: t.color }}></div>
                      <div>
                        <div className="topic-name">{t.name}</div>
                      </div>
                    </div>
                    <div className="topic-score" style={{ color: t.color }}>{t.score}%</div>
                  </div>
                ))}
              </div>
            </div>

            <div className="c-panel">
              <div className="c-panel-head">
                <div>
                  <span className="eyebrow">Analytics</span>
                  <h3 style={{ margin: 0 }}>Score Trend</h3>
                </div>
              </div>
              <div className="bars">
                {stats.trend.map((val, i) => (
                  <div key={i} className="bar-col">
                    <div className="bar" style={{ height: mounted ? `${val}%` : '0%' }}></div>
                    <div className="bar-label">D{i + 1}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          {/* Right Column */}
          <div>
            <div className="c-panel">
              <div className="c-panel-head" style={{ marginBottom: 30 }}>
                <div>
                  <span className="eyebrow">Total Progress</span>
                  <h3 style={{ margin: 0 }}>Mastery Ring</h3>
                </div>
              </div>
              <div className="ring-wrap">
                <svg className="ring" width="140" height="140" viewBox="0 0 120 120">
                  <circle className="ring-bg" cx="60" cy="60" r="50" fill="none" strokeWidth="12" />
                  <circle 
                    className="ring-fg" 
                    cx="60" cy="60" r="50" 
                    fill="none" strokeWidth="12" 
                    strokeDasharray="314.15" 
                    strokeDashoffset={mounted ? (314.15 * (1 - (stats.avgScore / 100))) : 314.15} 
                  />
                  <text className="ring-mid-num" x="60" y="60" textAnchor="middle" dy="9">{stats.avgScore}%</text>
                </svg>
                <div style={{ flex: 1 }}>
                  <p style={{ fontSize: '13.5px', color: 'var(--text-mid)', lineHeight: 1.5, margin: 0 }}>
                    You're ahead of <span style={{ color: '#fff', fontWeight: 600 }}>71%</span> of learners on this track. Keep pushing on {stats.weakestTopic}!
                  </p>
                </div>
              </div>
            </div>

            <div className="c-panel">
              <div className="c-panel-head">
                <div>
                  <span className="eyebrow">Timeline</span>
                  <h3 style={{ margin: 0 }}>Recent Activity</h3>
                </div>
              </div>
              <div>
                {stats.recent.map((r, i) => (
                  <div key={i} className="activity-item">
                    <div className="activity-dot" style={{ background: 'rgba(255,255,255,0.06)' }}>{r.icon}</div>
                    <div>
                      <div className="activity-text">{r.text}</div>
                      <div className="activity-time">{r.time}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="c-panel">
              <div className="c-panel-head">
                <div>
                  <span className="eyebrow">Achievements</span>
                  <h3 style={{ margin: 0 }}>Badges</h3>
                </div>
              </div>
              <div className="badge-row">
                <div className="custom-badge badge-cyan">⚡ Fast Solver</div>
                <div className="custom-badge badge-violet">🎯 90%+ Streak</div>
                <div className="custom-badge badge-amber">🔥 {stats.streak}-Day Streak</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

