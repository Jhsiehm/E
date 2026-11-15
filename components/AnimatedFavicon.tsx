"use client";

import { useEffect } from "react";
import {
  FINE,
  PIXEL,
  TILE,
  boxOrigin,
  colourAt,
  rippleSeconds,
} from "@/lib/favicon-mark";

/** How many times the ripple runs each time it plays (about 4 seconds). */
const LOOPS = 2;
const FRAME_MS = 50;

/**
 * Plays the logo's ripple in the browser tab icon when Casevex opens and
 * when you come back to its tab, then settles on the still mark
 * (app/icon1.png, app/icon2.png). Browsers that don't redraw a changed tab icon (Safari)
 * simply keep the still mark. Off with reduced motion.
 */
export default function AnimatedFavicon() {
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Tabs show the icon at 16 points: 32 pixels on retina, 16 elsewhere.
    const layout = window.devicePixelRatio >= 1.5 ? FINE : PIXEL;
    const { size, cell, tileRadius, boxRadius } = layout;
    const canvas = document.createElement("canvas");
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let timer: number | undefined;
    let saved: [HTMLLinkElement, string][] = [];

    const icons = () =>
      Array.from(
        document.querySelectorAll<HTMLLinkElement>('link[rel~="icon"]'),
      );

    const draw = (seconds: number) => {
      ctx.clearRect(0, 0, size, size);
      ctx.fillStyle = TILE;
      ctx.beginPath();
      ctx.roundRect(0, 0, size, size, tileRadius);
      ctx.fill();
      for (let i = 0; i < 16; i += 1) {
        const [x, y] = boxOrigin(i, layout);
        ctx.fillStyle = colourAt(i, seconds, LOOPS);
        ctx.beginPath();
        ctx.roundRect(x, y, cell, cell, boxRadius);
        ctx.fill();
      }
      const url = canvas.toDataURL("image/png");
      for (const [link] of saved) link.href = url;
    };

    const stop = () => {
      window.clearInterval(timer);
      timer = undefined;
      for (const [link, href] of saved) link.setAttribute("href", href);
      saved = [];
    };

    const play = () => {
      if (timer !== undefined) return;
      saved = icons().map((link) => [link, link.getAttribute("href") ?? ""]);
      if (saved.length === 0) return;
      const start = performance.now();
      const length = rippleSeconds(LOOPS);
      timer = window.setInterval(() => {
        const seconds = (performance.now() - start) / 1000;
        if (seconds >= length || document.hidden) stop();
        else draw(seconds);
      }, FRAME_MS);
    };

    const onVisible = () => {
      if (!document.hidden) play();
    };

    play();
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      document.removeEventListener("visibilitychange", onVisible);
      stop();
    };
  }, []);

  return null;
}
