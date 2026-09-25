import { describe, expect, it } from "vitest";
import { NAV_TYPE, navOptions } from "./navigation";

describe("navigation", () => {
  it("maps directions to distinct transition types", () => {
    expect(navOptions("forward")).toEqual({ transitionTypes: [NAV_TYPE.forward] });
    expect(navOptions("back")).toEqual({ transitionTypes: [NAV_TYPE.back] });
    expect(navOptions("tab")).toEqual({ transitionTypes: [NAV_TYPE.tab] });
    expect(new Set(Object.values(NAV_TYPE)).size).toBe(3);
  });
});
