import React, { useState, useEffect, useRef } from 'react';

// Catalog App Guided Tour
// Self-contained — no external dependencies.
// Auto-launches on first visit. Re-launchable via ?tour=1 URL param or window.startCatalogTour()

const STEPS = [
  {
    type: 'modal',
    icon: '🎵',
    title: 'Welcome to The Message Records Catalog',
    body: 'A custom catalog management application built and operated solo by Vito DeLuca. 163 songs · 22 personas · 5-Friday rolling release schedule, May–June 2026. Take a 60-second tour of how it works.',
  },
  {
    type: 'spotlight',
    targetText: 'Dashboard',
    pre: 'Dashboard',
    title: 'The Dashboard auto-aggregates everything.',
    body: 'Total masters, total versions, persona count, theme breakdown — all live, all sourced from the catalog itself. Theme tagging is done by AI: lyrics analyzed by Anthropic Claude, then normalized into a 20-theme standard list.',
    onEnter: ({ setView }) => setView('Dashboard'),
  },
  {
    type: 'spotlight',
    targetText: 'By Theme',
    pre: 'By Theme view',
    title: 'Group the entire catalog by any of 20 standard themes.',
    body: 'Identity at 94 songs. Hope at 92. Faith at 77. Each theme is a collapsible group. Click a song row to open it. Built for fast retrieval at scale — once you exceed 100 songs, a spreadsheet falls apart.',
    onEnter: ({ setView }) => setView('By Theme'),
  },
  {
    type: 'spotlight',
    targetText: 'Release Calendar',
    pre: 'Release Pipeline',
    title: 'Built for one person running five releases at a time.',
    body: 'Per-song checklist. DistroKid status. Cover art status. Spotify URI capture. The catalog itself knows what is shipping when. Five consecutive Fridays in May and June 2026, one persona each.',
    onEnter: ({ setView }) => setView('Release Calendar'),
  },
  {
    type: 'spotlight',
    targetText: '⚙ Settings',
    pre: 'AI bulk enrichment',
    title: 'AI metadata enrichment lives here.',
    body: 'One click sends every song with blank metadata fields through the Claude API and writes back genre, mood, audience, and themes. 100+ songs tagged in under a minute. Only fills blank fields — never overwrites work you have already done.',
  },
  {
    type: 'modal',
    icon: '✓',
    title: 'Built solo. Live in production.',
    body: 'React + Anthropic Claude API + Google Drive backend. Deployed via Netlify. Source on GitHub. Live since early 2026 at the-message-catalog.netlify.app. Coming soon as a hosted multi-tenant SaaS, $14 per month — alongside The AI Music Label Playbook.',
  },
];

const findTargetButton = (text) => {
  if (!text) return null;
  const buttons = Array.from(document.querySelectorAll('button'));
  return buttons.find(b => {
    const t = (b.textContent || '').trim();
    return t === text || t.includes(text);
  }) || null;
};

// Position the tooltip in the OPPOSITE vertical half from the spotlight so
// the bubble never covers what it points at. Caller can pass `flipped` to
// swap to the same side if the default guess is wrong for their screen.
const computeTooltipPos = (rect, flipped = false) => {
  const W = 360;
  const H = 240;
  const margin = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;
  const spotCenterY = rect.top + rect.height / 2;
  const spotInTopHalf = spotCenterY < vh / 2;
  const bubbleAtBottom = flipped ? spotInTopHalf : !spotInTopHalf;
  const top = bubbleAtBottom ? vh - H - margin : margin;
  const left = Math.max(margin, Math.min((vw - W) / 2, vw - W - margin));
  return { top, left, width: W };
};

