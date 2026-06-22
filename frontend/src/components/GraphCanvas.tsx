import { useEffect, useRef, useState } from 'react';
import cytoscape, { Core, ElementDefinition } from 'cytoscape';
// @ts-ignore — cytoscape-dagre has no bundled types
import cytoscapeDagre from 'cytoscape-dagre';
import {
  AutomatonSchema, AutomatonType,
  DFASchema, NFASchema, PDASchema, TMSchema,
} from '../types/schema';
import { SimulationStep } from '../types/schema';

cytoscape.use(cytoscapeDagre);

interface Props {
  automaton:    AutomatonSchema | null;
  activeNodeId: string | null;
  activeEdgeId: string | null;
  currentStep?: SimulationStep | null;
}

// ─── Build cytoscape elements ─────────────────────────────────────────────────

function buildElements(automaton: AutomatonSchema): ElementDefinition[] {
  const nodes: ElementDefinition[] = [];
  const edges: ElementDefinition[] = [];

  const states: string[] =
    automaton.type === AutomatonType.TM
      ? (automaton as TMSchema).states
      : (automaton as DFASchema | NFASchema | PDASchema).states;

  const startState: string = automaton.startState;
  const acceptStates: string[] =
    automaton.type === AutomatonType.TM
      ? [(automaton as TMSchema).acceptState]
      : (automaton as DFASchema | NFASchema | PDASchema).acceptStates;

  const rejectState: string | null =
    automaton.type === AutomatonType.TM ? (automaton as TMSchema).rejectState : null;

  for (const s of states) {
    const classes: string[] = [];
    if (s === startState)         classes.push('start');
    if (acceptStates.includes(s)) classes.push('accept');
    if (s === rejectState)        classes.push('reject');
    if (s === '∅')                classes.push('dead');   // DFA dead/trap state
    nodes.push({ data: { id: s, label: s }, classes: classes.join(' ') });
  }

  // Add an invisible start-arrow-helper node and an incoming edge to startState
  if (startState) {
    nodes.push({
      data: { id: 'start-arrow-helper', label: '' },
      classes: 'start-helper'
    });
    edges.push({
      data: {
        id: 'start-arrow-edge',
        source: 'start-arrow-helper',
        target: startState,
        label: ''
      },
      classes: 'start-arrow'
    });
  }

  const selfLoopCounts: Record<string, number> = {};

  const addEdge = (id: string, source: string, target: string, label: string) => {
    const classes: string[] = [];
    if (source === target) {
      classes.push('self-loop');
      const count = selfLoopCounts[source] ?? 0;
      classes.push(`loop-${count}`);
      selfLoopCounts[source] = count + 1;
    }
    edges.push({
      data: { id, source, target, label },
      classes: classes.join(' ')
    });
  };

  if (automaton.type === AutomatonType.DFA) {
    const dfa = automaton as DFASchema;
    for (const [src, charMap] of Object.entries(dfa.transitions))
      for (const [ch, tgt] of Object.entries(charMap))
        addEdge(`${src}-${ch}-${tgt}`, src, tgt, ch);

  } else if (automaton.type === AutomatonType.NFA) {
    const nfa = automaton as NFASchema;
    // Group: (src, tgt) → list of symbols (for merged label display)
    const merged: Record<string, string[]> = {};
    for (const [src, charMap] of Object.entries(nfa.transitions ?? {})) {
      if (!charMap || typeof charMap !== 'object') continue;
      for (const [ch, targets] of Object.entries(charMap)) {
        if (!Array.isArray(targets)) continue;
        const label = ch === '' ? 'ε' : ch;
        for (const tgt of targets) (merged[`${src}__${tgt}`] ??= []).push(label);
      }
    }

    for (const [key, labels] of Object.entries(merged)) {
      const [src, tgt] = key.split('__');
      // Primary edge ID uses the first symbol (for backwards compat)
      // altIds lists ALL individual `src-sym-tgt` IDs so animation lookup works
      // for any symbol that crosses this visual edge.
      const altIds = labels.map(sym => `${src}-${sym === 'ε' ? '' : sym}-${tgt}`);
      edges.push({
        data: {
          id:     altIds[0],          // primary lookup key (first symbol)
          altIds,                     // all symbol-specific IDs
          source: src,
          target: tgt,
          label:  labels.join(', '),
        },
        classes: src === tgt ? (() => {
          const count = selfLoopCounts[src] ?? 0;
          selfLoopCounts[src] = count + 1;
          return `self-loop loop-${count}`;
        })() : '',
      });
    }

  } else if (automaton.type === AutomatonType.PDA) {
    const pda = automaton as PDASchema;
    const trans = pda.transitions;
    if (trans && typeof trans === 'object') {
      // Group transitions by (src, inp, tgt) to avoid duplicate edge IDs in cytoscape.
      // Multiple transitions with same key differ only in topOfStack/pushSymbols — merge their labels.
      const grouped: Record<string, { src: string; inp: string; tgt: string; labels: string[] }> = {};

      for (const [src, inputMap] of Object.entries(trans)) {
        if (!inputMap || typeof inputMap !== 'object') continue;
        for (const [inp, entryList] of Object.entries(inputMap)) {
          if (!Array.isArray(entryList)) continue;
          for (const e of entryList) {
            if (!e || typeof e !== 'object') continue;
            const pushSymbols = Array.isArray(e.pushSymbols) ? e.pushSymbols : [];
            const push = pushSymbols.length ? pushSymbols.join('') : 'ε';
            const tgt  = e.targetState ?? '';
            if (!tgt) continue;
            const edgeKey = `${src}-${inp}-${tgt}`;
            const inpLabel = inp === 'ε' || inp === '' ? 'ε' : inp;
            const label = `${inpLabel}, ${e.topOfStack ?? '?'} → ${push}`;
            if (!grouped[edgeKey]) grouped[edgeKey] = { src, inp, tgt, labels: [] };
            grouped[edgeKey].labels.push(label);
          }
        }
      }

      for (const [edgeKey, { src, tgt, labels }] of Object.entries(grouped)) {
        addEdge(edgeKey, src, tgt, labels.join('\n'));
      }
    }

  } else if (automaton.type === AutomatonType.TM) {
    const tm = automaton as TMSchema;
    for (const [src, readMap] of Object.entries(tm.transitions))
      for (const [read, entry] of Object.entries(readMap))
        addEdge(`${src}-${read}-${entry.targetState}`, src, entry.targetState,
          `${read} → ${entry.writeSymbol}, ${entry.direction}`);
  }

  return [...nodes, ...edges];
}

