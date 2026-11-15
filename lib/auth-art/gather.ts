/** Sign-in panel art, "gather": see components/account/AuthPanelArt.tsx. */
import type { Scene } from "./shared";
import {
  ROSE,
  PLUM,
  TEAL,
  LIGHT,
  markColour,
  seeded,
  shade,
  smooth,
  easeOutQuart,
  easeInOutCubic,
  lerp,
  makeSprite,
  makeGlint,
  drawBox,
  resetTransform,
} from "./shared";

/* ---------- Direction 1: Gather ---------- */

export function gatherScene(): Scene {
  const rand = seeded(20261115);
  const sprites = new Map<string, HTMLCanvasElement>();
  const sprite = (c: string, deep: boolean) => {
    const k = `${c}${deep}`;
    if (!sprites.has(k)) sprites.set(k, makeSprite(c, deep ? 1 : 0.35));
    return sprites.get(k)!;
  };
  const glint = makeGlint();

  const fieldColours = [TEAL, TEAL, TEAL, LIGHT, LIGHT, PLUM, ROSE];
  const field = Array.from({ length: 66 }, () => ({
    x: rand(),
    y: rand(),
    z: 0.2 + rand() * 0.8,
    c: fieldColours[Math.floor(rand() * fieldColours.length)],
    rot: (rand() - 0.5) * 1.2,
    spin: (rand() - 0.5) * 0.06,
    drift: 0.6 + rand() * 0.8,
  }));

  const mark = Array.from({ length: 64 }, (_, i) => {
    const row = Math.floor(i / 8);
    const col = i % 8;
    return {
      row,
      col,
      c: markColour(row, col),
      // Where it starts: somewhere in the field, back in depth.
      sx: rand(),
      sy: 0.1 + rand() * 0.8,
      sz: 0.25 + rand() * 0.3,
      srot: (rand() - 0.5) * 2.4,
      // The swoop bends to one side or the other.
      bend: (rand() - 0.5) * 0.9,
      delay: 0.5 + (row + col) * 0.075 + rand() * 0.55,
      tone: (rand() - 0.5) * 0.08,
      phase: rand() * Math.PI * 2,
    };
  });
  // Brightness variation inside each cluster, so it reads like paper stock.
  const toned = mark.map((m) => shade(m.c, m.tone));

  const SETTLE = 3.2;
  const LIFT_EVERY = 7;
  const SWEEP_EVERY = 10;

  return {
    draw(f) {
      const { g, w, h, t } = f;
      resetTransform(g);
      g.globalAlpha = 1;
      g.clearRect(0, 0, w, h);

      const cell = Math.max(14, Math.min(40, f.room / 13.5));
      const inner = cell * 0.16;
      const block = cell * 0.38;
      const span = 8 * cell + 7 * inner + 3 * (block + inner);
      const ox = f.cx - span / 2;
      const oy = f.cy - span / 2;

      // A low pool of light behind the mark.
      const settled = smooth((t - 1.2) / 3);
      const halo = g.createRadialGradient(
        f.cx + f.px * 14,
        f.cy + f.py * 10,
        0,
        f.cx,
        f.cy,
        span * 1.15,
      );
      halo.addColorStop(0, `rgba(98, 146, 158, ${0.16 * settled})`);
      halo.addColorStop(0.55, `rgba(98, 146, 158, ${0.05 * settled})`);
      halo.addColorStop(1, "rgba(98, 146, 158, 0)");
      g.fillStyle = halo;
      g.fillRect(0, 0, w, h);

      // The drifting field, back to front. It thins out toward the tagline.
      const fieldIn = smooth(t / 1.6);
      for (const p of field) {
        const speed = 7 * p.z * p.drift;
        let y = (p.y * (h + 80) - t * speed) % (h + 80);
        if (y < -40) y += h + 80;
        const x =
          p.x * w + Math.sin(t * 0.13 + p.y * 9) * 10 * p.z - f.px * 26 * p.z;
        const yy = y - 40 - f.py * 16 * p.z;
        const size = cell * (0.32 + 0.55 * p.z);
        const fade = 1 - smooth((yy - h * 0.62) / (h * 0.3));
        const a = (0.05 + 0.22 * p.z * p.z) * fieldIn * fade;
        if (a < 0.01) continue;
        drawBox(g, sprite(p.c, false), x, yy, size, p.rot + t * p.spin, a);
      }

      // Which cluster is lifting, and the light sweep position.
      const liftCycle = Math.floor((t - 6) / LIFT_EVERY);
      const liftT = (t - 6 - liftCycle * LIFT_EVERY) / 2.4;
      const liftRand = seeded(liftCycle + 99)();
      const liftCluster = t > 6 ? Math.floor(liftRand * 16) : -1;
      const liftAmt = liftT < 1 ? Math.sin(Math.PI * easeInOutCubic(liftT)) : 0;
      const sweepT = (t - 5.2) / SWEEP_EVERY;
      const sweepPos = t > 5.2 ? ((sweepT % 1) * SWEEP_EVERY) / 3.2 : -1; // 0..1 over 3.2s

      // The mark, drawn top-left to bottom-right so shadows fall forward.
      for (let i = 0; i < 64; i += 1) {
        const m = mark[i];
        const fx =
          ox + m.col * (cell + inner) + Math.floor(m.col / 2) * (block + inner);
        const fy =
          oy + m.row * (cell + inner) + Math.floor(m.row / 2) * (block + inner);
        const cluster = Math.floor(m.row / 2) * 4 + Math.floor(m.col / 2);

        const k = (t - m.delay) / SETTLE;
        const e = easeOutQuart(k);
        const sx = m.sx * w;
        const sy = m.sy * h;
        // Curved path: control point pushed sideways from the midpoint.
        const mx = (sx + fx) / 2 + (fy - sy) * m.bend;
        const my = (sy + fy) / 2 - (fx - sx) * m.bend;
        const u = 1 - e;
        let x = u * u * sx + 2 * u * e * mx + e * e * fx + cell / 2;
        let y = u * u * sy + 2 * u * e * my + e * e * fy + cell / 2;
        const z = lerp(m.sz, 1, easeInOutCubic(k));
        let size = cell * lerp(0.55, 1, z);
        const rot = m.srot * (1 - e);
        const a = smooth(k * 3) * lerp(0.35, 1, e);

        // Living state once settled: breathe, lean, lift.
        const live = smooth((t - m.delay - SETTLE * 0.8) / 1.5);
        y +=
          Math.sin(t * 0.55 + cluster * 0.9) * cell * 0.035 * live -
          f.py * 7 * live;
        x -= f.px * 9 * live;
        const lift = cluster === liftCluster ? liftAmt * live : 0;
        y -= lift * cell * 0.2;
        size *= 1 + lift * 0.07;

        drawBox(g, sprite(toned[i] ?? m.c, true), x, y, size, rot, a);

        // The light sweep: a soft diagonal band of brightness.
        let glow = 0;
        if (sweepPos >= 0 && sweepPos <= 1.4) {
          const d = (m.row + m.col) / 14 - (sweepPos * 1.4 - 0.2);
          glow = Math.exp(-(d * d) / 0.012) * 0.2;
        }
        // Pointer light: boxes nearest the pointer catch a little light.
        const dx = f.pxPx - x;
        const dy = f.pyPx - y;
        glow +=
          f.pin * 0.12 * Math.exp(-(dx * dx + dy * dy) / (cell * cell * 18));
        glow += lift * 0.08;
        if (glow > 0.005) {
          g.globalCompositeOperation = "lighter";
          drawBox(g, glint, x, y, size, rot, glow * live);
          g.globalCompositeOperation = "source-over";
        }
      }
    },
  };
}
