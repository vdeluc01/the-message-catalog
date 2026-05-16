import React, { useState, useEffect, useRef } from 'react';

// ── Demo Tour ──────────────────────────────────────────────────────────────
// A guided click-through that walks a recipient through what the catalog
// actually does, using fixture data. Lives in the real app — same code,
// same look, same buttons — only the click behavior differs.
//
// Activated via ?demo=1 or shareable /demo URL. The host App.jsx loads
// demoFixture data, skips OAuth, and gates destructive actions when this
// component is mounted.

const STEPS = [
  // ──────────────────────────────────────────────────────────────────
  // 1. Welcome modal
  {
    type: 'modal',
    icon: '🎵',
    pre: 'The Message Records',
    title: 'A solo-built catalog for an AI-generated music label.',
    body:
      "Welcome. This is a 60-second walkthrough of a working catalog management system — built by one person to run a real label of 163 songs across 22 artist personas, on a 5-Friday rolling release schedule. Click Next to see what it does and how it's organized.",
    cta: 'Start Tour →',
  },

  // ──────────────────────────────────────────────────────────────────
  // 2. Dashboard — the operational headline
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Live on Spotify',
    pre: 'Dashboard',
    title: 'The five numbers that matter, every day.',
    body:
      "Live on Spotify, Submitted to DistroKid, Checklist Ready, Total Songs, Missing Lyrics. Everything is computed from the underlying data — there's no manual upkeep. Open the app, look at the dashboard, know exactly where the label stands.",
  },

  // 3. Persona breakdown
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Songs by Artist',
    pre: 'Personas',
    title: '22 artist personas. Each one a distinct musical identity.',
    body:
      "Long Way Home (Americana). Crimson & Gold (Soul). Stone Prophet (Metal). Blue Note Prophet (Jazz Spoken Word). Sol Urbano (Reggaeton). Each persona is a separate artist with its own genre, audience, cover art, and release schedule. The bar chart shows song counts per artist, plus cover-art status and how many songs are release-ready.",
  },

  // 4. Themes
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Top Themes Across Catalog',
    pre: 'Theme Tagging',
    title: 'Every song is AI-tagged across 20 standard themes.',
    body:
      "Faith, Hope, Redemption, Love, Justice, Identity, Doubt, Grace, Family, Perseverance, Resurrection — 20 themes total. The lyrics get analyzed by Claude, tags get normalized to this fixed list, and the bar chart shows what the catalog is actually about. Sync-licensing supervisors care about this. So do playlist curators.",
  },

  // 5. Production stage
  {
    type: 'spotlight',
    view: 'Dashboard',
    targetText: 'Production Stage Breakdown',
    pre: 'Production Pipeline',
    title: 'Six stages from idea to final, auto-detected.',
    body:
      "Idea → Lyrics Written → Prompt Ready → Suno Generated → Reviewing → Final. Stage is inferred from what's actually in the record: if there's a Suno URL, it's Generated. If there's a style prompt but no URL, Prompt Ready. If there are just lyrics, Lyrics Written. Manual overrides (Reviewing, Final) are respected.",
  },

  // ──────────────────────────────────────────────────────────────────
  // 6. By Theme view
  {
    type: 'spotlight',
    view: 'By Theme',
    targetText: 'Faith',
    pre: 'By Theme View',
    title: 'Slice the entire catalog by any of 20 themes.',
    body:
      'Switched to the By Theme view. Each theme is a collapsible group. Useful when a sync supervisor asks "what do you have on Hope?" — open the group, see the songs, send the export.',
  },

  // 7. Expanded a master row — show versions
  {
    type: 'spotlight',
    view: 'By Theme',
    expandGroup: 'Faith',
    expandMaster: 'demo-m-1',
    targetText: 'Long Way Home',
    pre: 'Song Record',
    title: 'Click a song to open it. Lyrics, story, versions.',
    body:
      "Every song has: its lyrics (a single source of truth, shared across all recordings of the song), an optional story note, and one or more Versions — different personas recording the same song in different styles. Long Way Home is recorded as Americana here, but the same lyrics could later get a Gospel version, a Metal version, a Jazz version.",
  },

  // 8. Version detail — expand the version
  {
    type: 'spotlight',
    view: 'By Theme',
    expandGroup: 'Faith',
    expandMaster: 'demo-m-1',
    expandVersion: 'demo-v-1',
    targetText: 'Americana — Lead Single',
    pre: 'Version Metadata',
    title: 'Each version has its own metadata. Built for industry exports.',
    body:
      "Genre, mood, instrumental mood, target audience, duration, themes, two-sentence catalog summary, and a one-line album note (where it fits in a setlist). For deeper industry use: BPM, musical key, runtime, sync availability, PRO registration. All of this drives the audience-specific exports later.",
  },

  // 9. Release Checklist
  {
    type: 'spotlight',
    view: 'By Theme',
    expandGroup: 'Faith',
    expandMaster: 'demo-m-1',
    expandVersion: 'demo-v-1',
    targetText: 'Release Checklist',
    pre: 'Release Readiness',
    title: 'A 6-item checklist before any song goes to DistroKid.',
    body:
      "Three auto-detected from the data: Suno URL present, metadata complete, lyrics added. Three manual: you've actually listened to it end-to-end, cover art is ready, audio file is downloaded. When all six are green, the row badge shows ✓ Ready. Until then it shows the count. No song accidentally ships half-baked.",
  },

  // 10. DistroKid tracker
  {
    type: 'spotlight',
    view: 'By Theme',
    expandGroup: 'Faith',
    expandMaster: 'demo-m-1',
    expandVersion: 'demo-v-1',
    targetText: 'DistroKid',
    pre: 'Release Tracking',
    title: 'Log the DistroKid submission. The row updates automatically.',
    body:
      "Submitted date, scheduled release date, HyperFollow pre-save URL, Spotify URL once the song goes live. When Spotify is filled in, the row badge flips to 🟢 Live. The Dashboard re-counts. The Release Calendar updates. One field change ripples through everything.",
  },

  // ──────────────────────────────────────────────────────────────────
  // 11. Release Calendar
  {
    type: 'spotlight',
    view: 'Release Calendar',
    targetText: 'Release Calendar',
    pre: 'Release Calendar',
    title: 'Every scheduled release, by month, with countdown days.',
    body:
      "The operations view. Five Fridays in a row, one persona dropping each week — that's the May–June 2026 schedule. The calendar shows what's shipping when, how many days out, and links to both HyperFollow (for pre-save) and Spotify (once live). Past releases stay listed in their own section.",
  },

  // ──────────────────────────────────────────────────────────────────
  // 12. Add Song — wizard step 1
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'master',
    targetText: 'Step 1 of 3',
    pre: 'Adding a Song',
    title: 'Step 1 — title, lyrics, story note.',
    body:
      "Three-step wizard. Step 1 captures the song itself: title, full lyrics (paste from Suno's lyrics panel), and an optional story / notes field for context. Lyrics are the source of truth — they drive theme tagging, lyrics-bulk-upload to Musixmatch, and per-song search.",
  },

  // 13. Wizard step 2 — version + style prompt
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'version',
    targetText: 'Step 2 of 3',
    pre: 'Adding a Song',
    title: 'Step 2 — the recording: style prompt + Suno link.',
    body:
      "Version label (e.g., 'Gospel Soul'), the Suno style prompt you used to generate the audio, optional Suno URL and version number (v3.5, v4), Suno creation date. The style prompt plus lyrics drives the AI's persona suggestion in step 3.",
  },

  // 14. Wizard step 3 — AI analysis
  {
    type: 'spotlight',
    tab: 'add',
    wizardStep: 'confirm',
    targetText: 'Confirm Persona',
    pre: 'Adding a Song',
    title: 'Step 3 — AI suggests persona + metadata. You confirm.',
    body:
      "Claude reads the title, style prompt, and first 2,000 chars of lyrics, then picks the best-fitting persona from your 22, picks 2-4 themes from the standard 20, picks a mood, picks an audience, picks a duration band, and writes a two-sentence catalog summary plus a one-sentence album note. You accept the suggestion or override with any persona — including 'Unassigned' if it's a new style worth a new persona.",
  },

  // ──────────────────────────────────────────────────────────────────
  // 15. Settings → Exports
  {
    type: 'spotlight',
    settingsTab: 'exports',
    targetText: 'Audience-Specific Exports',
    pre: 'Industry Exports',
    title: 'Five exports. Each one tailored to a specific recipient.',
    body:
      "Music Supervisor (sync-ready songs by mood, with BPM/key/duration). Label & A&R (organized by persona, showing creative breadth). Publisher (PRO and ISRC for rights management). Playlist Curator (released songs by target audience). Musixmatch (lyrics bulk upload for streaming credits). Same catalog, five purpose-built views.",
  },

  // ──────────────────────────────────────────────────────────────────
  // 16. Closing
  {
    type: 'modal',
    icon: '✓',
    pre: 'End of Tour',
    title: 'Built solo. Live in production.',
    body:
      "That's the catalog. React + Anthropic Claude API + Google Drive backend, deployed on Netlify. Operated by one person. Currently shipping a 5-Friday rolling release schedule for The Message Records, May–June 2026. To see the actual live catalog, visit the-message-catalog.netlify.app.",
    cta: 'Restart Tour',
    showVisitLive: true,
  },
];

