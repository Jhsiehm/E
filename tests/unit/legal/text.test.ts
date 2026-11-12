import { describe, expect, it } from "vitest";
import {
  decodeEntities,
  htmlToText,
  markPlainStarPages,
  normalizeForMatch,
  segment,
} from "@/lib/legal/text";

describe("htmlToText", () => {
  it("strips scripts and tags, keeps star pages and paragraphs", () => {
    const html = `<script>alert(1)</script><p>First &amp; foremost.</p><p>Second <span class="star-pagination">*556</span> part.</p>`;
    const t = htmlToText(html);
    expect(t).not.toContain("alert");
    expect(t).not.toMatch(/<[a-z]/);
    expect(t).toContain("First & foremost.");
    expect(t).toContain("\u0000PAGE:556\u0000");
  });

  it("decodes numeric and named entities", () => {
    expect(decodeEntities("&sect; 349 &#8212; &#x201C;x&#x201D;")).toBe(
      "§ 349 — “x”",
    );
  });
});

describe("segment", () => {
  it("assigns the star page in force at each passage start", () => {
    const html = `<p>${"Intro text. ".repeat(30)}</p><p><a class="page-label" href="#556">*556</a>${"Plausibility standard applies. ".repeat(12)}</p><p>${"More discussion here. ".repeat(15)}</p>`;
    const ps = segment("x:1", "v1", htmlToText(html), {
      reporter: { volume: "550", reporter: "U.S.", page: "544" },
    });
    expect(ps[0].pinpoint).toBe("550 U.S. at 544");
    expect(ps[1].pinpoint).toBe("550 U.S. at 556");
    expect(ps.every((p) => !p.text.includes("\u0000"))).toBe(true);
    expect(ps.map((p) => p.id)).toEqual(ps.map((_, i) => `x:1#p${i + 1}`));
  });

  it("only treats plausible *NNN as star pages in plain text", () => {
    const t = markPlainStarPages("See note *3 and later *547 text", 544);
    expect(t).toContain("*3");
    expect(t).toContain("\u0000PAGE:547\u0000");
  });

  it("splits very long paragraphs on sentences", () => {
    const long = "This is a sentence about the law. ".repeat(100);
    const ps = segment("x:2", "v", long, { maxChars: 500 });
    expect(ps.length).toBeGreaterThan(4);
    expect(ps.every((p) => p.text.length <= 540)).toBe(true);
  });
});

describe("normalizeForMatch", () => {
  it("unifies quotes, dashes, case and footnote markers", () => {
    expect(normalizeForMatch("“Plausible”  — Claim[12] *556")).toBe(
      '"plausible" - claim',
    );
  });
});