// ─── Cytoscape styles ─────────────────────────────────────────────────────────

// ─── Dynamic Cytoscape Themes ───────────────────────────────────────────────

function getCyStyle(theme: 'indigo' | 'violet' | 'teal' | 'orange') {
  const themes = {
    indigo: { accent: '#4f46e5', accentMuted: '#e0e7ff', textDark: '#312e81' },
    violet: { accent: '#7c3aed', accentMuted: '#f5f3ff', textDark: '#4c1d95' },
    teal:   { accent: '#0d9488', accentMuted: '#ccfbf1', textDark: '#115e59' },
    orange: { accent: '#ea580c', accentMuted: '#ffedd5', textDark: '#7c2d12' },
  };
  const activeColor = themes[theme].accent;
  const activeBg = themes[theme].accentMuted;
  const activeTxt = themes[theme].textDark;

  return [
    // ── Base node ──
    {
      selector: 'node',
      style: {
        'background-color':    '#ffffff',
        'border-width':        2.5,
        'border-color':        '#cbd5e1',
        'label':               'data(label)',
        'color':               '#0f172a',
        'font-family':         'Geist Mono, JetBrains Mono, monospace',
        'font-size':           13,
        'font-weight':         700,
        'text-valign':         'center',
        'text-halign':         'center',
        'width':               54,
        'height':              54,
        'text-outline-width':  0,
        'transition-property': 'border-color, background-color, border-width, color, width, height',
        'transition-duration': '350ms',
        'transition-timing-function': 'ease-in-out',
      },
    },
    // ── Start helper invisible node ──
    {
      selector: 'node.start-helper',
      style: {
        'width': 1,
        'height': 1,
        'opacity': 0,
        'events': 'no',
      },
    },
    // ── Start arrow edge pointing to startState ──
    {
      selector: 'edge.start-arrow',
      style: {
        'width': 1.5,
        'line-color': '#0ea5e9',
        'target-arrow-color': '#0ea5e9',
        'target-arrow-shape': 'vee',
        'arrow-scale': 1.0,
        'line-style': 'dashed',
        'label': '',
        'events': 'no',
      },
    },
    // ── Start state ──
    {
      selector: 'node.start',
      style: {
        'border-color': '#059669',
        'border-width': 3.5,
        'color':        '#047857',
        'background-color': '#f0fdf4',
      },
    },
    // ── Accept state (Double border for mathematical accuracy!) ──
    {
      selector: 'node.accept',
      style: {
        'border-width':     5.5,
        'border-style':     'double',
        'border-color':     '#059669',
        'background-color': '#ecfdf5',
        'color':            '#047857',
      },
    },
    // ── Dead / Trap state (DFA ∅) ──
    {
      selector: 'node.dead',
      style: {
        'border-color':     '#94a3b8',
        'border-width':     2,
        'border-style':     'dashed',
        'background-color': '#f8fafc',
        'color':            '#94a3b8',
        'font-size':        16,
      },
    },
    // ── Reject state (TM) ──
    {
      selector: 'node.reject',
      style: {
        'border-color':     '#e11d48',
        'border-width':     3,
        'color':            '#9f1239',
        'background-color': '#fff1f2',
      },
    },

    // ── ACTIVE node — dynamic theme glow ──
    {
      selector: 'node.active',
      style: {
        'background-color': activeBg,
        'border-color':     activeColor,
        'border-width':     4,
        'color':            activeTxt,
        'width':            60,
        'height':           60,
      },
    },
    // ── ACTIVE + ACCEPT (final accepted step) ──
    {
      selector: 'node.active.accept',
      style: {
        'background-color': '#d1fae5',
        'border-color':     '#059669',
        'border-width':     6.5,
        'border-style':     'double',
        'color':            '#065f46',
        'width':            62,
        'height':           62,
      },
    },
    // ── REJECTED active (stuck / rejected step) ──
    {
      selector: 'node.rejected-active',
      style: {
        'background-color': '#ffe4e6',
        'border-color':     '#e11d48',
        'border-width':     4,
        'color':            '#9f1239',
        'width':            60,
        'height':           60,
      },
    },

    // ── Base edge ──
    {
      selector: 'edge',
      style: {
        'width':                     2,
        'line-color':                '#94a3b8',
        'target-arrow-color':        '#94a3b8',
        'target-arrow-shape':        'triangle',
        'arrow-scale':               1.25,
        'curve-style':               'bezier',
        'label':                     'data(label)',
        'font-family':               'Geist Mono, JetBrains Mono, monospace',
        'font-size':                 11,
        'font-weight':               700,
        'color':                     '#1e293b',
        'edge-text-rotation':        'autorotate',
        'text-margin-y':             -10,
        'text-background-color':     '#ffffff',
        'text-background-opacity':   1,
        'text-background-padding':   '3px',
        'text-background-shape':     'roundrectangle',
        'text-border-color':         '#cbd5e1',
        'text-border-width':         1,
        'text-border-opacity':       0.8,
        'transition-property':       'line-color, width, color, target-arrow-color',
        'transition-duration':       '300ms',
        'transition-timing-function': 'ease-in-out',
      },
    },
    // ── Fallback / Default for self-loops ──
    {
      selector: 'edge.self-loop',
      style: {
        'loop-direction': '-45deg',
        'loop-sweep': '-35deg',
        'text-margin-y': -14,
      },
    },
    // ── Specific self-loops fanned out by class ──
    {
      selector: 'edge.loop-0',
      style: {
        'loop-direction': '-45deg',
        'loop-sweep': '-35deg',
        'text-margin-y': -14,
      },
    },
    {
      selector: 'edge.loop-1',
      style: {
        'loop-direction': '45deg',
        'loop-sweep': '-35deg',
        'text-margin-y': -14,
      },
    },
    {
      selector: 'edge.loop-2',
      style: {
        'loop-direction': '-135deg',
        'loop-sweep': '-35deg',
        'text-margin-y': -14,
      },
    },
    {
      selector: 'edge.loop-3',
      style: {
        'loop-direction': '135deg',
        'loop-sweep': '-35deg',
        'text-margin-y': -14,
      },
    },
    // ── ACTIVE edge — dynamic theme glow ──
    {
      selector: 'edge.active',
      style: {
        'line-color':                activeColor,
        'target-arrow-color':        activeColor,
        'width':                     4.5,
        'color':                     activeTxt,
        'text-background-color':     activeBg,
        'text-border-color':         activeColor,
        'text-border-opacity':       1,
      },
    },
    // ── TRAVERSAL edge flash — temporary flash class ──
    {
      selector: 'edge.active-flash',
      style: {
        'width':                     7.5,
        'line-color':                activeColor,
        'target-arrow-color':        activeColor,
      },
    },
  ] as any[];
}

