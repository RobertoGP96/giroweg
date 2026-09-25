import { acceptFix, type GpsFix } from "@giroweg/shared/domain";
import { GPS_THRESHOLDS } from "@giroweg/shared/tokens";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { SIMULATOR_EVENTS, startGpsSimulator } from "./gpsSimulator";

const START_MS = Date.UTC(2026, 8, 25, 8, 0, 0);
const FIX_COUNT = 120;

const isInaccurate = (index: number): boolean =>
  index >= SIMULATOR_EVENTS.inaccurateFrom &&
  index < SIMULATOR_EVENTS.inaccurateFrom + SIMULATOR_EVENTS.inaccurateCount;

describe("startGpsSimulator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  const collect = (): GpsFix[] => {
    const fixes: GpsFix[] = [];
    const stop = startGpsSimulator((fix) => fixes.push(fix), { intervalMs: 1000, now: () => START_MS });
    vi.advanceTimersByTime(FIX_COUNT * 1000);
    stop();
    return fixes;
  };

  it("emits one fix per interval and stops when asked", () => {
    const fixes = collect();
    expect(fixes).toHaveLength(FIX_COUNT);
    vi.advanceTimersByTime(5000);
    expect(fixes).toHaveLength(FIX_COUNT);
  });

  it("produces consecutive fixes that pass the filter outside the injected faults", () => {
    const fixes = collect();
    for (let i = 1; i < fixes.length; i += 1) {
      const previous = fixes[i - 1];
      const fix = fixes[i];
      if (!previous || !fix) throw new Error("fixture");
      if (isInaccurate(i) || isInaccurate(i - 1)) continue;
      const decision = acceptFix(previous, fix);
      expect(decision.accept, `fix ${i}`).toBe(true);
      if (decision.accept) {
        expect(decision.gap).toBe(i === SIMULATOR_EVENTS.gapAtIndex);
      }
    }
  });

  it("injects a gap longer than the threshold and a burst of inaccurate fixes", () => {
    const fixes = collect();
    const before = fixes[SIMULATOR_EVENTS.gapAtIndex - 1];
    const after = fixes[SIMULATOR_EVENTS.gapAtIndex];
    if (!before || !after) throw new Error("fixture");
    expect(after.t - before.t).toBeGreaterThan(GPS_THRESHOLDS.maxGapMs);
    const burst = fixes.slice(
      SIMULATOR_EVENTS.inaccurateFrom,
      SIMULATOR_EVENTS.inaccurateFrom + SIMULATOR_EVENTS.inaccurateCount,
    );
    expect(burst).toHaveLength(SIMULATOR_EVENTS.inaccurateCount);
    for (const fix of burst) expect(fix.accuracy).toBeGreaterThan(GPS_THRESHOLDS.maxAccuracyM);
  });
});
