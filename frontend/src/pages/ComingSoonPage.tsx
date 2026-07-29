import { useNavigate, useLocation } from 'react-router-dom';
import { useEffect, useState } from 'react';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { MessageSquare, Bot, Globe, GitFork, ArrowLeft, Check } from 'lucide-react';

const SUBJECT_META: Record<string, { title: string; short: string; color: string; glow: string; desc: string }> = {
  nlp: { title: 'Natural Language Processing', short: 'NLP', color: '#06b6d4', glow: 'rgba(6,182,212,0.4)', desc: 'Tokenization, Embeddings, Transformers, Sentiment Analysis & LLMs' },
  ai:  { title: 'Artificial Intelligence', short: 'AI',  color: '#f97316', glow: 'rgba(249,115,22,0.4)', desc: 'Search, Reasoning, Neural Networks, RL & Generative AI' },
  cn:  { title: 'Computer Networks', short: 'CN',  color: '#3b82f6', glow: 'rgba(59,130,246,0.4)', desc: 'OSI Model, TCP/IP, Routing, DNS, Security & SDN' },
  dsa: { title: 'Data Structures & Algorithms', short: 'DSA', color: '#22c55e', glow: 'rgba(34,197,94,0.4)', desc: 'Arrays, Trees, Graphs, Sorting, Dynamic Programming & Complexity' },
};

const ICON_MAP: Record<string, React.ReactNode> = {
  nlp: <MessageSquare size={56} />,
  ai: <Bot size={56} />,
  cn: <Globe size={56} />,
  dsa: <GitFork size={56} />,
};

export default function ComingSoonPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const subject = location.pathname.replace('/', '').toLowerCase();
  const meta = SUBJECT_META[subject] ?? { title: 'Unknown Subject', short: '?', color: '#6366f1', glow: 'rgba(99,102,241,0.4)', desc: '' };
  const [dots, setDots] = useState('');

  useEffect(() => {
    const id = setInterval(() => setDots(d => d.length >= 3 ? '' : d + '.'), 500);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="coming-soon-root" style={{ position: 'relative' }}>
      <BackgroundOrbs />
      {/* Animated background */}
      <div className="coming-soon-bg" style={{ '--glow-color': meta.glow } as React.CSSProperties} />

      <button className="coming-soon-back" onClick={() => navigate('/')} style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
        <ArrowLeft size={14} /> Back to CS Nexus
      </button>

      <div className="coming-soon-card" style={{ borderColor: meta.color + '33', boxShadow: `0 0 60px ${meta.glow}` }}>
        <div className="coming-soon-icon" style={{ background: `radial-gradient(circle, ${meta.glow} 0%, transparent 70%)`, color: meta.color, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
          {ICON_MAP[subject] ?? <Globe size={56} />}
        </div>

        <div className="coming-soon-badge" style={{ color: meta.color, borderColor: meta.color + '44', background: meta.color + '11' }}>
          {meta.short} · {meta.title}
        </div>

        <h1 className="coming-soon-title neon-glow-text" style={{ textShadow: `0 0 20px ${meta.color}` }}>
          Coming Soon{dots}
        </h1>

        <p className="coming-soon-subtitle">{meta.desc}</p>

        <div className="coming-soon-progress">
          <div className="coming-soon-progress__bar">
            <div className="coming-soon-progress__fill" style={{ background: `linear-gradient(90deg, ${meta.color}, ${meta.color}88)` }} />
          </div>
          <span className="coming-soon-progress__label">Module in development</span>
        </div>

        <div className="coming-soon-features">
          {['AI-Powered Quizzes', 'Interactive Visualizations', 'Deep Analytics', 'Progress Tracking'].map(f => (
            <div key={f} className="coming-soon-feature" style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}>
              <Check size={14} style={{ color: meta.color }} />
              <span>{f}</span>
            </div>
          ))}
        </div>

        <button className="btn primary" onClick={() => navigate('/')} style={{ marginTop: 8, padding: '10px 28px', fontSize: 14, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
          <ArrowLeft size={14} /> Explore TOC (Available Now)
        </button>
      </div>
    </div>
  );
}
