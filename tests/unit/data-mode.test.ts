import { describe, expect, it } from "vitest";
import {
  DataModeConfigError,
  resolveDataMode,
  resolveDeployment,
} from "@/lib/runtime/data-mode";

describe("resolveDataMode", () => {
  it("defaults to fixtures in development and test", () => {
    expect(resolveDataMode({ NODE_ENV: "development" })).toBe("fixture");
    expect(resolveDataMode({ NODE_ENV: "test" })).toBe("fixture");
    expect(resolveDataMode({})).toBe("fixture");
  });

  it("never falls back to fixtures in a production build", () => {
    expect(resolveDataMode({ NODE_ENV: "production" })).toBe("live");
    expect(
      resolveDataMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "" }),
    ).toBe("live");
    expect(
      resolveDataMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "  " }),
    ).toBe("live");
  });

  it("serves fixtures in a production build only on explicit opt-in", () => {
    expect(
      resolveDataMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "fixture" }),
    ).toBe("fixture");
  });

  it("allows live mode in development", () => {
    expect(
      resolveDataMode({ NODE_ENV: "development", CASEVEX_DATA_MODE: "live" }),
    ).toBe("live");
  });

  it("refuses fixtures on a pilot deployment, whatever else is set", () => {
    for (const NODE_ENV of ["production", "development", "test"])
      expect(() =>
        resolveDataMode({
          NODE_ENV,
          CASEVEX_DATA_MODE: "fixture",
          CASEVEX_DEPLOYMENT: "pilot",
        }),
      ).toThrow(DataModeConfigError);
    expect(
      resolveDataMode({ NODE_ENV: "development", CASEVEX_DEPLOYMENT: "pilot" }),
    ).toBe("live");
  });

  it("rejects unknown values instead of guessing", () => {
    expect(() =>
      resolveDataMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "mock" }),
    ).toThrow(/CASEVEX_DATA_MODE/);
    expect(() =>
      resolveDataMode({ NODE_ENV: "production", CASEVEX_DATA_MODE: "Fixture" }),
    ).toThrow(DataModeConfigError);
    expect(() => resolveDeployment({ CASEVEX_DEPLOYMENT: "prod" })).toThrow(
      /CASEVEX_DEPLOYMENT/,
    );
  });
});
