/**
 * ImageUploadPanel
 *
 * Drag-and-drop image uploader that sends the image to /api/scan-image
 * (minicpm-v4.6:1b via Ollama) and:
 *   1. Immediately renders the extracted ε-NFA/NFA/DFA on the graph canvas.
 *   2. Shows "Remove ε" and "Convert to DFA" buttons when hasEpsilon is true.
 *   3. Provides a premium animated drag-and-drop UX with image preview.
 */

import { useState, useRef, useCallback, DragEvent, ChangeEvent } from 'react';
import axios from 'axios';
import { AutomatonSchema, NFASchema, InputType } from '../types/schema';

interface Props {
  onAutomatonGenerated: (a: AutomatonSchema) => void;
  onInputTypeChange?:   (t: InputType) => void;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScanResult {
  automaton:  NFASchema;
  hasEpsilon: boolean;
  states:     number;
  transitions: number;
}

// ─── Utility: Image Compression ───────────────────────────────────────────────
async function compressImage(file: File, maxWidth = 1600): Promise<File> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const img = new Image();
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) return resolve(file);
        
        // Fill white background in case of transparent PNGs
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(0, 0, width, height);
        ctx.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob((blob) => {
          if (!blob) return resolve(file);
          resolve(new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", { type: 'image/jpeg' }));
        }, 'image/jpeg', 0.95);
      };
      img.onerror = () => resolve(file);
      img.src = event.target?.result as string;
    };
    reader.onerror = () => resolve(file);
    reader.readAsDataURL(file);
  });
}

// ─── Upload icon SVG ──────────────────────────────────────────────────────────

function UploadIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"
      style={{ color: '#c084fc' }}
    >
      <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" />
      <polyline points="17 8 12 3 7 8" />
      <line x1="12" y1="3" x2="12" y2="15" />
    </svg>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ImageUploadPanel({ onAutomatonGenerated }: Props) {
  const [dragOver,   setDragOver]   = useState(false);
  const [loading,    setLoading]    = useState(false);
  const [converting, setConverting] = useState<'nfa' | 'dfa' | null>(null);
  const [error,      setError]      = useState<string | null>(null);
  const [preview,    setPreview]    = useState<string | null>(null);   // data URL
  const [file,       setFile]       = useState<File | null>(null);
  const [result,     setResult]     = useState<ScanResult | null>(null);

  // Keep a ref to the last scanned NFASchema for conversion
  const scannedRef = useRef<NFASchema | null>(null);
  const inputRef   = useRef<HTMLInputElement>(null);

  // ── Drag events ──
  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(true);
  }, []);
  const onDragLeave = useCallback(() => setDragOver(false), []);

  const onDrop = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const dropped = e.dataTransfer.files[0];
    if (dropped && dropped.type.startsWith('image/')) handleFile(dropped);
    else setError('Please drop an image file (JPEG, PNG, WebP).');
  }, []);

  // ── File picker ──
  const onFileChange = (e: ChangeEvent<HTMLInputElement>) => {
    const picked = e.target.files?.[0];
    if (picked) handleFile(picked);
  };

  // ── Shared file handler ──
  function handleFile(f: File) {
    setError(null);
    setResult(null);
    scannedRef.current = null;
    setFile(f);

    // Create preview URL
    const reader = new FileReader();
    reader.onload = ev => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  // ── Scan via qwen3-vl ──
  async function handleScan() {
    if (!file) return;
    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const form = new FormData();
      const compressedFile = await compressImage(file, 800);
      form.append('image', compressedFile);

      const { data } = await axios.post('/api/scan-image', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
        timeout: 300_000,   // 5 min — vision model can be slow on first load
      });

      const scanned: NFASchema = data.automaton;
      scannedRef.current = scanned;

      setResult({
        automaton:   scanned,
        hasEpsilon:  data.hasEpsilon,
        states:      scanned.states.length,
        transitions: Object.values(scanned.transitions)
          .flatMap(cm => Object.values(cm).flat()).length,
      });

      onAutomatonGenerated(scanned);
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.error ?? e.message)
        : String(e);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  // ── Convert (ε-removal or subset construction) ──
  async function handleConvert(target: 'nfa' | 'dfa') {
    if (!scannedRef.current) return;
    setConverting(target);
    setError(null);

    try {
      const { data } = await axios.post('/api/convert', {
        automaton: scannedRef.current,
        target,
      }, { timeout: 30_000 });

      onAutomatonGenerated(data.automaton);

      // If removing ε → update stored ref for subsequent DFA conversion
      if (target === 'nfa') {
        scannedRef.current = data.automaton;
        setResult(prev => prev ? { ...prev, hasEpsilon: false } : prev);
      }
    } catch (e: unknown) {
      const msg = axios.isAxiosError(e)
        ? (e.response?.data?.error ?? e.message)
        : String(e);
      setError(msg);
    } finally {
      setConverting(null);
    }
  }

  // ── Clear ──
  function handleClear() {
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    scannedRef.current = null;
    if (inputRef.current) inputRef.current.value = '';
  }

  const isProcessing = loading || converting !== null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>

      {/* ── Drag-and-drop zone ── */}
      {!preview ? (
        <div
          className={`upload-zone${dragOver ? ' drag-over' : ''}`}
          onDragOver={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          tabIndex={0}
          onKeyDown={e => e.key === 'Enter' && inputRef.current?.click()}
          role="button"
          aria-label="Upload automaton diagram image"
        >
          <input
            ref={inputRef}
            className="upload-zone__input"
            type="file"
            accept="image/*"
            onChange={onFileChange}
            disabled={isProcessing}
          />
          <div className="upload-zone__icon">
            <UploadIcon />
          </div>
          <span className="upload-zone__title">
            Drop diagram image here
          </span>
          <span className="upload-zone__sub">
            or click to browse · JPEG, PNG, WebP
          </span>
        </div>
      ) : (
        /* ── Preview + controls ── */
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {/* Image preview */}
          <div style={{ position: 'relative' }}>
            <img
              src={preview}
              alt="Uploaded automaton diagram"
              className="image-preview"
            />
            {/* Clear button */}
            <button
              onClick={handleClear}
              disabled={isProcessing}
              title="Remove image"
              style={{
                position: 'absolute', top: 6, right: 6,
                width: 22, height: 22,
                borderRadius: '50%',
                background: 'rgba(0,0,0,0.65)',
                border: '1px solid rgba(255,255,255,0.15)',
                color: '#94a3b8',
                fontSize: 12, cursor: 'pointer',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                backdropFilter: 'blur(4px)',
                transition: 'background 150ms, color 150ms',
              }}
              onMouseEnter={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(244,63,94,0.7)'; (e.currentTarget as HTMLButtonElement).style.color = '#fff'; }}
              onMouseLeave={e => { (e.currentTarget as HTMLButtonElement).style.background = 'rgba(0,0,0,0.65)'; (e.currentTarget as HTMLButtonElement).style.color = '#94a3b8'; }}
            >✕</button>
          </div>

          {/* File info */}
          <div style={{ fontSize: 10, color: 'var(--text-tertiary)', display: 'flex', gap: 6, alignItems: 'center' }}>
            <span style={{ fontFamily: 'var(--font-mono)', color: 'var(--text-secondary)' }}>
              {file?.name}
            </span>
            <span>·</span>
            <span>{((file?.size ?? 0) / 1024).toFixed(0)} KB</span>
          </div>
        </div>
      )}

      {/* ── Scan button ── */}
      {file && !result && (
        <button
          className="btn primary"
          style={{ width: '100%', padding: '9px', fontSize: 13 }}
          onClick={handleScan}
          disabled={isProcessing}
        >
          {loading ? (
            <><span className="spinner" style={{ borderTopColor: '#fff' }} /> Scanning with qwen3-vl:2b…</>
          ) : (
            <>🔍 Scan Automaton</>
          )}
        </button>
      )}

      {/* ── Scan result summary ── */}
      {result && !loading && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>

          {/* Success bar */}
          <div className="scan-result">
            <div className="dot" />
            <span>
              Extracted <strong>{result.states} states</strong> · {result.transitions} transitions
              {result.hasEpsilon && (
                <span className="eps-badge" style={{ marginLeft: 8 }}>ε-NFA</span>
              )}
            </span>
          </div>

          {/* ε-conversion actions */}
          {result.hasEpsilon && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              <p className="label" style={{ marginBottom: 2 }}>Convert</p>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  className="conversion-btn"
                  onClick={() => handleConvert('nfa')}
                  disabled={isProcessing}
                  style={{ flex: 1 }}
                >
                  {converting === 'nfa'
                    ? <><span className="spinner" style={{ borderTopColor: '#c084fc' }} /> Removing ε…</>
                    : <>∅ε → NFA</>
                  }
                </button>
                <button
                  className="conversion-btn dfa"
                  onClick={() => handleConvert('dfa')}
                  disabled={isProcessing}
                  style={{ flex: 1 }}
                >
                  {converting === 'dfa'
                    ? <><span className="spinner" style={{ borderTopColor: '#93c5fd' }} /> Building DFA…</>
                    : <>→ DFA</>
                  }
                </button>
              </div>
            </div>
          )}

          {/* Re-scan button */}
          <button
            className="btn"
            style={{ width: '100%', fontSize: 11, padding: '6px' }}
            onClick={() => { setResult(null); scannedRef.current = null; }}
            disabled={isProcessing}
          >
            ↺ Re-scan image
          </button>
        </div>
      )}

      {/* ── Loading state with thinking messages ── */}
      {loading && (
        <div style={{
          background: 'var(--accent-muted)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 10,
          padding: '12px 14px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <span className="spinner" style={{ borderTopColor: 'var(--accent)', flexShrink: 0 }} />
            <span style={{ fontSize: 11, color: 'var(--accent)', fontWeight: 500 }}>
              qwen3-vl:2b is reading the diagram…
            </span>
          </div>
          <p style={{ fontSize: 10, color: 'var(--text-tertiary)', lineHeight: 1.5 }}>
            The vision model is identifying states, arrows, and labels. First query may take 30–60s while the model loads into VRAM.
          </p>
        </div>
      )}

      {/* ── Error ── */}
      {error && <div className="error-box">{error}</div>}

      {/* ── Vision model info ── */}
      <div className="vision-info">
        <div className="model-dot" />
        <span>qwen3-vl:2b · local · Ollama · zero cloud cost</span>
      </div>
    </div>
  );
}
