import type { TFunction } from "i18next";
import { describe, expect, it } from "vitest";
import { syncErrorMessage } from "./errorMessage";

const MESSAGES: Record<string, string> = {
  "sync.errors.reading_below_previous": "below",
  "sync.errors.http_401": "session expired ({{code}})",
  "sync.errors.http_5xx": "server ({{code}})",
  "sync.errors.transport": "could not send ({{code}})",
};

/** Minimal i18next stand-in: known keys interpolate `code`, unknown keys yield the default value. */
const t = ((key: string, options?: { code?: string; defaultValue?: string }) => {
  const text = MESSAGES[key];
  if (text === undefined) return options?.defaultValue ?? key;
  return text.replace("{{code}}", options?.code ?? "");
}) as unknown as TFunction;

describe("syncErrorMessage", () => {
  it("translates known server rejection keys", () => {
    expect(syncErrorMessage(t, "reading_below_previous")).toBe("below");
  });

  it("maps HTTP push failures by status and keeps the code visible", () => {
    expect(syncErrorMessage(t, "push_failed_401")).toBe("session expired (push_failed_401)");
    expect(syncErrorMessage(t, "push_failed_503")).toBe("server (push_failed_503)");
  });

  it("falls back to the transport text with the raw code for anything else", () => {
    expect(syncErrorMessage(t, "sqlstate_xx000")).toBe("could not send (sqlstate_xx000)");
    expect(syncErrorMessage(t, "Failed to fetch")).toBe("could not send (Failed to fetch)");
  });
});
