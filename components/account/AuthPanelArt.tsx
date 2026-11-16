"use client";
import { useEffect, useRef } from "react";

/**
 * "Lineage": the picture on the navy side of the sign-in and sign-up
 * screens. It shows what Casevex is for: tracing reasoning through cases.
 *
 * Marbury v. Madison's line types out. A rose underline marks the words
 * that carry forward, and a timeline draws down past Chevron (1984) to
 * Loper Bright (2024). A rose marker then travels down the line, and the 2024
 * opinion types out with Marbury's words, quoted, in rose. It plays once, about
 * eight seconds, and then rests.
 *
 * The finished state is plain markup, so people who ask for reduced motion
 * (or run no script) see it whole and still. Styles live in app/globals.css
 * under "Sign-in panel: Lineage".
 */

const MARBURY =
  "It is emphatically the province and duty of the judicial department to say what the law is.";
/** Words of Marbury's sentence that Loper Bright quotes, by word index. */
const CARRIED = [2, 3, 4, 5, 6, 7, 8, 9, 10];
const PHRASE = "the province and duty of the judicial department".split(" ");
/** Loper Bright's sentence; `rose` marks the words it quotes from 1803. */
const OPINION: { text: string; rose?: boolean }[] = [
  { text: "If it is legal interpretation, that has been, “" },
  { text: "emphatically", rose: true },
  { text: ",” “" },
  { text: PHRASE.join(" "), rose: true },
  { text: "” for at least 221 years." },
];

/* Choreography, in milliseconds. */
const T = {
  head: 150,
  typeStart: 650,
  perChar: 28,
  underline: 3500,
  line: 4100,
  chevron: 4700,
  loper: 5300,
  marker: 5700,
  markerFor: 1300,
  opinion: 7000,
  opinionPerChar: 17,
};
const EASE = "cubic-bezier(0.22, 0.61, 0.24, 1)";

/** Marbury's sentence, one span per word and per letter for the typing. */
function Typed({ text }: { text: string }) {
  const words = text.split(" ");
  return (
    <>
      {words.map((w, i) => {
        const carried = CARRIED.includes(i);
        // Carried words keep their trailing space inside the span, so the
        // underline runs unbroken across the phrase.
        const keepSpace = carried && CARRIED.includes(i + 1);
        return (
          <span key={i}>
            <span className={carried ? "lin-w lin-carry" : "lin-w"}>
              {Array.from(w + (keepSpace ? " " : "")).map((ch, k) => (
                <span key={k} className="lin-ch">
                  {ch}
                </span>
              ))}
            </span>
            {i < words.length - 1 && !keepSpace ? " " : null}
          </span>
        );
      })}
    </>
  );
}

/** Loper Bright's sentence, one span per letter for the typing. */
function Opinion() {
  return (
    <>
      {OPINION.map((part, i) => (
        <span key={i} className={part.rose ? "lin-target" : undefined}>
          {Array.from(part.text).map((ch, k) => (
            <span key={k} className="lin-ch">
              {ch}
            </span>
          ))}
        </span>
      ))}
    </>
  );
}

export default function AuthPanelArt() {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const reduced = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    if (reduced || typeof el.animate !== "function") {
      el.classList.remove("pending");
      return;
    }

    const anims: Animation[] = [];
    const run = (
      node: Element | null,
      frames: Keyframe[],
      delay: number,
      duration: number,
      easing = EASE,
    ) => {
      if (node)
        anims.push(
          node.animate(frames, { delay, duration, easing, fill: "both" }),
        );
    };
    const q = (s: string) => el.querySelector(s);
    const qa = (s: string) => Array.from(el.querySelectorAll(s));
    const show: Keyframe[] = [{ opacity: 0 }, { opacity: 1 }];
    const rise: Keyframe[] = [
      { opacity: 0, transform: "translateY(6px)" },
      { opacity: 1, transform: "none" },
    ];

    // 1803: the citation, then the sentence typed out.
    run(q(".lin-head"), rise, T.head, 700);
    run(q(".lin-q-open"), show, T.typeStart, 120);
    const chars = qa(".lin-quote .lin-ch");
    chars.forEach((ch, i) =>
      run(ch, show, T.typeStart + 80 + i * T.perChar, 90, "linear"),
    );
    run(
      q(".lin-q-close"),
      show,
      T.typeStart + 80 + chars.length * T.perChar,
      120,
    );

    // The words that will carry forward are underlined in rose.
    const sources = qa(".lin-carry");
    sources.forEach((w, i) =>
      run(
        w,
        [{ backgroundSize: "0% 1.5px" }, { backgroundSize: "100% 1.5px" }],
        T.underline + i * 70,
        260,
        "linear",
      ),
    );

    // The timeline draws down, past Chevron, to Loper Bright.
    run(
      q(".lin-line"),
      [{ transform: "scaleY(0)" }, { transform: "scaleY(1)" }],
      T.line,
      1500,
    );
    run(q(".lin-node-1984"), rise, T.chevron, 800);
    run(q(".lin-node-2024 .lin-cite"), rise, T.loper, 800);
    run(q(".lin-node-2024 .lin-dot"), rise, T.loper, 800);
    // A rose marker travels down the line from 1803 to the 2024 entry.
    const marker = q(".lin-marker") as HTMLElement | null;
    const dot = q(".lin-node-2024 .lin-dot") as HTMLElement | null;
    const trail = q(".lin-trail") as HTMLElement | null;
    if (marker && dot && trail) {
      const to =
        dot.getBoundingClientRect().top - trail.getBoundingClientRect().top - 6;
      run(
        marker,
        [
          { opacity: 0, transform: "translateY(0)" },
          { opacity: 1, offset: 0.15, transform: `translateY(${to * 0.1}px)` },
          { opacity: 1, offset: 0.9, transform: `translateY(${to}px)` },
          { opacity: 0, transform: `translateY(${to}px)` },
        ],
        T.marker,
        T.markerFor,
        "cubic-bezier(0.65, 0, 0.35, 1)",
      );
    }

    // Then the 2024 opinion types out, Marbury's words in rose.
    qa(".lin-opinion .lin-ch").forEach((ch, i) =>
      run(ch, show, T.opinion + i * T.opinionPerChar, 90, "linear"),
    );

    el.classList.remove("pending");

    return () => anims.forEach((a) => a.cancel());
  }, []);

  return (
    <div ref={root} className="auth-art lineage pending" aria-hidden="true">
      <div className="lin">
        <p className="lin-cite lin-head">
          <span className="lin-dot lin-dot-1803" />
          1803 · Marbury v. Madison · 5 U.S. 137
        </p>
        <p className="lin-quote">
          <span className="lin-q-open">“</span>
          <Typed text={MARBURY} />
          <span className="lin-q-close">”</span>
        </p>
        <div className="lin-trail">
          <span className="lin-line" />
          <span className="lin-marker" />
          <div className="lin-node lin-node-1984">
            <span className="lin-dot lin-dot-1984" />
            <p className="lin-cite">
              1984 · Chevron U.S.A. v. NRDC · 467 U.S. 837
              <span className="lin-sub">
                Deference to agencies. Overruled in 2024.
              </span>
            </p>
          </div>
          <div className="lin-node lin-node-2024">
            <span className="lin-dot lin-dot-2024" />
            <div>
              <p className="lin-cite">
                2024 · Loper Bright v. Raimondo · 603 U.S. 369
              </p>
              <p className="lin-opinion">
                <Opinion />
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
