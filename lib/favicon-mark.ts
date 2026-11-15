/**
 * The Casevex mark as a browser tab icon. Same 4x4 boxes, colours and
 * ripple as the in-app logo (components/Logo.tsx, styles in
 * app/globals.css under "The Casevex mark"), drawn on the navy sidebar
 * tile so the light boxes stay visible on light and dark tab bars.
 *
 * There are two drawings so the boxes land on whole pixels and stay crisp:
 * FINE for 32px (retina screens, where 16 points is 32 pixels) and PIXEL
 * for 16px (standard screens). One centred layout can't do both.
 */

export const TILE = "#142f40";

export type Layout = {
  size: number;
  cell: number;
  gap: number;
  margin: number;
  tileRadius: number;
  boxRadius: number;
};

/** 32px: 6px boxes, 2px gaps, 1px margin all round. */
export const FINE: Layout = {
  size: 32,
  cell: 6,
  gap: 2,
  margin: 1,
  tileRadius: 3,
  boxRadius: 1,
};

/** 16px: 3px boxes, 1px gaps. 15px of boxes in 16, so it sits 1px in. */
export const PIXEL: Layout = {
  size: 16,
  cell: 3,
  gap: 1,
  margin: 1,
  tileRadius: 2,
  boxRadius: 0,
};

const ROSE = "#a6445d";
const PLUM = "#7a4d66";
const TEAL = "#62929e";
const LIGHT = "#9fc1c9";

/** Resting colour of each box, matching `.logo-grid i` in globals.css. */
export function restingColour(index: number): string {
  if (index % 4 === 3) return LIGHT;
  if (index < 3) return ROSE;
  if (index === 4 || index === 5 || index === 8) return PLUM;
  return TEAL;
}

/** `logo-wave-dark`: the ripple colours the logo uses on navy. */
const WAVE = [ROSE, PLUM, TEAL, LIGHT, ROSE];
export const WAVE_SECONDS = 1.8;
/** Each diagonal starts 0.11s after the one before it. */
export const STEP_SECONDS = 0.11;

function hex(c: string): [number, number, number] {
  const n = parseInt(c.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

function mix(a: string, b: string, t: number): string {
  const [ar, ag, ab] = hex(a);
  const [br, bg, bb] = hex(b);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * t)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(ar, br)}${ch(ag, bg)}${ch(ab, bb)}`;
}

/** CSS `ease-in-out` (cubic-bezier(0.42, 0, 0.58, 1)). */
export function easeInOut(x: number): number {
  const bez = (t: number, p1: number, p2: number) =>
    3 * (1 - t) * (1 - t) * t * p1 + 3 * (1 - t) * t * t * p2 + t * t * t;
  let lo = 0;
  let hi = 1;
  for (let i = 0; i < 20; i += 1) {
    const mid = (lo + hi) / 2;
    if (bez(mid, 0.42, 0.58) < x) lo = mid;
    else hi = mid;
  }
  return bez((lo + hi) / 2, 0, 1);
}

/**
 * Colour of box `index` at `seconds` into a ripple that runs `loops`
 * times. Before its delay and after its last loop a box shows its
 * resting colour, exactly like the CSS animation.
 */
export function colourAt(
  index: number,
  seconds: number,
  loops: number,
): string {
  const row = Math.floor(index / 4);
  const col = index % 4;
  const local = seconds - (row + col) * STEP_SECONDS;
  // The small allowance keeps float rounding from leaving a box mid-wave.
  if (local < 0 || local >= loops * WAVE_SECONDS - 1e-9)
    return restingColour(index);
  const phase = (local % WAVE_SECONDS) / WAVE_SECONDS;
  const segment = Math.min(Math.floor(phase * 4), 3);
  const within = phase * 4 - segment;
  return mix(WAVE[segment], WAVE[segment + 1], easeInOut(within));
}

/** Total length of a ripple, including the last box's delay. */
export function rippleSeconds(loops: number): number {
  return loops * WAVE_SECONDS + 6 * STEP_SECONDS;
}

export function boxOrigin(index: number, layout: Layout): [number, number] {
  const step = layout.cell + layout.gap;
  return [
    layout.margin + (index % 4) * step,
    layout.margin + Math.floor(index / 4) * step,
  ];
}
