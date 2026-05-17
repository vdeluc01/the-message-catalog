import React, { useState, useEffect, useRef } from 'react';
import { THEMES } from './constants.js';
import { computeAnchoredTooltip, flipSide, arrowStyleFor, ensurePulseKeyframes } from './tourPositioning.js';

// ── Catalog App Guided Tour ───────────────────────────────────────────────
// 16-step walkthrough that mirrors the /demo experience but runs against
// the user's REAL catalog data. Auto-launches on first visit.
// Re-launchable via the "★ Take Tour" button or ?tour=1 URL param.
//
// Kept structurally in sync with DemoTour.jsx — body copy is shared, only
// the data-resolution differs (live masters vs. fixtures).

const STEPS = [
  // 1. Welcome
  {
    type: 'modal',
    icon: '🎵',
    pre: 'The Message Records',
    title: 'A 90-second tour of your catalog.',
    body: "Walks through everything the catalog tracks: the Dashboard headline, persona breakdown, AI theme tagging, the release pipeline, drilling into a song, the 6-item release checklist, DistroKid tracker, Release Calendar, the Add Song wizard, and the audience-specific exports. Skippable any time.",
  },
  // 2. Dashboard headline stats
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Live on Spotify',
    pre: 'Dashboard',
    title: 'The five numbers that matter, every day.',
    body: "Live on Spotify, Submitted to DistroKid, Checklist Ready, Total Songs, Missing Lyrics. All computed from your data — no manual upkeep.",
  },
  // 3. Persona breakdown
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Songs by Artist',
    pre: 'Personas',
    title: '22 artist personas. Each one a distinct musical identity.',
    body: "The bar chart shows song counts per persona, cover-art status, and how many songs are release-ready per artist.",
  },
  // 4. Themes
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Top Themes Across Catalog',
    pre: 'Theme Tagging',
    title: 'Every song is AI-tagged across 20 standard themes.',
    body: "Faith, Hope, Redemption, Love, Justice, Identity, Doubt, Grace, Family, Perseverance, Resurrection — 20 total. Lyrics get analyzed by Claude and normalized to this fixed list. Sync supervisors and playlist curators care about this.",
  },
  // 5. Production stage
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Production Stage Breakdown',
    pre: 'Production Pipeline',
    title: 'Six stages from idea to final, auto-detected.',
    body: "Idea → Lyrics Written → Prompt Ready → Suno Generated → Reviewing → Final. Inferred from the data: Suno URL = Generated, style prompt only = Prompt Ready, lyrics only = Lyrics Written. Manual overrides for Reviewing and Final are respected.",
  },
  // 6. By Theme view
  {
    type: 'spotlight',
    view: 'By Theme',
    spotlightFirstTheme: true,
    pre: 'By Theme View',
    title: 'Slice the entire catalog by any of 20 themes.',
    body: 'Each theme is a collapsible group. When a sync supervisor asks "what do you have on Hope?" — open the group, see the songs, send the export.',
  },
  // 7. Drilled into a song
  {
    type: 'spotlight',
    view: 'By Theme',
    expandFirstTheme: true,
    expandFirstMaster: true,
    spotlightFirstMaster: true,
    pre: 'Song Record',
    title: 'Click a song to open it. Lyrics, story, versions.',
    body: "Every song has its lyrics (the source of truth, shared across all recordings), an optional story note, and one or more Versions — different personas recording the same song in different styles.",
  },
  // 8. Version detail
  {
    type: 'spotlight',
    view: 'By Theme',
    expandFirstTheme: true,
    expandFirstMaster: true,
    expandFirstVersion: true,
    spotlightFirstVersion: true,
    pre: 'Version Metadata',
    title: 'Each version has its own metadata. Built for industry exports.',
    body: "Genre, mood, instrumental mood, target audience, duration, themes, summary, and album note. Industry fields: BPM, key, runtime, sync availability, PRO, ISRC. All of this drives the audience-specific exports.",
  },
  // 9. Release Checklist
  {
    type: 'spotlight',
    view: 'By Theme',
    expandFirstTheme: true,
    expandFirstMaster: true,
    expandFirstVersion: true,
    targetText: 'Release Checklist',
    pre: 'Release Readiness',
    title: 'A 6-item checklist before any song goes to DistroKid.',
    body: "Three auto-detected: Suno URL present, metadata complete, lyrics added. Three manual: listened end-to-end, cover art ready, audio downloaded. All six green = ✓ Ready badge on the row.",
  },
  // 10. DistroKid tracker
  {
    type: 'spotlight',
    view: 'By Theme',
    expandFirstTheme: true,
    expandFirstMaster: true,
    expandFirstVersion: true,
    targetText: 'DistroKid',
    pre: 'Release Tracking',
    title: 'Log the DistroKid submission. The row updates automatically.',
    body: "Submitted date, release date, HyperFollow pre-save URL, Spotify URL once live. Fill Spotify → the row badge flips to 🟢 Live, Dashboard re-counts, Release Calendar updates.",
  },
  // 11. Release Calendar
  {
    type: 'spotlight',
    view: 'Release Calendar',
    targetText: 'Release Calendar',
    pre: 'Release Calendar',
    title: 'Every scheduled release, by month, with countdown days.',
    body: "What's shipping when. How many days out. Links to HyperFollow and Spotify. Past releases stay listed in their own section.",
  },
  // 12. Add Song wizard step 1
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'master',
    targetText: 'Step 1 of 3',
    pre: 'Adding a Song',
    title: 'Step 1 — title, lyrics, story note.',
    body: "Three-step wizard. Step 1 captures the song itself. Lyrics are the source of truth — they drive theme tagging, the Musixmatch upload, and per-song search.",
  },
  // 13. Wizard step 2
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'version',
    targetText: 'Step 2 of 3',
    pre: 'Adding a Song',
    title: 'Step 2 — the recording: style prompt + Suno link.',
    body: "Version label, the Suno style prompt you used, optional Suno URL and version number, Suno creation date (with a calendar picker). Style prompt + lyrics drives the AI's persona suggestion in step 3.",
  },
  // 14. Wizard step 3
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'confirm',
    targetText: 'Confirm Persona',
    pre: 'Adding a Song',
    title: 'Step 3 — AI suggests persona + metadata. You confirm.',
    body: "Claude reads the title, style prompt, and first 2,000 chars of lyrics, then picks the best-fitting persona from your 22, picks 2-4 themes, picks mood/audience/duration, and writes a 2-sentence summary plus a 1-sentence album note. Accept or override.",
  },
  // 15. Settings → Exports
  {
    type: 'spotlight',
    openSettings: 'exports',
    targetText: 'Audience-Specific Exports',
    pre: 'Industry Exports',
    title: 'Five exports. Each one tailored to a specific recipient.',
    body: "Music Supervisor (sync). Label & A&R (by persona). Publisher (PRO + ISRC). Playlist Curator (released songs by audience). Musixmatch (lyrics bulk upload). Same catalog, five purpose-built views.",
  },
  // 16. Closing
  {
    type: 'modal',
    icon: '✓',
    pre: 'End of Tour',
    title: "That's your catalog.",
    body: "Click Restart Tour to walk through again, or Finish to close. You can re-open this tour any time from the ★ Take Tour button in the header.",
  },
];