export default function Tour({ setView, setShowSettings, setSettingsTab }) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tipFlipped, setTipFlipped] = useState(false); // user can swap bubble to other side
  const [tipHidden, setTipHidden] = useState(false);   // user can hide bubble to see UI
  const tickRef = useRef(null);

  const start = () => {
    setStepIdx(0);
    setActive(true);
  };

  const close = () => {
    setActive(false);
    try { localStorage.setItem('catalog-tour-seen-v1', '1'); } catch (e) {}
  };

  const skip = () => {
    if (window.confirm('Skip the tour? You can restart it from the “Take Tour” button anytime.')) {
      close();
    }
  };

  // Expose global trigger and auto-launch
  useEffect(() => {
    window.startCatalogTour = start;
    const params = new URLSearchParams(window.location.search);
    let seen = false;
    try { seen = !!localStorage.getItem('catalog-tour-seen-v1'); } catch (e) {}
    if (params.get('tour') === '1' || !seen) {
      const t = setTimeout(start, 700);
      return () => clearTimeout(t);
    }
  }, []);

  // When step changes, run onEnter (e.g., switch view) and find target
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    if (step.onEnter) {
      try { step.onEnter({ setView, setShowSettings, setSettingsTab }); } catch (e) {}
    }
    if (step.type === 'modal') {
      setTargetRect(null);
      return;
    }
    // Wait for view re-render then find target
    let cancelled = false;
    const tryFind = (attempt) => {
      if (cancelled) return;
      const el = findTargetButton(step.targetText);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      } else if (attempt < 10) {
        setTimeout(() => tryFind(attempt + 1), 80);
      } else {
        setTargetRect(null);
      }
    };
    tryFind(0);
  }, [active, stepIdx, setView, setShowSettings, setSettingsTab]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!active) return;
    const reposition = () => {
      const step = STEPS[stepIdx];
      if (step.type === 'modal') return;
      const el = findTargetButton(step.targetText);
      if (el) {
        const r = el.getBoundingClientRect();
        setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
      }
    };
    window.addEventListener('resize', reposition);
    window.addEventListener('scroll', reposition, true);
    return () => {
      window.removeEventListener('resize', reposition);
      window.removeEventListener('scroll', reposition, true);
    };
  }, [active, stepIdx]);

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    else close();
  };
  const prev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  if (!active) return null;

  const step = STEPS[stepIdx];
  const total = STEPS.length;
  const isModal = step.type === 'modal';
  const pad = 8;

  // Tooltip placement
  let tipStyle = {};
  if (isModal || !targetRect) {
    tipStyle = {
      top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 460,
    };
  } else {
    const expanded = { top: targetRect.top - pad, left: targetRect.left - pad, width: targetRect.width + pad * 2, height: targetRect.height + pad * 2 };
    const pos = computeTooltipPos(expanded, tipFlipped);
    tipStyle = { top: pos.top, left: pos.left, width: pos.width };
  }

  // Spotlight: gold border + soft amber glow so the target pops without
  // needing heavy darkness around it.
  const spotStyle = (isModal || !targetRect) ? null : {
    position: 'fixed',
    top: targetRect.top - pad,
    left: targetRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
    borderRadius: 8,
    boxShadow: '0 0 0 9999px rgba(8,10,18,0.40), 0 0 30px 4px rgba(200,148,42,0.45) inset, 0 0 24px 2px rgba(200,148,42,0.3)',
    border: '2px solid #E0A943',
    pointerEvents: 'none',
    zIndex: 99998,
    transition: 'all 220ms ease',
  };

  // Lighter backdrop on spotlight steps so you can SEE the catalog UI for
  // context. Full modals still use a heavier dim.
  const dimStyle = isModal
    ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.72)', zIndex: 99997, pointerEvents: 'auto' }
    : (!targetRect
        ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.40)', zIndex: 99997, pointerEvents: 'auto' }
        : null);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99996, pointerEvents: 'none' }}>
      {dimStyle && <div style={dimStyle} onClick={skip} />}
      {spotStyle && <div style={spotStyle} />}

      {/* "Show explainer" button when bubble is hidden */}
      {tipHidden && !isModal && targetRect && (
        <button onClick={() => setTipHidden(false)}
          style={{
            position: 'fixed', bottom: 20, left: '50%', transform: 'translateX(-50%)',
            zIndex: 100000, pointerEvents: 'auto',
            background: 'linear-gradient(135deg,#C8942A,#9a7018)', color: '#fff',
            border: 'none', borderRadius: 6, padding: '10px 22px', fontSize: 12,
            fontWeight: 700, letterSpacing: '0.1em', textTransform: 'uppercase',
            cursor: 'pointer', boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
            fontFamily: 'inherit',
          }}>
          Show explainer
        </button>
      )}

      {!tipHidden && (
      <div
        role="dialog"
        aria-modal="true"
        style={{
          position: 'fixed',
          ...tipStyle,
          background: 'linear-gradient(180deg, #1c1f2b 0%, #14161e 100%)',
          color: '#f5f5f5',
          padding: '22px 24px 18px 26px',
          borderRadius: 12,
          border: '1px solid #2a2d38',
          boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,148,42,0.15)',
          zIndex: 100000,
          pointerEvents: 'auto',
          fontFamily: 'inherit',
          maxHeight: '70vh',
          overflowY: 'auto',
        }}>
        {/* Top-right controls: flip side, hide bubble */}
        {!isModal && targetRect && (
          <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 1 }}>
            <button onClick={() => setTipFlipped(f => !f)} title="Move explainer to the other side"
              style={iconBtn}>↕</button>
            <button onClick={() => setTipHidden(true)} title="Hide explainer momentarily"
              style={iconBtn}>👁</button>
          </div>
        )}

        {step.icon && (
          <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>
        )}
        {step.pre && (
          <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#C8942A', textTransform: 'uppercase', marginBottom: 8, paddingRight: 60 }}>{step.pre}</div>
        )}
        <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 10, paddingRight: 60 }}>{step.title}</div>
        <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#cfd1d8', marginBottom: 18 }}>{step.body}</div>

        {/* Progress dots */}
        <div style={{ display: 'flex', justifyContent: 'center', gap: 6, marginBottom: 14 }}>
          {STEPS.map((_, i) => (
            <div key={i} style={{
              width: i === stepIdx ? 18 : 6,
              height: 6,
              borderRadius: 3,
              background: i === stepIdx ? '#C8942A' : (i < stepIdx ? '#7a6028' : '#2a2d38'),
              transition: 'all 200ms ease',
            }} />
          ))}
        </div>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <button onClick={skip} style={btnStyleQuiet}>Skip tour</button>
          <div style={{ display: 'flex', gap: 8 }}>
            {stepIdx > 0 && <button onClick={prev} style={btnStyleQuiet}>Back</button>}
            <button onClick={next} style={btnStylePrimary}>
              {stepIdx === total - 1 ? 'Finish' : 'Next →'}
            </button>
          </div>
        </div>

        <div style={{ position: 'absolute', bottom: 14, left: 26, fontSize: 11, color: '#666' }}>
          {stepIdx + 1} / {total}
        </div>
      </div>
      )}
    </div>
  );
}

const iconBtn = {
  background: 'rgba(255,255,255,0.05)',
  color: '#888',
  border: '1px solid #2a2d38',
  borderRadius: 4,
  width: 26,
  height: 26,
  padding: 0,
  fontSize: 12,
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontFamily: 'inherit',
};

const btnStylePrimary = {
  background: '#C8942A',
  color: '#0e1018',
  border: 'none',
  borderRadius: 6,
  padding: '8px 16px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
const btnStyleQuiet = {
  background: 'transparent',
  color: '#888',
  border: '1px solid #2a2d38',
  borderRadius: 6,
  padding: '7px 14px',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
};
