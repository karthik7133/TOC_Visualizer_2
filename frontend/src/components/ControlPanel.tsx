import { useState, useEffect, useRef } from 'react';
import axios from 'axios';
import { AutomatonSchema, AutomatonType, InputType } from '../types/schema';
import ImageUploadPanel from './ImageUploadPanel';

interface Props {
  onAutomatonGenerated: (a: AutomatonSchema) => void;
  onInputTypeChange?:    (t: InputType) => void;
  onPromptChange?:      (p: string) => void;
  onRegexChange?:       (r: string) => void;
}

const INPUT_TYPES: { value: InputType; label: string; desc: string }[] = [
  { value: 'regex',            label: 'Regex',    desc: 'Regular expression' },
  { value: 'cfg',              label: 'CFG',      desc: 'Context-free grammar' },
  { value: 'pda-json',         label: 'PDA JSON', desc: 'Direct PDA definition' },
  { value: 'tm-json',          label: 'TM JSON',  desc: 'Turing machine JSON' },
  { value: 'natural-language', label: 'AI',       desc: 'Natural language' },
  { value: 'image',            label: 'Scan',     desc: 'Upload diagram' },
];

const MACHINE_TYPES = [
  { value: AutomatonType.DFA, label: 'DFA' },
  { value: AutomatonType.NFA, label: 'NFA' },
  { value: AutomatonType.PDA, label: 'PDA' },
  { value: AutomatonType.TM,  label: 'TM'  },
];

const PLACEHOLDERS: Record<InputType, string> = {
  'regex':            '(a|b)*abb',
  'cfg':              'S -> 0S1 | e',
  'pda-json':         '{"type":"PDA","states":["q0","q1","q2"],"alphabet":["a","b"],...}',
  'tm-json':          '{ "type": "TM", "states": [...] }',
  'natural-language': 'e.g. "PDA for L={a^n b^n | n>=1}"',
  'image':            '',
};

const AI_EXAMPLES: { label: string; prompt: string; type?: AutomatonType }[] = [
  // ── DFA ──────────────────────────────────────────────────────────────────
  { label: 'Binary strings ending in 00',              prompt: 'DFA that accepts binary strings ending in 00',              type: AutomatonType.DFA },
  { label: 'Strings over {a,b} containing abb',        prompt: 'DFA over {a,b} that accepts strings containing abb',        type: AutomatonType.DFA },
  { label: 'Strings with even number of 0s',           prompt: 'DFA over {0,1} with even number of 0s',                     type: AutomatonType.DFA },
  // ── NFA ──────────────────────────────────────────────────────────────────
  { label: 'Strings starting with a or ending with b', prompt: 'NFA that accepts strings starting with a or ending with b',  type: AutomatonType.NFA },
  // ── PDA — Equal counts ────────────────────────────────────────────────────
  { label: 'PDA: equal a\'s and b\'s',                 prompt: 'PDA for strings over {a,b} with equal number of a\'s and b\'s', type: AutomatonType.PDA },
  { label: 'PDA: n_a(w) = n_b(w)',                     prompt: 'PDA for L = {w in {a,b}* | n_a(w) = n_b(w)}',              type: AutomatonType.PDA },
  // ── PDA — a^n b^n family ──────────────────────────────────────────────────
  { label: 'PDA: a^n b^n (n ≥ 1)',                     prompt: 'PDA for L = {a^n b^n | n >= 1}',                            type: AutomatonType.PDA },
  { label: 'PDA: a^n b^2n (n ≥ 1)',                    prompt: 'PDA for L = {a^n b^2n | n >= 1}',                           type: AutomatonType.PDA },
  { label: 'PDA: a^2n b^n (n ≥ 1)',                    prompt: 'PDA for L = {a^2n b^n | n >= 1}',                           type: AutomatonType.PDA },
  { label: 'PDA: a^n b^n c^m (m ≥ 0)',                 prompt: 'PDA for L = {a^n b^n c^m | n >= 1, m >= 0}',               type: AutomatonType.PDA },
  { label: 'PDA: a^n b^m c^n (a\'s = c\'s)',           prompt: 'PDA for L = {a^n b^m c^n | n,m >= 1}',                     type: AutomatonType.PDA },
  { label: 'PDA: a^n b^m c^(n+m)',                     prompt: 'PDA for L = {a^n b^m c^(n+m) | n,m >= 1}',                 type: AutomatonType.PDA },
  // ── PDA — Palindromes ─────────────────────────────────────────────────────
  { label: 'PDA: palindromes over {a,b}',              prompt: 'PDA for palindromes over {a,b}',                            type: AutomatonType.PDA },
  { label: 'PDA: even palindromes ww^R',               prompt: 'PDA for even palindromes ww^R over {a,b}',                 type: AutomatonType.PDA },
  // ── PDA — Balanced ───────────────────────────────────────────────────────
  { label: 'PDA: balanced parentheses',                prompt: 'PDA for balanced parentheses',                              type: AutomatonType.PDA },
  // ── PDA — Union ──────────────────────────────────────────────────────────
  { label: 'PDA: a^i b^j c^k where i=j or j=k',       prompt: 'PDA for L = {a^i b^j c^k | i = j or j = k, i,j,k >= 1}',  type: AutomatonType.PDA },
  // ── PDA — Comparison ─────────────────────────────────────────────────────
  { label: 'PDA: more a\'s than b\'s',                 prompt: 'PDA for strings over {a,b} with more a\'s than b\'s',      type: AutomatonType.PDA },
];