// ─── Inject pulse keyframes once ─────────────────────────────────────────────

let keyframesInjected = false;
function injectKeyframes() {
  if (keyframesInjected) return;
  keyframesInjected = true;
  const style = document.createElement('style');
  style.textContent = `
    @keyframes node-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(99,102,241,0.7); }
      70%  { box-shadow: 0 0 0 14px rgba(99,102,241,0); }
      100% { box-shadow: 0 0 0 0   rgba(99,102,241,0); }
    }
    @keyframes accept-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(16,185,129,0.7); }
      70%  { box-shadow: 0 0 0 16px rgba(16,185,129,0); }
      100% { box-shadow: 0 0 0 0   rgba(16,185,129,0); }
    }
    @keyframes reject-pulse {
      0%   { box-shadow: 0 0 0 0   rgba(244,63,94,0.7); }
      70%  { box-shadow: 0 0 0 14px rgba(244,63,94,0); }
      100% { box-shadow: 0 0 0 0   rgba(244,63,94,0); }
    }
    @keyframes edge-flow {
      0%   { opacity: 0.6; }
      50%  { opacity: 1;   }
      100% { opacity: 0.6; }
    }
    @keyframes hud-in {
      from { opacity: 0; transform: translateY(6px); }
      to   { opacity: 1; transform: translateY(0); }
    }
  `;
  document.head.appendChild(style);
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function GraphCanvas({ automaton, activeNodeId, activeEdgeId, currentStep }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef        = useRef<Core | null>(null);
  const pulseRef     = useRef<HTMLDivElement | null>(null);

  // ─── Floating Toolbar States ───
  const [layout, setLayout] = useState<'dagre' | 'cose' | 'circle' | 'grid'>('dagre');
  const [isLocked, setIsLocked] = useState(false);
  const [colorTheme, setColorTheme] = useState<'indigo' | 'violet' | 'teal' | 'orange'>('indigo');

  useEffect(() => { injectKeyframes(); }, []);

  // Update style when theme changes
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.style(getCyStyle(colorTheme)).update();
    }
  }, [colorTheme]);

  // Update layout when layout state changes
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy || !automaton) return;

    const options: any = {
      name: layout,
      animate: true,
      animationDuration: 450,
      fit: true,
      padding: 50,
    };

    if (layout === 'dagre') {
      options.rankDir = 'LR';
      options.nodeSep = 75;
      options.rankSep = 130;
      options.edgeSep = 15;
    } else if (layout === 'cose') {
      options.nodeOverlap = 20;
      options.nestingFactor = 1.2;
      options.gravity = 1.5;
    }

    const lay = cy.layout(options);
    lay.run();
  }, [layout, automaton]);

  // Apply node dragging lock
  useEffect(() => {
    if (cyRef.current) {
      cyRef.current.autoungrabify(isLocked);
    }
  }, [isLocked]);

  // ─── Export Actions ───
  const handleExportPNG = () => {
    const cy = cyRef.current;
    if (!cy) return;
    const png64 = cy.png({ scale: 2.5, bg: '#ffffff' });
    const link = document.createElement('a');
    link.href = png64;
    link.download = `${automaton?.type || 'automaton'}-diagram.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleExportJSON = () => {
    if (!automaton) return;
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(automaton, null, 2));
    const link = document.createElement('a');
    link.href = dataStr;
    link.download = `${automaton.type || 'automaton'}-config.json`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // (Re)build graph when automaton changes
  useEffect(() => {
    if (!containerRef.current) return;
    if (cyRef.current) { cyRef.current.destroy(); cyRef.current = null; }
    if (!automaton) return;

    const cy = cytoscape({
      container: containerRef.current,
      elements:  buildElements(automaton),
      style:     getCyStyle(colorTheme),
      layout: {
        name:    layout,
        rankDir: 'LR',
        nodeSep: 75,
        rankSep: 130,
        edgeSep: 15,
        animate: false,
      } as unknown as cytoscape.LayoutOptions,
      userZoomingEnabled: true,
      userPanningEnabled: true,
      minZoom:            0.25,
      maxZoom:            4,
    });

    cy.on('layoutstop', () => {
      const startState = automaton.startState;
      const startNode = cy.getElementById(startState);
      const helperNode = cy.getElementById('start-arrow-helper');
      if (startNode.length && helperNode.length) {
        const startPos = startNode.position();
        helperNode.position({ x: startPos.x - 65, y: startPos.y });
      }
    });

    // Dagre layout may finish synchronously before the event is bound. 
    // We forcefully apply the helper position via timeout to guarantee it's placed close.
    setTimeout(() => {
      const startState = automaton.startState;
      const startNode = cy.getElementById(startState);
      const helperNode = cy.getElementById('start-arrow-helper');
      if (startNode.length && helperNode.length) {
        const startPos = startNode.position();
        helperNode.position({ x: startPos.x - 65, y: startPos.y });
      }
    }, 50);

    cyRef.current = cy;

    return () => { cy.destroy(); cyRef.current = null; };
  }, [automaton]); // eslint-disable-next-line react-hooks/exhaustive-deps

  // ── Highlight active node with class + DOM pulse ring ──
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;

    cy.nodes().removeClass('active rejected-active');

    // Remove old pulse div
    pulseRef.current?.remove();
    pulseRef.current = null;

    if (!activeNodeId || !automaton) return;

    const isRejected = currentStep?.rejected === true;
    const isAccepted = currentStep?.accepted === true;

    const themeColors = {
      indigo: '#4f46e5',
      violet: '#7c3aed',
      teal:   '#0d9488',
      orange: '#ea580c',
    };
    const activeColor = themeColors[colorTheme];

    for (const id of activeNodeId.split(',').map(s => s.trim())) {
      const node = cy.getElementById(id);
      if (!node.length) continue;

      if (isRejected) {
        node.addClass('rejected-active');
      } else {
        node.addClass('active');
      }

      // ── Inject a DOM pulse ring over the node ──
      const pos = node.renderedPosition();
      const zoom = cy.zoom();
      const size = 54 * zoom + 26;

      const ring = document.createElement('div');
      ring.style.cssText = `
        position: absolute;
        width:  ${size}px;
        height: ${size}px;
        border-radius: 50%;
        left: ${pos.x - size / 2}px;
        top:  ${pos.y - size / 2}px;
        pointer-events: none;
        z-index: 5;
        animation: ${isRejected ? 'reject-pulse' : isAccepted ? 'accept-pulse' : 'node-pulse'} 0.7s ease-out forwards;
        border: 2px solid ${isRejected ? '#e11d48' : isAccepted ? '#059669' : activeColor};
      `;
      containerRef.current?.appendChild(ring);
      pulseRef.current = ring;

      // Clean up ring after animation
      setTimeout(() => ring.remove(), 750);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeNodeId, currentStep?.stepIndex, currentStep?.rejected, currentStep?.accepted, colorTheme]);

  // ── Highlight active edge ──
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.edges().removeClass('active active-flash');
    if (!activeEdgeId) return;

    // Primary lookup by ID
    let edge = cy.getElementById(activeEdgeId);

    // Fallback: search NFA edges whose altIds array contains activeEdgeId
    if (!edge.length) {
      edge = cy.edges().filter(e => {
        const altIds: string[] | undefined = e.data('altIds');
        return Array.isArray(altIds) && altIds.includes(activeEdgeId);
      });
    }

    if (edge.length) {
      edge.addClass('active');
      edge.flashClass('active-flash', 250);
    }
  }, [activeEdgeId, currentStep?.stepIndex]);


  // ── Derive HUD info from current step ──
  const hudState  = currentStep?.state  ?? null;
  const hudSymbol = currentStep?.symbol ?? null;
  const hudAccepted = currentStep?.accepted;
  const hudRejected = currentStep?.rejected;

  const themeColors = {
    indigo: '#4f46e5',
    violet: '#7c3aed',
    teal:   '#0d9488',
    orange: '#ea580c',
  };
  const activeColor = themeColors[colorTheme];

  return (
    <div style={{
      height:   '100%',
      position: 'relative',
      overflow: 'hidden',
      background: 'var(--bg-base)',
    }}>
      {/* ── Figma-style Dotted Grid background ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        backgroundImage: 'radial-gradient(rgba(148, 163, 184, 0.22) 1.3px, transparent 1.3px)',
        backgroundSize: '24px 24px',
        pointerEvents: 'none',
        zIndex: 0,
      }} />

      {/* ── Floating Canvas Toolbar (Second row, below zoom/legend) ── */}
      {automaton && (
        <div style={{
          position: 'absolute',
          top: 60,
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 20,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          background: 'rgba(255, 255, 255, 0.92)',
          border: '1px solid var(--border-subtle)',
          borderRadius: 12,
          padding: '6px 14px',
          backdropFilter: 'blur(16px)',
          boxShadow: 'var(--shadow-md)',
          transition: 'all 200ms ease',
          whiteSpace: 'nowrap',
        }}>
          {/* Layout selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.04em', fontWeight: 700 }}>Layout</span>
            <select
              value={layout}
              onChange={e => setLayout(e.target.value as any)}
              style={{
                background: 'var(--bg-overlay)',
                border: '1px solid var(--border-subtle)',
                borderRadius: 6,
                fontSize: 11,
                padding: '3px 6px',
                color: 'var(--text-primary)',
                cursor: 'pointer',
                outline: 'none',
                fontWeight: 600,
              }}
            >
              <option value="dagre">Flow (Dagre)</option>
              <option value="cose">Force-Physics</option>
              <option value="circle">Circle</option>
              <option value="grid">Grid</option>
            </select>
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          {/* Lock Nodes Toggle */}
          <button
            onClick={() => setIsLocked(!isLocked)}
            style={{
              background: isLocked ? 'rgba(79, 70, 229, 0.08)' : 'transparent',
              border: 'none',
              borderRadius: 6,
              padding: '4px 8px',
              fontSize: 11,
              fontWeight: 600,
              color: isLocked ? 'var(--accent)' : 'var(--text-secondary)',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              transition: 'all 150ms ease',
            }}
            title={isLocked ? 'Nodes are locked in position' : 'Drag nodes to reposition them'}
          >
            <span>{isLocked ? '🔒 Locked' : '🔓 Drag'}</span>
          </button>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          {/* Dynamic Theme Color Presets */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 5 }} title="Choose accent color preset">
            {([
              { id: 'indigo', color: '#4f46e5' },
              { id: 'violet', color: '#7c3aed' },
              { id: 'teal',   color: '#0d9488' },
              { id: 'orange', color: '#ea580c' },
            ] as const).map(t => (
              <button
                key={t.id}
                onClick={() => setColorTheme(t.id)}
                style={{
                  width: 14,
                  height: 14,
                  borderRadius: '50%',
                  background: t.color,
                  border: colorTheme === t.id ? '2px solid #ffffff' : '1px solid rgba(0,0,0,0.1)',
                  boxShadow: colorTheme === t.id ? `0 0 0 2px ${t.color}` : 'none',
                  cursor: 'pointer',
                  padding: 0,
                  transition: 'all 150ms cubic-bezier(0.4, 0, 0.2, 1)',
                  transform: colorTheme === t.id ? 'scale(1.15)' : 'scale(1)',
                }}
              />
            ))}
          </div>

          <div style={{ width: 1, height: 16, background: 'var(--border-subtle)' }} />

          {/* PNG / JSON Export actions */}
          <div style={{ display: 'flex', gap: 2 }}>
            <button
              onClick={handleExportPNG}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Download diagram as PNG image"
            >
              📥 PNG
            </button>
            <button
              onClick={handleExportJSON}
              style={{
                background: 'transparent',
                border: 'none',
                borderRadius: 6,
                padding: '4px 8px',
                fontSize: 11,
                fontWeight: 600,
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                transition: 'background 150ms',
              }}
              onMouseEnter={e => e.currentTarget.style.background = 'var(--bg-overlay)'}
              onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
              title="Download configuration schema as JSON"
            >
              ⚙️ JSON
            </button>
          </div>
        </div>
      )}

      {/* ── Top-left zoom controls ── */}
      <div style={{
        position: 'absolute',
        top:      14,
        left:     14,
        zIndex:   20,
        display:  'flex',
        gap:      5,
        alignItems: 'center',
      }}>
        {[
          { title: 'Zoom In',     icon: '+',  action: () => cyRef.current?.zoom({ level: cyRef.current.zoom() * 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } }) },
          { title: 'Zoom Out',    icon: '−',  action: () => cyRef.current?.zoom({ level: cyRef.current.zoom() / 1.25, renderedPosition: { x: cyRef.current.width() / 2, y: cyRef.current.height() / 2 } }) },
          { title: 'Fit to view', icon: '⤢', action: () => cyRef.current?.fit(undefined, 48) },
        ].map(({ title, icon, action }) => (
          <button
            key={title}
            title={title}
            onClick={action}
            style={{
              width: 30,
              height: 30,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              background: 'rgba(255,255,255,0.9)',
              border: '1px solid var(--border-subtle)',
              borderRadius: 7,
              color: 'var(--text-secondary)',
              fontSize: 14,
              cursor: 'pointer',
              backdropFilter: 'blur(8px)',
              transition: 'all 150ms ease',
              boxShadow: 'var(--shadow-sm)',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'rgba(99,102,241,0.4)';
              (e.currentTarget as HTMLButtonElement).style.color = activeColor;
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = 'var(--border-subtle)';
              (e.currentTarget as HTMLButtonElement).style.color = 'var(--text-secondary)';
            }}
          >
            {icon}
          </button>
        ))}
      </div>

      {/* ── Top-right legend ── */}
      <div style={{
        position:   'absolute',
        top:        14,
        right:      14,
        zIndex:     20,
        display:    'flex',
        gap:        12,
        alignItems: 'center',
        background: 'rgba(255,255,255,0.9)',
        border:     '1px solid var(--border-subtle)',
        borderRadius: 10,
        padding:    '6px 14px',
        backdropFilter: 'blur(12px)',
        fontSize: 11,
        boxShadow: 'var(--shadow-sm)',
      }}>
        {[
          { color: '#059669', label: 'Start / Accept' },
          { color: activeColor, label: 'Active'       },
          { color: '#e11d48', label: 'Reject'         },
        ].map(item => (
          <div key={item.label} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div style={{
              width: 9, height: 9, borderRadius: '50%',
              background: item.color,
              boxShadow: `0 0 6px ${item.color}80`,
            }} />
            <span style={{ color: 'var(--text-secondary)', letterSpacing: '0.02em' }}>{item.label}</span>
          </div>
        ))}
      </div>

      {/* ── Live Step HUD — bottom center ── */}
      {hudState !== null && (
        <div
          key={`${hudState}-${hudSymbol}`}
          style={{
            position: 'absolute',
            bottom: 18,
            left: '50%',
            transform: 'translateX(-50%)',
            zIndex: 20,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            background: 'rgba(255,255,255,0.95)',
            border: `1px solid ${
              hudRejected ? '#fecdd3' :
              hudAccepted ? '#a7f3d0' :
              '#bfdbfe'
            }`,
            borderRadius: 12,
            padding: '8px 18px',
            backdropFilter: 'blur(16px)',
            animation: 'hud-in 0.2s ease-out forwards',
            boxShadow: hudRejected
              ? '0 4px 18px rgba(225,29,72,0.08)'
              : hudAccepted
              ? '0 4px 18px rgba(5,150,105,0.08)'
              : `0 4px 18px rgba(${colorTheme === 'teal' ? '13,148,136' : colorTheme === 'orange' ? '234,88,12' : colorTheme === 'violet' ? '124,58,237' : '79,70,229'}, 0.08)`,
            whiteSpace: 'nowrap',
          }}
        >
          {/* State pill */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>State</span>
            <span style={{
              fontFamily: 'Geist Mono, monospace',
              fontSize: 14,
              fontWeight: 700,
              color: hudRejected ? '#e11d48' : hudAccepted ? '#059669' : activeColor,
            }}>
              {hudState}
            </span>
          </div>

          {hudSymbol !== null && (
            <>
              <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />
              {/* Symbol pill */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <span style={{ fontSize: 10, color: 'var(--text-tertiary)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>Read</span>
                <span style={{
                  fontFamily: 'Geist Mono, monospace',
                  fontSize: 14,
                  fontWeight: 700,
                  color: '#7c3aed',
                  background: 'rgba(168,85,247,0.06)',
                  border: '1px solid rgba(168,85,247,0.15)',
                  borderRadius: 5,
                  padding: '1px 8px',
                }}>
                  {hudSymbol}
                </span>
              </div>
            </>
          )}

          {/* Verdict */}
          {(hudAccepted || hudRejected) && (
            <>
              <div style={{ width: 1, height: 22, background: 'var(--border-subtle)' }} />
              <span style={{
                fontSize: 12,
                fontWeight: 700,
                color: hudAccepted ? '#059669' : '#e11d48',
                letterSpacing: '-0.01em',
              }}>
                {hudAccepted ? '✓ Accepted' : '✗ Rejected'}
              </span>
            </>
          )}
        </div>
      )}

      {/* ── Empty state ── */}
      {!automaton && (
        <div style={{
          position:       'absolute',
          inset:          0,
          display:        'flex',
          flexDirection:  'column',
          alignItems:     'center',
          justifyContent: 'center',
          gap:            16,
          pointerEvents:  'none',
          zIndex: 10,
        }}>
          <div style={{
            width:          72,
            height:         72,
            border:         '2px dashed var(--border-default)',
            borderRadius:   '50%',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       28,
            opacity:        0.6,
            color: activeColor,
          }}>
            ◈
          </div>
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontSize: 15, fontWeight: 600, color: 'var(--text-primary)', marginBottom: 6 }}>
              No automaton loaded
            </p>
            <p style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
              Configure and generate one on the left
            </p>
          </div>
        </div>
      )}

      {/* ── Cytoscape mount ── */}
      <div ref={containerRef} style={{ width: '100%', height: '100%', position: 'relative', zIndex: 1 }} />
    </div>
  );
}