// Find first theme that any master in `masters` actually has tagged. Falls
// back to the first theme that any version has, even if it's outside the
// standard list. Returns null if nothing matches.
const pickFirstTheme = (masters) => {
  if (!masters || !masters.length) return null;
  const masterHasTheme = (m, t) => (m.versions || []).some(v => (v.themes || []).includes(t));
  for (const t of THEMES) {
    if (masters.some(m => masterHasTheme(m, t))) return t;
  }
  // Fallback: first theme found on any master
  for (const m of masters) {
    for (const v of (m.versions || [])) {
      const t = (v.themes || [])[0];
      if (t) return t;
    }
  }
  return null;
};

// Pick the first master that has the given theme (so spotlight + expansion
// land in the same group as Step 7's auto-expanded theme).
const pickFirstMaster = (masters, theme) => {
  if (!masters || !masters.length) return null;
  if (theme) {
    const m = masters.find(mm => (mm.versions || []).some(v => (v.themes || []).includes(theme)));
    if (m) return m;
  }
  return masters[0];
};

// Find an element by visible text. Buttons first (most spotlights target
// buttons), then any reasonable element.
const findTarget = (text) => {
  if (!text) return null;
  const buttons = Array.from(document.querySelectorAll('button'));
  let hit = buttons.find(b => (b.textContent || '').trim() === text);
  if (hit) return hit;
  hit = buttons.find(b => (b.textContent || '').includes(text));
  if (hit) return hit;
  const els = Array.from(document.querySelectorAll('div, span, h1, h2, h3, label'));
  hit = els.find(el => {
    const t = (el.textContent || '').trim();
    return t === text;
  });
  if (hit) return hit;
  hit = els.find(el => {
    const t = (el.textContent || '').trim();
    return t.startsWith(text) && t.length < text.length + 80;
  });
  return hit || null;
};