const EXAMPLES: Partial<Record<InputType, { label: string; value: string }[]>> = {
  regex: [
    { label: '(a|b)*abb',  value: '(a|b)*abb'  },
    { label: 'a*b+',       value: 'a*b+'        },
    { label: '(ab)+c*',    value: '(ab)+c*'     },
  ],
  cfg: [
    { label: 'S → 0S1 | ε  (balanced)', value: 'S -> 0S1 | e' },
    { label: 'S → aSb | ab  (a^n b^n)', value: 'S -> aSb | ab' },
  ],
  'pda-json': [
    {
      label: 'a^n b^n PDA',
      value: JSON.stringify({
        type: 'PDA', states: ['q0','q1','q2'],
        alphabet: ['a','b'], stackAlphabet: ['Z','A'],
        startState: 'q0', acceptStates: ['q2'], startStackSymbol: 'Z',
        transitions: {
          q0: { 'ε': [{ topOfStack:'Z', targetState:'q1', pushSymbols:['A','Z'] }] },
          q1: {
            a: [{ topOfStack:'A', targetState:'q1', pushSymbols:['A','A'] }],
            b: [{ topOfStack:'A', targetState:'q1', pushSymbols:[] }],
            'ε': [{ topOfStack:'Z', targetState:'q2', pushSymbols:['Z'] }],
          },
          q2: {},
        },
      }, null, 2),
    },
  ],
};

// AI thinking messages that cycle while waiting
const THINKING_MSGS = [
  'Loading model into GPU…',
  'Parsing your description…',
  'Designing states…',
  'Building transition table…',
  'Verifying JSON schema…',
  'Almost there…',
];

