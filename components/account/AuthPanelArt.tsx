"use client";
import { useEffect, useRef } from "react";
import { gatherScene } from "@/lib/auth-art/gather";
import { setDpr, type Frame } from "@/lib/auth-art/shared";

/**
 * The picture on the navy side of the sign-in and sign-up screens, drawn on
 * a canvas so the boxes can have depth, light and shadow.
 *
 * A slow field of boxes drifts upward at three depths. Sixty-four of them
 * swoop forward out of the field and settle into the Casevex mark (the
 * logo's 4x4 boxes and colours, each a 2x2 cluster). Afterwards the mark
 * breathes, a soft light passes across it, now and then one cluster lifts
 * like a file being pulled, and everything leans a little toward the
 * pointer. Matters, authorities and deadlines coming together in one place.
 *
 * People who ask for reduced motion get the finished picture, still. The
 * loop only runs while the panel is on screen (it is hidden on phones).
 */

export default function AuthPanelArt() {
  const room = useRef<HTMLDivElement>(null);
  const canvas = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const cv = canvas.current;
    const spot = room.current;
    const panel = cv?.parentElement;
    if (!cv || !spot || !panel) return;
    const g = cv.getContext("2d");
    if (!g) return;

    const scene = gatherScene();

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    let w = 0;
    let h = 0;
    let dpr = 1;
    let start = -1;
    let raf = 0;
    const ptr = { x: 0, y: 0, in: 0, tx: 0, ty: 0, tin: 0, X: -1e4, Y: -1e4 };

    const frame = (t: number) => {
      const r = panel.getBoundingClientRect();
      const s = spot.getBoundingClientRect();
      const f: Frame = {
        g,
        w,
        h,
        dpr,
        t,
        cx: s.left - r.left + s.width / 2,
        cy: s.top - r.top + s.height / 2,
        room: Math.min(s.width, s.height),
        px: ptr.x,
        py: ptr.y,
        pin: ptr.in,
        pxPx: ptr.X,
        pyPx: ptr.Y,
      };
      setDpr(dpr);
      scene.draw(f);
    };

    const tick = () => {
      raf = 0;
      if (!w || !h) return;
      const now = performance.now() / 1000;
      if (start < 0) start = now;
      ptr.x += (ptr.tx - ptr.x) * 0.04;
      ptr.y += (ptr.ty - ptr.y) * 0.04;
      ptr.in += (ptr.tin - ptr.in) * 0.05;
      frame(now - start);
      raf = requestAnimationFrame(tick);
    };

    const still = () => frame(60);

    const resize = () => {
      const r = panel.getBoundingClientRect();
      w = r.width;
      h = r.height;
      dpr = Math.min(2, window.devicePixelRatio || 1);
      cv.width = Math.round(w * dpr);
      cv.height = Math.round(h * dpr);
      if (!w || !h) {
        cancelAnimationFrame(raf);
        raf = 0;
        return;
      }
      if (reduced.matches) still();
      else if (!raf) raf = requestAnimationFrame(tick);
    };

    const onMove = (e: PointerEvent) => {
      const r = panel.getBoundingClientRect();
      const inside =
        e.clientX >= r.left &&
        e.clientX <= r.right &&
        e.clientY >= r.top &&
        e.clientY <= r.bottom;
      ptr.tin = inside ? 1 : 0;
      ptr.tx = Math.max(
        -1,
        Math.min(1, ((e.clientX - r.left) / r.width) * 2 - 1),
      );
      ptr.ty = Math.max(
        -1,
        Math.min(1, ((e.clientY - r.top) / r.height) * 2 - 1),
      );
      ptr.X = e.clientX - r.left;
      ptr.Y = e.clientY - r.top;
    };
    const onLeave = () => {
      ptr.tin = 0;
      ptr.tx = 0;
      ptr.ty = 0;
    };

    const ro = new ResizeObserver(resize);
    ro.observe(panel);
    resize();
    window.addEventListener("pointermove", onMove, { passive: true });
    document.addEventListener("pointerleave", onLeave);
    return () => {
      ro.disconnect();
      cancelAnimationFrame(raf);
      window.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerleave", onLeave);
    };
  }, []);

  return (
    <>
      <canvas ref={canvas} className="auth-art-canvas" aria-hidden="true" />
      <div ref={room} className="auth-art" aria-hidden="true" />
    </>
  );
}
