/** Sign-in panel art, "ledger": see components/account/AuthPanelArt.tsx. */
import type { Scene } from "./shared";
import {
  markColour,
  seeded,
  shade,
  smooth,
  easeOutQuart,
  resetTransform,
} from "./shared";

/* ---------- Direction 2: Ledger ---------- */

export function ledgerScene(): Scene {
  const N = 14;
  const lo = 3; // the 8x8 mark sits at lo..lo+7 on both axes
  const rand = seeded(1115);
  const tiles: {
    i: number;
    j: number;
    c: string;
    inMark: boolean;
    dist: number;
    delay: number;
  }[] = [];
  for (let s = 0; s < 2 * N - 1; s += 1) {
    for (let i = 0; i < N; i += 1) {
      const j = s - i;
      if (j < 0 || j >= N) continue;
      const inMark = i >= lo && i < lo + 8 && j >= lo && j < lo + 8;
      const dist = Math.hypot(i - (N - 1) / 2, j - (N - 1) / 2) / (N / 2);
      tiles.push({
        i,
        j,
        inMark,
        // i runs down-right, j down-left on screen; read the mark so the
        // rose row sits at the back.
        c: inMark ? markColour(i - lo, lo + 7 - j) : "#1d3d50",
        dist,
        delay: inMark
          ? 1.1 + (i - lo + (lo + 7 - j)) * 0.07 + rand() * 0.25
          : dist * 0.7 + rand() * 0.3,
      });
    }
  }
  // Each logo box (2x2 cluster) stands at its own height, like files of
  // different thickness.
  const clusterHeight = Array.from({ length: 16 }, () => rand());
  const faces = new Map<string, [string, string, string]>();
  const faceOf = (c: string) => {
    if (!faces.has(c))
      faces.set(c, [shade(c, 0.1), shade(c, -0.25), shade(c, -0.45)]);
    return faces.get(c)!;
  };

  return {
    draw(f) {
      const { g, w, h, t } = f;
      resetTransform(g);
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);

      const tw = Math.min(w * 1.25, f.room * 2.1) / N;
      const th = tw * 0.5;
      const gap = tw * 0.07;
      const cx = f.cx;
      const cy = f.cy - (N - 1) * th * 0.5 + th * 0.6;

      // Light from above the mark.
      const halo = g.createRadialGradient(cx, f.cy, 0, cx, f.cy, tw * N * 0.6);
      halo.addColorStop(0, `rgba(98, 146, 158, ${0.14 * smooth(t / 2)})`);
      halo.addColorStop(1, "rgba(98, 146, 158, 0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);

      // Pointer position on the floor, in tile units.
      const relX = (f.pxPx - cx) / (tw / 2);
      const relY = (f.pyPx - cy) / (th / 2);
      const pi = (relX + relY) / 2;
      const pj = (relY - relX) / 2;

      for (const tile of tiles) {
        const { i, j } = tile;
        const k = (t - tile.delay) / 1.6;
        const drop = 1 - easeOutQuart(k);
        const alphaIn = smooth(k * 2.5);
        if (alphaIn <= 0) continue;

        // Mark tiles move with their cluster, so each logo box rises whole.
        const ci = tile.inMark ? Math.floor((i - lo) / 2) : 0;
        const cj = tile.inMark ? Math.floor((j - lo) / 2) : 0;
        const base = tile.inMark
          ? tw * (0.22 + 0.2 * clusterHeight[ci * 4 + cj])
          : tw * 0.07;
        const wi = tile.inMark ? lo + ci * 2 + 0.5 : i;
        const wj = tile.inMark ? lo + cj * 2 + 0.5 : j;
        // A slow swell rolling diagonally through the floor.
        const swell =
          (Math.sin(t * 0.7 - (wi + wj) * 0.42) * 0.5 + 0.5) *
          tw *
          (tile.inMark ? 0.09 : 0.06) *
          smooth((t - 4) / 2);
        const dp = Math.hypot(wi - pi, wj - pj);
        const reach = f.pin * Math.exp(-(dp * dp) / 5) * tw * 0.22;
        const hgt = base + swell + reach;

        const x = cx + (i - j) * (tw / 2);
        const y = cy + (i + j) * (th / 2) - hgt - drop * h * 0.5;
        const hw = tw / 2 - gap;
        const hh = th / 2 - gap / 2;
        const fade = tile.inMark
          ? 1
          : (1 - smooth((tile.dist - 0.35) / 0.65)) * 0.85;
        const bottomFade = 1 - smooth((y - h * 0.6) / (h * 0.28));
        const a = alphaIn * fade * (tile.inMark ? 1 : bottomFade);
        if (a < 0.01) continue;
        const [top, left, right] = faceOf(tile.c);
        g.globalAlpha = a;
        // Left face
        g.beginPath();
        g.moveTo(x - hw, y);
        g.lineTo(x, y + hh);
        g.lineTo(x, y + hh + hgt);
        g.lineTo(x - hw, y + hgt);
        g.closePath();
        g.fillStyle = left;
        g.fill();
        // Right face
        g.beginPath();
        g.moveTo(x + hw, y);
        g.lineTo(x, y + hh);
        g.lineTo(x, y + hh + hgt);
        g.lineTo(x + hw, y + hgt);
        g.closePath();
        g.fillStyle = right;
        g.fill();
        // Top face with a light gradient from the back corner.
        const grad = g.createLinearGradient(x, y - hh, x, y + hh);
        grad.addColorStop(0, shade(tile.c, 0.22));
        grad.addColorStop(1, top);
        g.beginPath();
        g.moveTo(x, y - hh);
        g.lineTo(x + hw, y);
        g.lineTo(x, y + hh);
        g.lineTo(x - hw, y);
        g.closePath();
        g.fillStyle = grad;
        g.fill();
        // Catch-light on the two back edges.
        g.strokeStyle = "rgba(255,255,255,0.16)";
        g.lineWidth = 1;
        g.beginPath();
        g.moveTo(x - hw, y);
        g.lineTo(x, y - hh);
        g.lineTo(x + hw, y);
        g.stroke();
      }
    },
  };
}
