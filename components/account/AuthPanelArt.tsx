import type { CSSProperties } from "react";
import { restingColour } from "@/lib/favicon-mark";

/**
 * The picture on the navy side of the sign-in and sign-up screens.
 *
 * Sixty-four boxes start scattered and tilted across the panel, like loose
 * papers on a desk, then glide one by one into the Casevex mark: the same
 * 4x4 boxes and colours as the logo, each box drawn as a 2x2 cluster. Once
 * the mark has settled a slow diagonal glow passes through it every few
 * seconds, the logo's ripple at a calmer pace. Matters, authorities and
 * deadlines coming together in one place.
 *
 * Everything is CSS (styles in app/globals.css under "Sign-in panel art"),
 * so the scattered positions are worked out here from a fixed seed and the
 * server and browser always agree. People who ask for reduced motion see the
 * finished mark, still.
 */

/** Small deterministic random numbers (mulberry32). */
function seeded(seed: number) {
  let a = seed;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

type Box = {
  row: number;
  col: number;
  style: CSSProperties;
};

function boxes(): Box[] {
  const rand = seeded(20261115);
  const out: Box[] = [];
  for (let row = 0; row < 8; row += 1) {
    for (let col = 0; col < 8; col += 1) {
      // Which box of the logo this cluster belongs to.
      const logoIndex = Math.floor(row / 2) * 4 + Math.floor(col / 2);
      // Scatter in units of one box, so it scales with the mark.
      const angle = rand() * Math.PI * 2;
      const reach = 4 + rand() * 7;
      const sx = Math.cos(angle) * reach;
      const sy = Math.sin(angle) * reach * 0.8;
      out.push({
        row,
        col,
        style: {
          "--c": restingColour(logoIndex),
          // A little variation inside each cluster, like paper stock.
          "--o": (0.78 + rand() * 0.22).toFixed(2),
          "--sx": sx.toFixed(2),
          "--sy": sy.toFixed(2),
          "--sr": `${Math.round((rand() - 0.5) * 70)}deg`,
          // Boxes arrive in a loose order, top-left first.
          "--settle": `${(0.25 + (row + col) * 0.09 + rand() * 0.5).toFixed(2)}s`,
          // The glow travels along the diagonals, as in the logo ripple.
          "--glow": `${(5.6 + (row + col) * 0.14).toFixed(2)}s`,
        } as CSSProperties,
      });
    }
  }
  return out;
}

const BOXES = boxes();

export default function AuthPanelArt() {
  return (
    <div className="auth-art" aria-hidden="true">
      <div className="auth-art-mark">
        {BOXES.map((b) => (
          <i
            key={`${b.row}-${b.col}`}
            style={{
              ...b.style,
              gridRow: b.row + 1 + Math.floor(b.row / 2),
              gridColumn: b.col + 1 + Math.floor(b.col / 2),
            }}
          />
        ))}
      </div>
    </div>
  );
}
