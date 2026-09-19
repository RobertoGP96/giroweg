import { describe, expect, it } from "vitest";
import { colors, toCssDeclarations, toCssVariables } from "./tokens";

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