// Tooltip positioning lives in tourPositioning.js — shared with DemoTour.

export default function Tour({
  setView, setActiveTab, setShowSettings, setSettingsTab,
  setWizardStep, setExpandedMaster, setExpandedVersion, setExpandedGroups,
  masters,
}) {
  const [active, setActive] = useState(false);
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [forcedSide, setForcedSide] = useState(null); // null = auto-pick best side
  const [tipHidden, setTipHidden] = useState(false);

  // Inject pulse keyframes once.
  useEffect(() => { ensurePulseKeyframes(); }, []);

  // Reset forced side when step changes so each step starts on its auto-pick.
  useEffect(() => { setForcedSide(null); }, [stepIdx]);

  const start = () => {
    setStepIdx(0);
    setActive(true);
  };

  const close = () => {
    setActive(false);
    try { localStorage.setItem('catalog-tour-seen-v1', '1'); } catch (e) {}
  };

  const skip = () => {
    if (window.confirm('Skip the tour? You can restart it from the ★ Take Tour button anytime.')) {
      close();
    }
  };

  // Expose global trigger and auto-launch on first visit
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

  // Drive view / tab / wizard / settings / expansion state based on the
  // current step. Resolves "first theme/master/version" sentinels against
  // live `masters` data. NEVER pre-fills wizard forms — that would clobber
  // any in-flight work.
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];

    // Settings panel
    if (step.openSettings) {
      setShowSettings(true);
      setSettingsTab(step.openSettings);
    } else {
      setShowSettings(false);
    }

    // Tab
    if (step.tab) {
      setActiveTab(step.tab);
    } else if (!step.openSettings) {
      setActiveTab('catalog');
    }

    // View
    if (step.view) setView(step.view);

    // Wizard step (no pre-fill)
    if (step.wizardStep) setWizardStep(step.wizardStep);

    // Expansion: theme group / master / version, all resolved against live data
    const theme = (step.expandFirstTheme || step.spotlightFirstTheme) ? pickFirstTheme(masters) : null;
    const firstMaster = (step.expandFirstMaster || step.spotlightFirstMaster) ? pickFirstMaster(masters, theme) : null;
    const firstVersion = (step.expandFirstVersion || step.spotlightFirstVersion) && firstMaster
      ? (firstMaster.versions || [])[0]
      : null;

    if (step.expandFirstTheme && theme) {
      setExpandedGroups(new Set([theme]));
    } else if (!step.expandFirstTheme) {
      setExpandedGroups(new Set());
    }
    if (step.expandFirstMaster && firstMaster) {
      setExpandedMaster(firstMaster.id);
    } else if (!step.expandFirstMaster) {
      setExpandedMaster(null);
    }
    if (step.expandFirstVersion && firstVersion) {
      setExpandedVersion(firstVersion.id);
    } else if (!step.expandFirstVersion) {
      setExpandedVersion(null);
    }
  }, [active, stepIdx]);

  // Find the target element after state changes settle
  useEffect(() => {
    if (!active) return;
    const step = STEPS[stepIdx];
    if (step.type === 'modal') {
      setTargetRect(null);
      return;
    }

    // Resolve targetText, which may be a derived value (first master / version)
    let targetText = step.targetText;
    if (!targetText) {
      const theme = pickFirstTheme(masters);
      if (step.spotlightFirstTheme && theme) {
        targetText = theme;
      } else if (step.spotlightFirstMaster) {
        const m = pickFirstMaster(masters, theme);
        if (m) targetText = m.title;
      } else if (step.spotlightFirstVersion) {
        const m = pickFirstMaster(masters, theme);
        const v = m && (m.versions || [])[0];
        if (v) targetText = v.label;
      }
    }

    let cancelled = false;
    const attempt = (n) => {
      if (cancelled) return;
      const el = findTarget(targetText);
      if (el) {
        const r = el.getBoundingClientRect();
        // Scroll into view if outside viewport
        if (r.top < 80 || r.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          setTimeout(() => {
            if (cancelled) return;
            const r2 = el.getBoundingClientRect();
            setTargetRect({ top: r2.top, left: r2.left, width: r2.width, height: r2.height });
          }, 250);
        } else {
          setTargetRect({ top: r.top, left: r.left, width: r.width, height: r.height });
        }
      } else if (n < 20) {
        setTimeout(() => attempt(n + 1), 100);
      } else {
        setTargetRect(null);
      }
    };
    attempt(0);
    return () => { cancelled = true; };
  }, [active, stepIdx, masters]);

  // Reposition on scroll/resize
  useEffect(() => {
    if (!active) return;
    const reposition = () => {
      const step = STEPS[stepIdx];
      if (step.type === 'modal') return;
      let targetText = step.targetText;
      if (!targetText) {
        const theme = pickFirstTheme(masters);
        if (step.spotlightFirstTheme && theme) targetText = theme;
        else if (step.spotlightFirstMaster) targetText = pickFirstMaster(masters, theme)?.title;
        else if (step.spotlightFirstVersion) {
          const m = pickFirstMaster(masters, theme);
          targetText = m && (m.versions || [])[0]?.label;
        }
      }
      const el = findTarget(targetText);
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
  }, [active, stepIdx, masters]);

  const next = () => {
    if (stepIdx < STEPS.length - 1) setStepIdx(stepIdx + 1);
    else close();
  };
  const prev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  if (!active) return null;

  const step = STEPS[stepIdx];
  const total = STEPS.length;
  const isModal = step.type === 'modal';
  const pad = 10;

  let tipStyle;
  let arrow = null;
  if (isModal || !targetRect) {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 460 };
  } else {
    const expanded = { top: targetRect.top - pad, left: targetRect.left - pad, width: targetRect.width + pad * 2, height: targetRect.height + pad * 2 };
    const pos = computeAnchoredTooltip(expanded, forcedSide);
    tipStyle = { top: pos.top, left: pos.left, width: pos.width };
    arrow = pos.arrow;
  }

  const spotStyle = (isModal || !targetRect) ? null : {
    position: 'fixed',
    top: targetRect.top - pad,
    left: targetRect.left - pad,
    width: targetRect.width + pad * 2,
    height: targetRect.height + pad * 2,
    borderRadius: 8,
    border: '2px solid #F2C572',
    pointerEvents: 'none',
    zIndex: 99998,
    animation: 'tourSpotlightPulse 1.8s ease-in-out infinite',
    transition: 'top 220ms ease, left 220ms ease, width 220ms ease, height 220ms ease',
  };

  const dimStyle = isModal
    ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.72)', zIndex: 99997, pointerEvents: 'auto' }
    : (!targetRect
        ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.40)', zIndex: 99997, pointerEvents: 'auto' }
        : null);

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 99996, pointerEvents: 'none' }}>
      {dimStyle && <div style={dimStyle} onClick={skip} />}
      {spotStyle && <div style={spotStyle} />}

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
        <div role="dialog" aria-modal="true"
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
          {!isModal && targetRect && arrow && (
            <div style={arrowStyleFor(arrow)} />
          )}

          {!isModal && targetRect && (
            <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 1 }}>
              <button onClick={() => setForcedSide(s => flipSide(s || (arrow && arrow.side) || 'right'))} title="Move explainer to the other side" style={iconBtn}>↕</button>
              <button onClick={() => setTipHidden(true)} title="Hide explainer momentarily" style={iconBtn}>👁</button>
            </div>
          )}

          {step.icon && <div style={{ fontSize: 32, marginBottom: 8 }}>{step.icon}</div>}
          {step.pre && (
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#C8942A', textTransform: 'uppercase', marginBottom: 8, paddingRight: 60 }}>{step.pre}</div>
          )}
          <div style={{ fontSize: 18, fontWeight: 700, lineHeight: 1.3, marginBottom: 10, paddingRight: 60 }}>{step.title}</div>
          <div style={{ fontSize: 13.5, lineHeight: 1.55, color: '#cfd1d8', marginBottom: 18 }}>{step.body}</div>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 5, marginBottom: 14 }}>
            {STEPS.map((_, i) => (
              <div key={i} style={{
                width: i === stepIdx ? 20 : 5,
                height: 5,
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
