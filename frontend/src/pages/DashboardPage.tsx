import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import BackgroundOrbs from '../components/BackgroundOrbs';
import { Sparkles, GraduationCap, BookOpen, Cpu, Bot, Zap, Lock } from 'lucide-react';

// ── Subject definitions ────────────────────────────────────────────────────────
const SUBJECTS = [
  {
    id: 'toc',
    code: 'CS301',
    title: 'Theory of Computation',
    short: 'TOC',
    tagline: 'Automata, Formal Languages & Computability',
    description: 'Explore DFAs, NFAs, PDAs, Turing Machines, CFGs and Regular Expressions with AI-powered visualization and quizzes.',
    topics: ['DFA', 'NFA', 'CFG', 'Regular Expr', 'PDA', 'Turing Machines'],
    image: '/toc_bg.png',
    gradient: 'linear-gradient(135deg, rgba(99,102,241,0.35) 0%, rgba(168,85,247,0.2) 100%)',
    accentColor: '#a855f7',
    glowColor: 'rgba(99,102,241,0.5)',
    borderColor: 'rgba(99,102,241,0.4)',
    active: true,
    route: '/toc',
  },
  {
    id: 'nlp',
    code: 'CS402',
    title: 'Natural Language Processing',
    short: 'NLP',
    tagline: 'Text, Semantics & Language Models',
    description: 'Tokenization, embeddings, transformers, named entity recognition and sentiment analysis from fundamentals to LLMs.',
    topics: ['Tokenization', 'Embeddings', 'Transformers', 'NER', 'Sentiment', 'LLMs'],
    image: '/nlp_bg.png',
    gradient: 'linear-gradient(135deg, rgba(6,182,212,0.35) 0%, rgba(16,185,129,0.2) 100%)',
    accentColor: '#06b6d4',
    glowColor: 'rgba(6,182,212,0.5)',
    borderColor: 'rgba(6,182,212,0.4)',
    active: false,
    route: '/nlp',
  },
  {
    id: 'ai',
    code: 'CS403',
    title: 'Artificial Intelligence',
    short: 'AI',
    tagline: 'Search, Reasoning & Machine Learning',
    description: 'From search algorithms and constraint satisfaction to deep learning, reinforcement learning and generative AI.',
    topics: ['Search', 'CSP', 'Bayesian', 'Neural Nets', 'RL', 'GenAI'],
    image: '/ai_bg.png',
    gradient: 'linear-gradient(135deg, rgba(249,115,22,0.35) 0%, rgba(245,158,11,0.2) 100%)',
    accentColor: '#f97316',
    glowColor: 'rgba(249,115,22,0.5)',
    borderColor: 'rgba(249,115,22,0.4)',
    active: false,
    route: '/ai',
  },
  {
    id: 'cn',
    code: 'CS404',
    title: 'Computer Networks',
    short: 'CN',
    tagline: 'Protocols, Routing & Network Security',
    description: 'TCP/IP stack, routing protocols, congestion control, DNS, HTTP/2, network security and modern SDN architectures.',
    topics: ['OSI Model', 'TCP/IP', 'Routing', 'DNS', 'Security', 'SDN'],
    image: '/cn_bg.png',
    gradient: 'linear-gradient(135deg, rgba(59,130,246,0.35) 0%, rgba(6,182,212,0.2) 100%)',
    accentColor: '#3b82f6',
    glowColor: 'rgba(59,130,246,0.5)',
    borderColor: 'rgba(59,130,246,0.4)',
    active: false,
    route: '/cn',
  },
  {
    id: 'dsa',
    code: 'CS201',
    title: 'Data Structures & Algorithms',
    short: 'DSA',
    tagline: 'Complexity, Trees, Graphs & Dynamic Programming',
    description: 'Master arrays, trees, heaps, graphs, sorting, dynamic programming and algorithmic problem-solving techniques.',
    topics: ['Arrays', 'Trees', 'Graphs', 'Sorting', 'DP', 'Complexity'],
    image: '/dsa_bg.png',
    gradient: 'linear-gradient(135deg, rgba(34,197,94,0.35) 0%, rgba(132,204,22,0.2) 100%)',
    accentColor: '#22c55e',
    glowColor: 'rgba(34,197,94,0.5)',
    borderColor: 'rgba(34,197,94,0.4)',
    active: false,
    route: '/dsa',
  },
];