// Best-effort: find a button or any element whose visible text matches.
// Searches buttons first (most spotlights target buttons), then any element.
const findTarget = (text) => {
  if (!text) return null;
  // Buttons first
  const buttons = Array.from(document.querySelectorAll('button'));
  let hit = buttons.find(b => (b.textContent || '').trim() === text);
  if (hit) return hit;
  hit = buttons.find(b => (b.textContent || '').includes(text));
  if (hit) return hit;
  // Then anything with the exact text
  const anyEls = Array.from(document.querySelectorAll('div, span, h1, h2, h3, label'));
  hit = anyEls.find(el => {
    const t = (el.textContent || '').trim();
    return t === text || (t.startsWith(text) && t.length < text.length + 80);
  });
  return hit || null;
};

// Position the tooltip in the OPPOSITE vertical half from the spotlight so
// the bubble never covers what it's pointing at. Horizontally centered.
// Caller can flip top/bottom via the `flipped` flag if their preference is
// different from our default.
const computeTipPos = (rect, flipped = false) => {
  const W = 360;
  const H = 240;
  const margin = 18;
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  const spotCenterY = rect.top + rect.height / 2;
  const spotInTopHalf = spotCenterY < vh / 2;
  // Default: bubble opposite spotlight. If flipped, bubble on same side.
  const bubbleAtBottom = flipped ? spotInTopHalf : !spotInTopHalf;

  // Bubble at bottom = anchor near bottom; at top = anchor near top
  const top = bubbleAtBottom
    ? vh - H - margin
    : margin;

  const left = Math.max(margin, Math.min((vw - W) / 2, vw - W - margin));
  return { top, left, width: W };
};

