/**
 * Display and reading settings: appearance (light/dark), text size, contrast
 * and motion. Chosen in Settings > Display and reading, saved with the
 * profile (profiles.layout.display, so they follow the person to another
 * computer) and mirrored to a cookie so the next page load applies them
 * before the first paint. The styles live in app/globals.css under
 * "Display and reading settings".
 */
export type Theme = "system" | "light" | "dark";
export type TextSize = "standard" | "large" | "xlarge";
export type Contrast = "standard" | "high";
export type Motion = "system" | "reduce";

export type DisplayPrefs = {
  theme: Theme;
  text: TextSize;
  contrast: Contrast;
  motion: Motion;
};

export const DEFAULT_DISPLAY: DisplayPrefs = {
  theme: "system",
  text: "standard",
  contrast: "standard",
  motion: "system",
};

export const DISPLAY_CHOICES = {
  theme: [
    ["system", "Match my computer"],
    ["light", "Light"],
    ["dark", "Dark"],
  ],
  text: [
    ["standard", "Standard"],
    ["large", "Large"],
    ["xlarge", "Extra large"],
  ],
  contrast: [
    ["standard", "Standard"],
    ["high", "High"],
  ],
  motion: [
    ["system", "Match my computer"],
    ["reduce", "Reduce motion"],
  ],
} as const satisfies Record<
  keyof DisplayPrefs,
  readonly (readonly [string, string])[]
>;

export const DISPLAY_COOKIE = "cvx-display";

function pick<K extends keyof DisplayPrefs>(k: K, v: unknown): DisplayPrefs[K] {
  return (DISPLAY_CHOICES[k] as readonly (readonly [string, string])[]).some(
    ([value]) => value === v,
  )
    ? (v as DisplayPrefs[K])
    : DEFAULT_DISPLAY[k];
}

/** Validates untrusted input (a profile row, a cookie) into DisplayPrefs. */
export function sanitizeDisplay(input: unknown): DisplayPrefs {
  const o = (input && typeof input === "object" ? input : {}) as Record<
    string,
    unknown
  >;
  return {
    theme: pick("theme", o.theme),
    text: pick("text", o.text),
    contrast: pick("contrast", o.contrast),
    motion: pick("motion", o.motion),
  };
}

/** "theme.text.contrast.motion" — short, cookie-safe, no JSON. */
export function encodeDisplay(p: DisplayPrefs): string {
  return [p.theme, p.text, p.contrast, p.motion].join(".");
}

export function decodeDisplay(raw: string | undefined | null): DisplayPrefs {
  const [theme, text, contrast, motion] = (raw ?? "").split(".");
  return sanitizeDisplay({ theme, text, contrast, motion });
}

/** Applies the choice to <html> now and remembers it for the next load. */
export function applyDisplay(p: DisplayPrefs) {
  if (typeof document === "undefined") return;
  const el = document.documentElement;
  el.dataset.theme = p.theme;
  el.dataset.text = p.text;
  el.dataset.contrast = p.contrast;
  el.dataset.motion = p.motion;
  document.cookie = `${DISPLAY_COOKIE}=${encodeDisplay(p)}; path=/; max-age=31536000; samesite=lax`;
}

/** True when animation should be skipped: the computer asks, or the person chose it here. */
export function reducedMotion(): boolean {
  if (typeof window === "undefined") return false;
  return (
    document.documentElement.dataset.motion === "reduce" ||
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  );
}

/**
 * Runs in <head> before the page paints: reads the cookie and sets the data
 * attributes, so a dark-mode user never sees a white flash. Kept tiny and
 * dependency-free; it only accepts known values.
 */
export const DISPLAY_BOOT_SCRIPT = `(function(){try{var m=document.cookie.match(/(?:^|; )${DISPLAY_COOKIE}=([a-z.]+)/);if(!m)return;var v=m[1].split("."),k=["theme","text","contrast","motion"],ok={theme:["system","light","dark"],text:["standard","large","xlarge"],contrast:["standard","high"],motion:["system","reduce"]},d=document.documentElement;for(var i=0;i<4;i++)if(ok[k[i]].indexOf(v[i])>=0)d.setAttribute("data-"+k[i],v[i]);}catch(e){}})();`;
