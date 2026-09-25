import { describe, expect, it } from "vitest";
import { GPS_THRESHOLDS, colors, toCssDeclarations, toCssVariables } from "./tokens";

describe("tokens", () => {
  it("maps camelCase tokens to --gw-kebab CSS variables", () => {
    const vars = toCssVariables("dark");
    expect(vars["--gw-bg"]).toBe(colors.dark.bg);
    expect(vars["--gw-lime-text"]).toBe(colors.dark.limeText);
    expect(vars["--gw-surface2"]).toBe(colors.dark.surface2);
  });

  it("serializes declarations", () => {
    expect(toCssDeclarations("light")).toContain("--gw-bg:#FFFFFF;");
  });
});

describe("GPS_THRESHOLDS", () => {
  it("has positive thresholds", () => {
    for (const [key, value] of Object.entries(GPS_THRESHOLDS)) {
      expect(value, key).toBeGreaterThan(0);
    }
  });

  it("requires a step larger than the accuracy filter allows", () => {
    expect(GPS_THRESHOLDS.minStepM).toBeLessThan(GPS_THRESHOLDS.maxAccuracyM);
  });
});
