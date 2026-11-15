/** Shared drawing helpers for the sign-in panel art (components/account/AuthPanelArt.tsx). */

export const ROSE = "#a6445d";
export const PLUM = "#7a4d66";
export const TEAL = "#62929e";
export const LIGHT = "#9fc1c9";

/** Resting colour of each box of the 4x4 logo (as lib/favicon-mark.ts). */
export function logoColour(index: number) {
  if (index % 4 === 3) return LIGHT;
  if (index < 3) return ROSE;
  if (index === 4 || index === 5 || index === 8) return PLUM;
  return TEAL;
}
/** Colour of box (row, col) of the 8x8 mark: each logo box is a 2x2. */
export function markColour(row: number, col: number) {
  return logoColour(Math.floor(row / 2) * 4 + Math.floor(col / 2));
}

export function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function rgb(hex: string): [number, number, number] {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}
/** Mix toward white (amount > 0) or toward deep navy (amount < 0). */
export function shade(hex: string, amount: number) {
  const [r, g, b] = rgb(hex);
  const [tr, tg, tb] = amount > 0 ? [255, 255, 255] : [8, 22, 32];
  const k = Math.abs(amount);
  const ch = (x: number, y: number) =>
    Math.round(x + (y - x) * k)
      .toString(16)
      .padStart(2, "0");
  return `#${ch(r, tr)}${ch(g, tg)}${ch(b, tb)}`;
}

export const clamp01 = (x: number) => Math.min(1, Math.max(0, x));
export const smooth = (x: number) => {
  const t = clamp01(x);
  return t * t * (3 - 2 * t);
};
export const easeOutQuart = (x: number) => 1 - Math.pow(1 - clamp01(x), 4);
export const easeInOutCubic = (x: number) => {
  const t = clamp01(x);
  return t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
};
export const lerp = (a: number, b: number, t: number) => a + (b - a) * t;

/** Device pixel ratio of the canvas being drawn (set before each frame). */
let DPR = 1;
/** Scale-only transform for the current canvas. */
export function resetTransform(g: CanvasRenderingContext2D) {
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
}
export function setDpr(d: number) {
  DPR = d;
}

/* ---------- Box sprites: gradient face, top highlight, soft shadow ---------- */

export const SPRITE = 64;
export const PAD = 40;
export function makeSprite(colour: string, shadow: number) {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE + PAD * 2;
  const g = c.getContext("2d")!;
  const r = SPRITE * 0.15;
  const path = () => {
    g.beginPath();
    g.roundRect(PAD, PAD, SPRITE, SPRITE, r);
  };
  if (shadow > 0) {
    g.save();
    g.shadowColor = `rgba(3, 12, 20, ${0.55 * shadow})`;
    g.shadowBlur = 22;
    g.shadowOffsetY = 12;
    path();
    g.fillStyle = colour;
    g.fill();
    g.restore();
  }
  // Matte, like card stock: lit softly from above.
  const grad = g.createLinearGradient(PAD, PAD, PAD, PAD + SPRITE);
  grad.addColorStop(0, shade(colour, 0.06));
  grad.addColorStop(1, shade(colour, -0.07));
  path();
  g.fillStyle = grad;
  g.fill();
  // A thin catch-light on the top edge, like the bevel of a card.
  g.save();
  path();
  g.clip();
  const top = g.createLinearGradient(0, PAD, 0, PAD + SPRITE * 0.18);
  top.addColorStop(0, "rgba(255,255,255,0.2)");
  top.addColorStop(1, "rgba(255,255,255,0)");
  g.fillStyle = top;
  g.fillRect(PAD, PAD, SPRITE, SPRITE * 0.18);
  g.restore();
  return c;
}
export function makeGlint() {
  const c = document.createElement("canvas");
  c.width = c.height = SPRITE + PAD * 2;
  const g = c.getContext("2d")!;
  g.beginPath();
  g.roundRect(PAD, PAD, SPRITE, SPRITE, SPRITE * 0.15);
  g.fillStyle = "#fff";
  g.fill();
  return c;
}
/** Draws a sprite as a box of `size` px centred on (x, y). */
export function drawBox(
  g: CanvasRenderingContext2D,
  sprite: HTMLCanvasElement,
  x: number,
  y: number,
  size: number,
  rot: number,
  alpha: number,
) {
  const s = size / SPRITE;
  g.globalAlpha = alpha;
  g.setTransform(DPR, 0, 0, DPR, 0, 0);
  g.translate(x, y);
  if (rot) g.rotate(rot);
  g.scale(s, s);
  g.drawImage(sprite, -SPRITE / 2 - PAD, -SPRITE / 2 - PAD);
}

/* ---------- Scene shared state ---------- */

export type Frame = {
  g: CanvasRenderingContext2D;
  w: number;
  h: number;
  dpr: number;
  /** Seconds since the scene started. */
  t: number;
  /** Where the mark goes: centre and the room it has. */
  cx: number;
  cy: number;
  room: number;
  /** Smoothed pointer, -1..1 across the panel. */
  px: number;
  py: number;
  /** Is the pointer over the panel at all (0..1, smoothed). */
  pin: number;
  /** Pointer in panel pixels. */
  pxPx: number;
  pyPx: number;
};

export type Scene = { draw: (f: Frame) => void };
