import { describe, expect, it } from "vitest";
import {
  FINE,
  PIXEL,
  STEP_SECONDS,
  boxOrigin,
  WAVE_SECONDS,
  colourAt,
  restingColour,
  rippleSeconds,
} from "@/lib/favicon-mark";

describe("tab icon mark", () => {
  it("keeps every box on whole pixels inside the tile", () => {
    for (const layout of [FINE, PIXEL]) {
      for (let i = 0; i < 16; i += 1) {
        const [x, y] = boxOrigin(i, layout);
        expect(Number.isInteger(x) && Number.isInteger(y)).toBe(true);
        expect(x + layout.cell).toBeLessThanOrEqual(layout.size);
        expect(y + layout.cell).toBeLessThanOrEqual(layout.size);
      }
    }
    // The retina drawing is centred: same margin on every side.
    const [last] = boxOrigin(15, FINE);
    expect(FINE.size - (last + FINE.cell)).toBe(FINE.margin);
  });

  it("uses the in-app logo's resting colours", () => {
    const colours = Array.from({ length: 16 }, (_, i) => restingColour(i));
    expect(colours.slice(0, 4)).toEqual([
      "#a6445d",
      "#a6445d",
      "#a6445d",
      "#9fc1c9",
    ]);
    expect([colours[4], colours[5], colours[8]]).toEqual([
      "#7a4d66",
      "#7a4d66",
      "#7a4d66",
    ]);
    expect(colours[15]).toBe("#9fc1c9");
  });

  it("ripples diagonally and settles back on the still mark", () => {
    // Top-left box starts at once; bottom-right waits six steps.
    expect(colourAt(0, 0, 2)).toBe("#a6445d");
    expect(colourAt(15, 0.1, 2)).toBe(restingColour(15));
    expect(colourAt(15, 6 * STEP_SECONDS + WAVE_SECONDS / 2, 2)).toBe(
      "#62929e",
    );
    const end = rippleSeconds(2);
    for (let i = 0; i < 16; i += 1) {
      expect(colourAt(i, end, 2)).toBe(restingColour(i));
    }
  });
});