export default function DemoTour({
  setView, setActiveTab, setShowSettings, setSettingsTab,
  setWizardStep, setMasterForm, setVersionForm, setPendingAnalysis,
  setExpandedMaster, setExpandedVersion, setExpandedGroups,
}) {
  const [stepIdx, setStepIdx] = useState(0);
  const [targetRect, setTargetRect] = useState(null);
  const [tipFlipped, setTipFlipped] = useState(false); // user can flip bubble to other side
  const [tipHidden, setTipHidden] = useState(false);   // user can momentarily hide bubble

  const step = STEPS[stepIdx];
  const total = STEPS.length;

  // Drive view, tab, settings, and expansion state based on the step config
  useEffect(() => {
    if (!step) return;

    // Close settings unless step specifies otherwise
    if (step.settingsTab) {
      setShowSettings(true);
      setSettingsTab(step.settingsTab);
    } else {
      setShowSettings(false);
    }

    // Tab: catalog | add
    if (step.tab) {
      setActiveTab(step.tab);
    } else if (!step.settingsTab) {
      setActiveTab('catalog');
    }

    // View within catalog
    if (step.view) {
      setView(step.view);
    }

    // Wizard step (when on the Add tab)
    if (step.wizardStep) {
      setWizardStep(step.wizardStep);
      // Pre-fill the wizard with demo data depending on the step
      if (step.wizardStep === 'master') {
        setMasterForm({
          title: 'Tonight We Sing',
          lyrics:
            "Tonight we sing because the silence cost us\nMore than we were willing to pay\nTonight we sing because the morning has the answers\nThat the night refused to say",
          notes: 'For the celebration chapter — closing track of the EP.',
        });
      } else if (step.wizardStep === 'version') {
        setVersionForm({
          label: 'Swing Standard',
          stylePrompt: 'classic big band swing, brushed snare, tight horn section, smooth male crooner vocal, 1950s ballroom feel',
          firstTakeUrl: 'https://suno.com/s/demo-tonight-we-sing',
          firstTakeVersion: 'v4',
          stage: 'generated',
          releaseStatus: 'draft',
          sunoCreatedAt: '2026-05-15',
        });
      } else if (step.wizardStep === 'confirm') {
        setVersionForm({
          label: 'Swing Standard',
          stylePrompt: 'classic big band swing, brushed snare, tight horn section, smooth male crooner vocal, 1950s ballroom feel',
          firstTakeUrl: 'https://suno.com/s/demo-tonight-we-sing',
          firstTakeVersion: 'v4',
          stage: 'generated',
          releaseStatus: 'draft',
          sunoCreatedAt: '2026-05-15',
        });
        setMasterForm({
          title: 'Tonight We Sing',
          lyrics:
            "Tonight we sing because the silence cost us\nMore than we were willing to pay\nTonight we sing because the morning has the answers\nThat the night refused to say",
          notes: 'For the celebration chapter — closing track of the EP.',
        });
        setPendingAnalysis({
          suggestedPersona: 'new-vintage',
          personaReason: 'Swing arrangement with brushed snare and crooner vocal — classic New Vintage territory.',
          suggestNewPersona: false,
          genre: 'Swing / Big Band',
          themes: ['Celebration', 'Hope', 'Community'],
          mood: 'Joyful',
          instrumentalMood: 'Big Band',
          targetAudience: 'General',
          duration: 'Standard (2-4 min)',
          versionSummary:
            'Big-band swing built around a horn section and a brushed-snare pocket. Smooth male crooner lead. Built for the back half of a celebration record.',
          albumNote: 'Closer. Big finish energy.',
        });
      }
    }

    // Master/version/group expansion
    if (step.expandGroup) {
      setExpandedGroups(new Set([step.expandGroup]));
    } else {
      setExpandedGroups(new Set());
    }
    if (step.expandMaster) {
      setExpandedMaster(step.expandMaster);
    } else {
      setExpandedMaster(null);
    }
    if (step.expandVersion) {
      setExpandedVersion(step.expandVersion);
    } else {
      setExpandedVersion(null);
    }
  }, [stepIdx]);

  // After view/tab/expand state settles, find the target and position the spotlight.
  useEffect(() => {
    if (!step) return;
    if (step.type === 'modal') {
      setTargetRect(null);
      return;
    }
    let cancelled = false;
    const attempt = (n) => {
      if (cancelled) return;
      const el = findTarget(step.targetText);
      if (el) {
        const r = el.getBoundingClientRect();
        // Scroll into view if needed
        if (r.top < 80 || r.bottom > window.innerHeight - 80) {
          el.scrollIntoView({ block: 'center', behavior: 'smooth' });
          // Re-measure after scroll
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
  }, [stepIdx]);

  // Reposition on scroll/resize
  useEffect(() => {
    const reposition = () => {
      if (!step || step.type === 'modal') return;
      const el = findTarget(step.targetText);
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
  }, [stepIdx]);

  const next = () => {
    if (stepIdx < total - 1) setStepIdx(stepIdx + 1);
    else setStepIdx(0); // restart on Finish
  };
  const prev = () => { if (stepIdx > 0) setStepIdx(stepIdx - 1); };

  if (!step) return null;

  const isModal = step.type === 'modal';
  const pad = 10;

  // Tooltip position
  let tipStyle;
  if (isModal || !targetRect) {
    tipStyle = { top: '50%', left: '50%', transform: 'translate(-50%, -50%)', width: 520 };
  } else {
    const expanded = { top: targetRect.top - pad, left: targetRect.left - pad, width: targetRect.width + pad * 2, height: targetRect.height + pad * 2, bottom: targetRect.bottom + pad, right: targetRect.right + pad };
    const pos = computeTipPos(expanded, tipFlipped);
    tipStyle = { top: pos.top, left: pos.left, width: pos.width };
  }

  // Lighter backdrop on spotlight steps so visitors can SEE the surrounding
  // UI for context. Full modals still use a heavier dim.
  const dim = isModal
    ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.72)', zIndex: 99997, pointerEvents: 'auto' }
    : (!targetRect
        ? { position: 'fixed', inset: 0, background: 'rgba(8,10,18,0.40)', zIndex: 99997, pointerEvents: 'auto' }
        : null);

  // Spotlight: gold border + a soft amber glow that BRIGHTENS the target,
  // plus a much lighter outside dim than before (was 0.78, now 0.40).
  const spot = (isModal || !targetRect) ? null : {
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
    transition: 'all 240ms ease',
  };

  const cta = step.cta || (stepIdx === total - 1 ? 'Restart Tour' : 'Next →');

  return (
    <>
      {/* Persistent "DEMO" badge at the top, even when no spotlight is active */}
      <div style={{ position: 'fixed', top: 12, left: 12, zIndex: 100001,
                    background: 'linear-gradient(135deg,#C8942A,#9a7018)', color: '#fff',
                    padding: '5px 12px', borderRadius: 4, fontSize: 10, letterSpacing: '0.2em',
                    textTransform: 'uppercase', fontFamily: 'Georgia,serif',
                    boxShadow: '0 4px 14px rgba(0,0,0,0.5)' }}>
        Demo Mode · Step {stepIdx + 1} / {total}
      </div>

      <div style={{ position: 'fixed', inset: 0, zIndex: 99996, pointerEvents: 'none' }}>
        {dim && <div style={dim} />}
        {spot && <div style={spot} />}

        {/* "Show bubble" button when the bubble is hidden */}
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
            padding: '22px 24px 18px',
            borderRadius: 12,
            border: '1px solid #2a2d38',
            boxShadow: '0 24px 60px rgba(0,0,0,0.6), 0 0 0 1px rgba(200,148,42,0.18)',
            zIndex: 100000,
            pointerEvents: 'auto',
            fontFamily: 'Georgia, "Times New Roman", serif',
            maxHeight: '70vh',
            overflowY: 'auto',
          }}
        >
          {/* Top-right controls: flip position, hide bubble */}
          {!isModal && targetRect && (
            <div style={{ position: 'absolute', top: 10, right: 12, display: 'flex', gap: 6, zIndex: 1 }}>
              <button onClick={() => setTipFlipped(f => !f)} title="Move explainer to the other side"
                style={iconBtn}>↕</button>
              <button onClick={() => setTipHidden(true)} title="Hide explainer for a moment"
                style={iconBtn}>👁</button>
            </div>
          )}

          {step.icon && <div style={{ fontSize: 30, marginBottom: 6 }}>{step.icon}</div>}
          {step.pre && (
            <div style={{ fontSize: 10, letterSpacing: '0.3em', color: '#C8942A', textTransform: 'uppercase', marginBottom: 8, paddingRight: 60 }}>
              {step.pre}
            </div>
          )}
          <div style={{ fontSize: 17, fontWeight: 700, lineHeight: 1.3, marginBottom: 10, color: '#f5ead8', paddingRight: 60 }}>
            {step.title}
          </div>
          <div style={{ fontSize: 13.5, lineHeight: 1.6, color: '#cfd1d8', marginBottom: 16 }}>
            {step.body}
          </div>

          {/* Progress dots */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 4, marginBottom: 14 }}>
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

          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
            <div style={{ display: 'flex', gap: 8 }}>
              {stepIdx > 0 && (
                <button onClick={prev} style={btnQuiet}>← Back</button>
              )}
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              {step.showVisitLive && (
                <a href="https://the-message-catalog.netlify.app/" target="_blank" rel="noopener noreferrer"
                   style={{ ...btnQuiet, textDecoration: 'none', display: 'inline-block' }}>
                  Visit the live catalog →
                </a>
              )}
              <button onClick={next} style={btnPrimary}>{cta}</button>
            </div>
          </div>
        </div>
        )}
      </div>
    </>
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

const btnPrimary = {
  background: 'linear-gradient(135deg,#C8942A,#9a7018)',
  color: '#fff',
  border: 'none',
  borderRadius: 6,
  padding: '9px 18px',
  fontSize: 12,
  fontWeight: 700,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
const btnQuiet = {
  background: 'transparent',
  color: '#bbb',
  border: '1px solid #2a2d38',
  borderRadius: 6,
  padding: '8px 14px',
  fontSize: 11,
  letterSpacing: '0.08em',
  textTransform: 'uppercase',
  cursor: 'pointer',
  fontFamily: 'inherit',
};
