import { mkdirSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

export const DEMO_STATE = "tests/e2e/.auth/demo.json";

/**
 * Browser tests run as the fixture-mode demo account, already onboarded with
 * a New York civil litigation profile. Specs that test sign-in itself start
 * from an empty storage state instead.
 */
export default function globalSetup() {
  const value = Buffer.from(
    JSON.stringify({
      fullName: "Jordan Wells",
      jobTitle: "Partner",
      firmName: "Wells & Associates",
      practiceAreas: ["ny_civil_litigation"],
      primaryArea: "ny_civil_litigation",
      niches: ["Trade secrets"],
      jurisdictions: ["S.D.N.Y."],
      onboardedAt: "2026-11-12T00:00:00.000Z",
    }),
  ).toString("base64url");
  mkdirSync(dirname(DEMO_STATE), { recursive: true });
  writeFileSync(
    DEMO_STATE,
    JSON.stringify({
      cookies: [
        {
          name: "cvx_demo",
          value,
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
        // Most specs exercise the practice sample cases; a new account
        // starts empty (see samples.spec.ts).
        {
          name: "casevex-samples",
          value: "on",
          domain: "127.0.0.1",
          path: "/",
          expires: -1,
          httpOnly: true,
          secure: false,
          sameSite: "Lax",
        },
      ],
      origins: [],
    }),
  );
}
