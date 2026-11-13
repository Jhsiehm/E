import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

export default defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    // Pre-existing prototype patterns (state sync in effects, render-time ref
    // write) carried over unchanged by the P0 split. Kept visible as warnings;
    // removed as screens move onto data hooks in P1+. See docs/decisions/0002.
    rules: {
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
  {
    // Keep files small enough to review in one sitting and to give each
    // module one job (security review, ownership, smaller blast radius).
    // See docs/decisions/0009-file-size-limit.md.
    files: ["**/*.{ts,tsx,mjs,js}"],
    rules: {
      "max-lines": [
        "error",
        { max: 300, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  {
    files: ["tests/**/*.{ts,tsx,mjs}"],
    rules: {
      "max-lines": [
        "error",
        { max: 400, skipBlankLines: true, skipComments: true },
      ],
    },
  },
  globalIgnores([
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    "next-env.d.ts",
    "test-results/**",
    "playwright-report/**",
  ]),
]);