// ── Particle canvas ────────────────────────────────────────────────────────────
function ParticleCanvas() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    let animId: number;
    const particles: { x: number; y: number; vx: number; vy: number; r: number; o: number; color: string }[] = [];
    const COLORS = ['rgba(99,102,241,', 'rgba(168,85,247,', 'rgba(6,182,212,', 'rgba(249,115,22,'];

    const resize = () => {
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener('resize', resize);

    for (let i = 0; i < 80; i++) {
      particles.push({
        x: Math.random() * window.innerWidth,
        y: Math.random() * window.innerHeight,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        r: Math.random() * 2 + 0.5,
        o: Math.random() * 0.6 + 0.1,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }

    const draw = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        if (p.x < 0) p.x = canvas.width;
        if (p.x > canvas.width) p.x = 0;
        if (p.y < 0) p.y = canvas.height;
        if (p.y > canvas.height) p.y = 0;

        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
        ctx.fillStyle = p.color + p.o + ')';
        ctx.fill();
      });

      // Draw connections
      particles.forEach((p1, i) => {
        particles.slice(i + 1).forEach(p2 => {
          const dx = p1.x - p2.x;
          const dy = p1.y - p2.y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 100) {
            ctx.beginPath();
            ctx.moveTo(p1.x, p1.y);
            ctx.lineTo(p2.x, p2.y);
            ctx.strokeStyle = `rgba(99,102,241,${0.06 * (1 - dist / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        });
      });

      animId = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      style={{ position: 'fixed', inset: 0, zIndex: 0, pointerEvents: 'none' }}
    />
  );
}

// ── Subject Card ───────────────────────────────────────────────────────────────
function SubjectCard({ subject, index }: { subject: typeof SUBJECTS[0]; index: number }) {
  const navigate = useNavigate();
  const [hovered, setHovered] = useState(false);
  const [tilt, setTilt] = useState({ x: 0, y: 0 });
  const cardRef = useRef<HTMLDivElement>(null);

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!cardRef.current) return;
    const rect = cardRef.current.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const dx = (e.clientX - cx) / (rect.width / 2);
    const dy = (e.clientY - cy) / (rect.height / 2);
    setTilt({ x: dy * -8, y: dx * 8 });
  };

  const handleMouseLeave = () => {
    setHovered(false);
    setTilt({ x: 0, y: 0 });
  };

  return (
    <div
      ref={cardRef}
      className="subject-card"
      style={{
        animationDelay: `${index * 0.1}s`,
        transform: hovered
          ? `perspective(1000px) rotateX(${tilt.x}deg) rotateY(${tilt.y}deg) translateY(-8px) scale(1.02)`
          : 'perspective(1000px) rotateX(0deg) rotateY(0deg) translateY(0) scale(1)',
        transition: hovered
          ? 'transform 0.1s ease-out'
          : 'transform 0.5s cubic-bezier(0.34,1.56,0.64,1)',
        border: `1px solid ${hovered ? subject.borderColor : 'rgba(255,255,255,0.07)'}`,
        boxShadow: hovered
          ? `0 20px 60px rgba(0,0,0,0.5), 0 0 40px ${subject.glowColor}, inset 0 1px 0 rgba(255,255,255,0.1)`
          : '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.05)',
      }}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={handleMouseLeave}
      onMouseMove={handleMouseMove}
      onClick={() => subject.active && navigate(subject.route)}
    >
      {/* Background image — pointer-events:none so clicks reach the card */}
      <div className="subject-card__bg" style={{ backgroundImage: `url(${subject.image})`, pointerEvents: 'none' }} />
      {/* Gradient overlay */}
      <div className="subject-card__gradient" style={{ background: subject.gradient, pointerEvents: 'none' }} />

      {/* Top row */}
      <div className="subject-card__top">
        <span className="subject-card__code">{subject.code}</span>
        {subject.active ? (
          <span className="subject-card__badge active">Active</span>
        ) : (
          <span className="subject-card__badge coming">Coming Soon</span>
        )}
      </div>

      {/* Short name */}
      <div className="subject-card__short" style={{ color: subject.accentColor, textShadow: `0 0 20px ${subject.glowColor}` }}>
        {subject.short}
      </div>

      {/* Title & tagline */}
      <h3 className="subject-card__title">{subject.title}</h3>
      <p className="subject-card__tagline">{subject.tagline}</p>

      {/* Description */}
      <p className="subject-card__desc">{subject.description}</p>

      {/* Topics pills */}
      <div className="subject-card__topics">
        {subject.topics.map(t => (
          <span key={t} className="subject-card__topic-pill" style={{ borderColor: subject.accentColor + '33', color: subject.accentColor + 'cc' }}>
            {t}
          </span>
        ))}
      </div>

      {/* CTA */}
      <div className="subject-card__footer">
        {subject.active ? (
          <button
            className="subject-card__cta"
            style={{ background: subject.gradient, boxShadow: `0 4px 20px ${subject.glowColor}` }}
            onClick={(e) => { e.stopPropagation(); navigate(subject.route); }}
          >
            Explore →
          </button>
        ) : (
          <button className="subject-card__cta locked" disabled style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '6px' }}>
            <Lock size={12} /> Coming Soon
          </button>
        )}
      </div>
    </div>
  );
}

// ── Onboarding Screen ────────────────────────────────────────────────────────
const OB_SLIDES = [
  { glyph: "⚙", title: <>Welcome to <span>CS Nexus</span></>, desc: "A focused practice ground for Theory of Computation — and soon, every core CS subject you're learning." },
  { glyph: "🧩", title: <>Quiz yourself, <span>topic by topic</span></>, desc: "Generate infinite MCQs for DFA, NFA, CFG, and PDAs. Build a streak and challenge your weak spots." },
  { glyph: "🔁", title: <>Watch automata run, <span>step by step</span></>, desc: "Input a string and see exactly how a machine processes it. Visual debugging for formal languages." },
  { glyph: "📈", title: <>See your growth, <span>not just your score</span></>, desc: "Your dashboard tracks speed, accuracy per topic, and total mastery. Let's get to work." }
];

function OnboardingScreen({ onComplete }: { onComplete: () => void }) {
  const [obIndex, setObIndex] = useState(0);
  const slide = OB_SLIDES[obIndex];

  return (
    <div className="screen-ob">
      <div className="ob-wrap">
        <div className="ob-card" key={obIndex}>
          <div className="ob-glyph">{slide.glyph}</div>
          <h2 className="ob-title">{slide.title}</h2>
          <p className="ob-desc">{slide.desc}</p>
          <div className="ob-dots">
            {OB_SLIDES.map((_, i) => (
              <div key={i} className={`ob-dot ${i === obIndex ? 'on' : ''}`} />
            ))}
          </div>
          <div className="ob-actions" style={{ marginTop: 12 }}>
            <button className="ob-btn ob-btn-ghost" onClick={() => {
              if(obIndex > 0) setObIndex(obIndex - 1);
              else onComplete();
            }}>
              {obIndex === 0 ? "Skip intro" : "Back"}
            </button>
            <button className="ob-btn ob-btn-primary" onClick={() => {
              if (obIndex < OB_SLIDES.length - 1) setObIndex(obIndex + 1);
              else onComplete();
            }}>
              {obIndex === OB_SLIDES.length - 1 ? "Get started" : "Continue"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Dashboard Page ─────────────────────────────────────────────────────────────
export default function DashboardPage() {
  const [mounted, setMounted] = useState(false);
  const [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => { 
    setTimeout(() => setMounted(true), 50); 
    if (localStorage.getItem('cs-nexus-onboarding-complete') !== 'true') {
      setShowOnboarding(true);
    }
  }, []);

  const handleOnboardingComplete = () => {
    localStorage.setItem('cs-nexus-onboarding-complete', 'true');
    setShowOnboarding(false);
  };

  return (
    <div className="dashboard-root" style={{ position: 'relative' }}>
      <div className="crazy-grid"></div>
      <BackgroundOrbs />
      <ParticleCanvas />

      {showOnboarding && <OnboardingScreen onComplete={handleOnboardingComplete} />}

      <div className="dashboard-content" style={{ opacity: mounted && !showOnboarding ? 1 : 0, transition: 'opacity 0.6s ease' }}>

        <header className="dashboard-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <div className="dashboard-logo">
              <div className="dashboard-logo__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                <Sparkles size={20} />
              </div>
              <span className="dashboard-logo__text">CS Nexus</span>
            </div>
            <p className="dashboard-header__sub">Your intelligent CS learning companion</p>
          </div>
          <button 
            onClick={() => setShowOnboarding(true)}
            style={{
              background: 'var(--glass-fill)', border: '1px solid var(--glass-border)',
              color: 'var(--text-mid)', padding: '6px 12px', borderRadius: '8px',
              fontSize: '12px', cursor: 'pointer', transition: 'all 0.2s',
            }}
            onMouseOver={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'var(--glass-fill-strong)' }}
            onMouseOut={(e) => { e.currentTarget.style.color = 'var(--text-mid)'; e.currentTarget.style.background = 'var(--glass-fill)' }}
          >
            Replay Intro
          </button>
        </header>

        {/* ── Hero text ── */}
        <section className="dashboard-hero">
          <div className="dashboard-hero__pill" style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
            <GraduationCap size={14} /> 5 Core CS Subjects
          </div>
          <h1 className="dashboard-hero__title neon-glow-text" style={{ fontWeight: 800 }}>
            Master Computer Science
            <br />
            <span className="dashboard-hero__gradient">with AI-Powered Learning</span>
          </h1>
          <p className="dashboard-hero__subtitle">
            Interactive visualizations, AI-generated quizzes, real-time feedback
            and deep analytics — all in one place.
          </p>
        </section>

        {/* ── Stats row ── */}
        <div className="dashboard-stats">
          {[
            { label: 'Subjects', value: '5', icon: <BookOpen size={20} style={{ color: '#818cf8' }} /> },
            { label: 'TOC Topics', value: '6', icon: <Cpu size={20} style={{ color: '#ec4899' }} /> },
            { label: 'AI Models', value: '2', icon: <Bot size={20} style={{ color: '#fb923c' }} /> },
            { label: 'Quizzes', value: '∞', icon: <Zap size={20} style={{ color: '#facc15' }} /> },
          ].map(s => (
            <div key={s.label} className="dashboard-stat">
              <span className="dashboard-stat__icon" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{s.icon}</span>
              <span className="dashboard-stat__value">{s.value}</span>
              <span className="dashboard-stat__label">{s.label}</span>
            </div>
          ))}
        </div>

        {/* ── Subject grid ── */}
        <section className="subjects-grid">
          {SUBJECTS.map((subject, i) => (
            <SubjectCard key={subject.id} subject={subject} index={i} />
          ))}
        </section>

        {/* ── Footer ── */}
        <footer className="dashboard-footer">
          <span>CS Nexus · Powered by Claude & GPT-4o</span>
          <span>TOC Visualizer + AI Quiz Engine</span>
        </footer>
      </div>
    </div>
  );
}
