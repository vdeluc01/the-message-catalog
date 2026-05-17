// ── Tour tooltip positioning ──────────────────────────────────────────────
// Shared by Tour.jsx and DemoTour.jsx. Replaces the old "dock to top/bottom
// of viewport" behavior with proper anchored placement: pick the side of the
// spotlight with the most room, attach the bubble there with a small gap,
// and render an arrow on the bubble's edge pointing at the spotlight so the
// bubble + spotlight read as one connected unit.
//
// Algorithm is the Popper/Floating-UI flip+shift pattern in ~50 lines so we
// don't need a dependency.

export const BUBBLE_W = 360;
export const BUBBLE_H_EST = 280; // worst-case bubble height used for fit checks
export const GAP = 16;           // gap between spotlight and bubble
export const MARGIN = 14;        // viewport edge inset

// Preferred order when multiple sides fit. Right first feels most natural in
// a top-down LTR scan; falls back through left, below, above.
const SIDES = ['right', 'left', 'below', 'above'];

// Try to place the bubble on `side`. Returns null if it can't fit there with
// the current viewport. Otherwise returns { top, left, width, side, arrow }.
const tryPlace = (side, spot, vw, vh) => {
  const cx = spot.left + spot.width / 2;
  const cy = spot.top + spot.height / 2;
  let top, left;

  if (side === 'right') {
    left = spot.left + spot.width + GAP;
    if (left + BUBBLE_W > vw - MARGIN) return null;
    top = cy - BUBBLE_H_EST / 2;
  } else if (side === 'left') {
    left = spot.left - BUBBLE_W - GAP;
    if (left < MARGIN) return null;
    top = cy - BUBBLE_H_EST / 2;
  } else if (side === 'below') {
    top = spot.top + spot.height + GAP;
    if (top + BUBBLE_H_EST > vh - MARGIN) return null;
    left = cx - BUBBLE_W / 2;
  } else if (side === 'above') {
    top = spot.top - BUBBLE_H_EST - GAP;
    if (top < MARGIN) return null;
    left = cx - BUBBLE_W / 2;
  }

  // Shift back into the viewport if we'd overflow on a perpendicular axis.
  top = Math.max(MARGIN, Math.min(top, vh - BUBBLE_H_EST - MARGIN));
  left = Math.max(MARGIN, Math.min(left, vw - BUBBLE_W - MARGIN));

  const arrow = { side };
  if (side === 'right' || side === 'left') {
    arrow.y = Math.max(20, Math.min(cy - top, BUBBLE_H_EST - 20));
  } else {
    arrow.x = Math.max(24, Math.min(cx - left, BUBBLE_W - 24));
  }
  return { top, left, width: BUBBLE_W, side, arrow };
};

// Score for the "no side fits" fallback — pick whichever has the most free
// space, even if the bubble has to overlap the spotlight slightly.
const freeSpace = (side, spot, vw, vh) => {
  if (side === 'right') return vw - (spot.left + spot.width);
  if (side === 'left')  return spot.left;
  if (side === 'below') return vh - (spot.top + spot.height);
  if (side === 'above') return spot.top;
  return 0;
};