export default function ControlPanel({ onAutomatonGenerated, onInputTypeChange, onPromptChange, onRegexChange }: Props) {
  const [inputType,   setInputType]   = useState<InputType>('regex');
  const [machineType, setMachineType] = useState<AutomatonType>(AutomatonType.DFA);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [elapsed,     setElapsed]     = useState(0);
  const [thinkIdx,    setThinkIdx]    = useState(0);

  const timerRef  = useRef<ReturnType<typeof setInterval> | null>(null);
  const msgRef    = useRef<ReturnType<typeof setInterval> | null>(null);
  const isAI      = inputType === 'natural-language';
  const isPDAJson = inputType === 'pda-json';
  const isTMJson  = inputType === 'tm-json';

  // When pda-json is selected, force machine type to PDA
  useEffect(() => {
    if (isPDAJson) setMachineType(AutomatonType.PDA);
  }, [isPDAJson]);

  // Elapsed clock + cycling message while loading AI
  useEffect(() => {
    if (loading && isAI) {
      setElapsed(0);
      setThinkIdx(0);
      timerRef.current = setInterval(() => setElapsed(s => s + 1), 1000);
      msgRef.current   = setInterval(() => setThinkIdx(i => (i + 1) % THINKING_MSGS.length), 3500);
    } else {
      if (timerRef.current) { clearInterval(timerRef.current); timerRef.current = null; }
      if (msgRef.current)   { clearInterval(msgRef.current);   msgRef.current   = null; }
    }
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (msgRef.current)   clearInterval(msgRef.current);
    };
  }, [loading, isAI]);

  const handleGenerate = async () => {
    if (!input.trim()) { setError('Input cannot be empty.'); return; }
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.post('/api/generate', { inputType, machineType, input }, {
        timeout: 300_000,   // 5 minutes — matches server + proxy timeout
      });
      onAutomatonGenerated(data.automaton);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.error ?? e.message)
        : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

  const inputLabel =
    inputType === 'image'            ? 'Upload Diagram Image'      :
    inputType === 'natural-language' ? 'Natural Language Prompt'  :
    inputType === 'regex'            ? 'Regular Expression'        :
    inputType === 'cfg'              ? 'Context-Free Grammar'      :
    inputType === 'pda-json'         ? 'PDA JSON Definition'       : 'Turing Machine JSON';

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{ padding: '16px 16px 12px', borderBottom: '1px solid var(--border-subtle)', flexShrink: 0 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
          <div style={{
            width: 24, height: 24,
            background: 'var(--accent-muted)',
            border: '1px solid rgba(99,102,241,0.2)',
            borderRadius: 6,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 12, color: 'var(--accent-hover)',
          }}>⚙</div>
          <span style={{ fontSize: 13, fontWeight: 600, color: 'var(--text-primary)' }}>Configure</span>
        </div>
        <p style={{ fontSize: 11, color: 'var(--text-tertiary)', marginTop: 4 }}>
          Build and generate automata
        </p>
      </div>

      {/* ── Scrollable body ── */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '16px', display: 'flex', flexDirection: 'column', gap: '20px' }}>

        {/* Machine type */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Machine Type</p>
          <div className="seg-group">
            {MACHINE_TYPES.map(m => (
              <button
                key={m.value}
                className={`seg-btn ${machineType === m.value ? 'active' : ''}`}
                onClick={() => setMachineType(m.value)}
              >
                {m.label}
              </button>
            ))}
          </div>
        </div>

        {/* Input mode */}
        <div>
          <p className="label" style={{ marginBottom: 8 }}>Input Mode</p>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
            {INPUT_TYPES.map(t => (
              <button
                key={t.value}
                onClick={() => {
                setInputType(t.value);
                setInput('');
                setError(null);
                onInputTypeChange?.(t.value);
                onPromptChange?.('');
                onRegexChange?.('');
              }}
                style={{
                  display: 'flex', alignItems: 'center', gap: 10,
                  padding: '7px 10px',
                  borderRadius: 'var(--radius-sm)',
                  border: '1px solid',
                  borderColor: inputType === t.value ? 'rgba(99,102,241,0.35)' : 'transparent',
                  background: inputType === t.value ? 'var(--accent-muted)' : 'transparent',
                  cursor: 'pointer', textAlign: 'left', width: '100%',
                  transition: 'all var(--duration) var(--ease)',
                }}
              >
                <span style={{
                  fontSize: 12, fontWeight: 600,
                  color: inputType === t.value ? 'var(--accent-hover)' : 'var(--text-secondary)',
                  minWidth: 44, fontFamily: 'var(--font-mono)',
                }}>
                  {t.label}
                </span>
                <span style={{ fontSize: 11, color: inputType === t.value ? 'var(--accent-hover)' : 'var(--text-tertiary)' }}>
                  {t.desc}
                </span>
                {/* AI badge */}
                {t.value === 'natural-language' && (
                  <span style={{
                    marginLeft: 'auto',
                    fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                    padding: '1px 6px', borderRadius: 99,
                    background: 'rgba(168,85,247,0.15)',
                    border: '1px solid rgba(168,85,247,0.3)',
                    color: '#c084fc',
                  }}>
                    Qwen 2.5
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* Input textarea */}
        <div style={{ flex: 1 }}>
          <p className="label" style={{ marginBottom: 8 }}>{inputLabel}</p>
          {inputType === 'image' ? (
            <ImageUploadPanel
              onAutomatonGenerated={onAutomatonGenerated}
              onInputTypeChange={onInputTypeChange}
            />
          ) : (
            <textarea
              className="textarea"
              value={input}
              onChange={e => {
                setInput(e.target.value);
                if (isAI) onPromptChange?.(e.target.value);
                if (inputType === 'regex') onRegexChange?.(e.target.value);
              }}
              placeholder={PLACEHOLDERS[inputType]}
              rows={isTMJson || isPDAJson ? 8 : isAI ? 5 : 4}
              spellCheck={false}
              disabled={loading}
            />
          )}
        </div>

        {/* AI prompt examples */}
        {isAI && !loading && (
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Example Prompts</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {AI_EXAMPLES.map(ex => (
                <button
                  key={ex.prompt}
                  className="example-chip"
                  onClick={() => {
                    setInput(ex.prompt);
                    if (ex.type) setMachineType(ex.type);
                  }}
                >
                  <span style={{ color: '#7c3aed' }}>✦</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Regular examples */}
        {EXAMPLES[inputType] && !isAI && (
          <div>
            <p className="label" style={{ marginBottom: 8 }}>Examples</p>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              {EXAMPLES[inputType]!.map(ex => (
                <button key={ex.value} className="example-chip" onClick={() => setInput(ex.value)}>
                  <span style={{ color: 'var(--text-disabled)' }}>→</span>
                  {ex.label}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── AI Thinking card ── */}
        {loading && isAI && (
          <div style={{
            background: 'var(--accent-muted)',
            border: '1px solid var(--border-subtle)',
            borderRadius: 10,
            padding: '14px 16px',
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
          }}>
            {/* Top row: spinner + message */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <span className="spinner" style={{ borderTopColor: 'var(--accent)', flexShrink: 0 }} />
              <span style={{ fontSize: 12, color: 'var(--accent)', fontWeight: 500 }}>
                {THINKING_MSGS[thinkIdx]}
              </span>
            </div>

            {/* Elapsed bar */}
            <div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}>
                <span style={{ fontSize: 10, color: 'var(--text-secondary)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  Elapsed
                </span>
                <span style={{ fontSize: 11, fontFamily: 'var(--font-mono)', color: 'var(--accent-hover)', fontWeight: 700 }}>
                  {fmt(elapsed)}
                </span>
              </div>
              {/* Animated shimmer bar */}
              <div style={{
                height: 3, borderRadius: 99,
                background: 'rgba(79,70,229,0.1)',
                overflow: 'hidden',
                position: 'relative',
              }}>
                <div style={{
                  position: 'absolute',
                  inset: 0,
                  background: 'linear-gradient(90deg, transparent 0%, var(--accent) 50%, transparent 100%)',
                  backgroundSize: '200% 100%',
                  animation: 'shimmer 1.8s ease-in-out infinite',
                }} />
              </div>
            </div>

            {/* RTX info */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: '#10b981',
                boxShadow: '0 0 6px #10b981',
              }} />
              <span style={{ fontSize: 10, color: 'var(--text-secondary)' }}>
                RTX 3050 · 39% CPU / 61% GPU · ~2–4 min
              </span>
            </div>
          </div>
        )}

        {error && <div className="error-box">{error}</div>}
      </div>

      {/* ── Footer / Generate ── */}
      {inputType !== 'image' && (
        <div style={{ padding: '12px 16px', borderTop: '1px solid var(--border-subtle)', flexShrink: 0 }}>
          <button
            className="btn primary"
            style={{ width: '100%', padding: '9px', fontSize: 13 }}
            onClick={handleGenerate}
            disabled={loading}
          >
            {loading ? (
              isAI
                ? <><span className="spinner" style={{ borderTopColor: '#fff' }} /> AI Thinking… {fmt(elapsed)}</>
                : <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Generating…</>
            ) : (
              isAI ? '✦ Generate with AI' : 'Generate Automaton'
            )}
          </button>
        </div>
      )}
    </div>
  );
}
