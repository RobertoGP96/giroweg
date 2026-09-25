import { describe, expect, it } from "vitest";
import { describeDbError } from "./errors";

/** What the Neon HTTP driver raises, as Drizzle 0.45 hands it over: wrapped as the cause. */
const wrapped = (message: string, code?: string): Error => {
  const driverError = Object.assign(new Error(message), { name: "NeonDbError", code });
  return Object.assign(new Error(`Failed query: insert into "readings" …\nparams: …`), { cause: driverError });
};

describe("describeDbError", () => {
  it("reads the domain rule key raised by a trigger through Drizzle's wrapper", () => {
    const described = describeDbError(wrapped("reading_below_previous: 100.0 is below the previous valid reading 250.0", "23514"));
    expect(described.error).toBe("reading_below_previous");
    expect(described.permanent).toBe(true);
    expect(described.code).toBe("23514");
  });

  it("names integrity failures by SQLSTATE class and marks them permanent", () => {
    const fk = describeDbError(wrapped('insert or update on table "readings" violates foreign key constraint', "23503"));
    expect(fk.error).toBe("foreign_key_violation");
    expect(fk.permanent).toBe(true);

    const unknownState = describeDbError(wrapped("something odd", "XX000"));
    expect(unknownState.error).toBe("sqlstate_xx000");
    expect(unknownState.permanent).toBe(false);
  });

  it("keeps the append-only rule key even without a SQLSTATE", () => {
    const described = describeDbError(wrapped("readings_are_append_only: readings cannot be deleted, void them instead"));
    expect(described.error).toBe("readings_are_append_only");
    expect(described.permanent).toBe(false);
  });

  it("treats transport failures as retryable and keeps their message short", () => {
    const described = describeDbError(new Error(`fetch failed: ${"x".repeat(300)}`));
    expect(described.error).toHaveLength(120);
    expect(described.permanent).toBe(false);
    expect(described.code).toBeNull();
  });

  it("survives non-error values and self-referencing causes", () => {
    expect(describeDbError("boom").error).toBe("boom");
    const loop: { message: string; cause?: unknown } = { message: "loop" };
    loop.cause = loop;
    expect(describeDbError(loop).error).toBe("loop");
  });
});