// Main entry. `forceSide` is set by the user clicking the ↕ flip button to
// override the auto-pick.
export const computeAnchoredTooltip = (spot, forceSide = null) => {
  const vw = window.innerWidth;
  const vh = window.innerHeight;

  if (forceSide) {
    const forced = tryPlace(forceSide, spot, vw, vh);
    if (forced) return forced;
  }

  for (const side of SIDES) {
    const placed = tryPlace(side, spot, vw, vh);
    if (placed) return placed;
  }

  // Nothing fit — pick the side with the most free space and clamp.
  const best = [...SIDES]
    .map(side => ({ side, free: freeSpace(side, spot, vw, vh) }))
    .sort((a, b) => b.free - a.free)[0].side;

  // Bubble would overlap; relax constraints and place anyway.
  const cx = spot.left + spot.width / 2;
  const cy = spot.top + spot.height / 2;
  let top, left;
  if (best === 'right' || best === 'left') {
    left = best === 'right'
      ? Math.min(spot.left + spot.width + GAP, vw - BUBBLE_W - MARGIN)
      : Math.max(MARGIN, spot.left - BUBBLE_W - GAP);
    top = Math.max(MARGIN, Math.min(cy - BUBBLE_H_EST / 2, vh - BUBBLE_H_EST - MARGIN));
  } else {
    top = best === 'below'
      ? Math.min(spot.top + spot.height + GAP, vh - BUBBLE_H_EST - MARGIN)
      : Math.max(MARGIN, spot.top - BUBBLE_H_EST - GAP);
    left = Math.max(MARGIN, Math.min(cx - BUBBLE_W / 2, vw - BUBBLE_W - MARGIN));
  }
  const arrow = { side: best };
  if (best === 'right' || best === 'left') {
    arrow.y = Math.max(20, Math.min(cy - top, BUBBLE_H_EST - 20));
  } else {
    arrow.x = Math.max(24, Math.min(cx - left, BUBBLE_W - 24));
  }
  return { top, left, width: BUBBLE_W, side: best, arrow };
};

// Given a side, return the opposite — used by the flip button when the user
// wants the bubble on the other side of the spotlight.
export const flipSide = (current) => {
  if (current === 'right') return 'left';
  if (current === 'left')  return 'right';
  if (current === 'above') return 'below';
  if (current === 'below') return 'above';
  return null;
};

// CSS-triangle arrow attached to the bubble's edge, pointing at the spot.
// The bubble's actual background is a vertical gradient from #1c1f2b to
// #14161e; a single mid-tone (#181b25) makes the arrow read as part of the
// bubble at any vertical position without a visible seam.
const ARROW_COLOR = '#1c1f2b';
const ARROW_SIZE = 9;

export const arrowStyleFor = (arrow) => {
  if (!arrow) return null;
  const s = ARROW_SIZE;
  const base = { position: 'absolute', width: 0, height: 0, pointerEvents: 'none' };
  if (arrow.side === 'right') {
    return {
      ...base,
      left: -s,
      top: arrow.y - s,
      borderTop: `${s}px solid transparent`,
      borderBottom: `${s}px solid transparent`,
      borderRight: `${s}px solid ${ARROW_COLOR}`,
    };
  }
  if (arrow.side === 'left') {
    return {
      ...base,
      right: -s,
      top: arrow.y - s,
      borderTop: `${s}px solid transparent`,
      borderBottom: `${s}px solid transparent`,
      borderLeft: `${s}px solid #14161e`,
    };
  }
  if (arrow.side === 'below') {
    return {
      ...base,
      top: -s,
      left: arrow.x - s,
      borderLeft: `${s}px solid transparent`,
      borderRight: `${s}px solid transparent`,
      borderBottom: `${s}px solid ${ARROW_COLOR}`,
    };
  }
  if (arrow.side === 'above') {
    return {
      ...base,
      bottom: -s,
      left: arrow.x - s,
      borderLeft: `${s}px solid transparent`,
      borderRight: `${s}px solid transparent`,
      borderTop: `${s}px solid #14161e`,
    };
  }
  return null;
};

// Keyframe for the spotlight pulse — injected once by whichever tour mounts
// first. Both Tour and DemoTour call ensurePulseKeyframes() on mount.
let pulseInjected = false;
export const ensurePulseKeyframes = () => {
  if (pulseInjected || typeof document === 'undefined') return;
  const style = document.createElement('style');
  style.setAttribute('data-tour-pulse', '1');
  style.textContent = `
    @keyframes tourSpotlightPulse {
      0%, 100% {
        box-shadow:
          0 0 0 9999px rgba(8,10,18,0.40),
          0 0 30px 4px rgba(242,197,114,0.55) inset,
          0 0 28px 4px rgba(242,197,114,0.45);
      }
      50% {
        box-shadow:
          0 0 0 9999px rgba(8,10,18,0.40),
          0 0 36px 6px rgba(242,197,114,0.75) inset,
          0 0 42px 8px rgba(242,197,114,0.65);
      }
    }
  `;
  document.head.appendChild(style);
  pulseInjected = true;
};
