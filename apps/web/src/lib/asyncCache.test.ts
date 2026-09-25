import { beforeEach, describe, expect, it, vi } from "vitest";
import { clearAsyncCache, ensureLoaded, primeAsync, readCache, stampOf, subscribeCache } from "./asyncCache";

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe("asyncCache", () => {
  beforeEach(() => clearAsyncCache());

  it("stamps primitives distinctly", () => {
    expect(stampOf([1, "a"])).not.toBe(stampOf(["1", "a"]));
    expect(stampOf([undefined])).not.toBe(stampOf([""]));
    expect(stampOf([3, null])).toBe(stampOf([3, null]));
  });

  it("loads once per stamp and notifies subscribers", async () => {
    const key = "test:load";
    const load = vi.fn(async () => 42);
    const listener = vi.fn();
    subscribeCache(key, listener);

    await Promise.all([ensureLoaded(key, "v1", load), ensureLoaded(key, "v1", load)]);
    await ensureLoaded(key, "v1", load);

    expect(load).toHaveBeenCalledTimes(1);
    expect(listener).toHaveBeenCalledTimes(1);
    expect(readCache<number>(key)).toEqual({ stamp: "v1", state: { status: "success", data: 42, error: undefined } });
  });

  it("keeps the previous result until a newer stamp settles", async () => {
    const key = "test:stale";
    await ensureLoaded(key, "v1", async () => "old");
    let release: (value: string) => void = () => undefined;
    const pending = ensureLoaded(key, "v2", () => new Promise<string>((resolve) => (release = resolve)));

    expect(readCache<string>(key)?.state.data).toBe("old");
    release("new");
    await pending;
    expect(readCache<string>(key)).toMatchObject({ stamp: "v2", state: { data: "new" } });
  });

  it("stores errors as Error instances and retries only when forced", async () => {
    const key = "test:error";
    const load = vi.fn(async () => {
      throw "boom";
    });
    await ensureLoaded(key, "v1", load);
    await ensureLoaded(key, "v1", load);
    expect(load).toHaveBeenCalledTimes(1);
    const entry = readCache<never>(key);
    expect(entry?.state.status).toBe("error");
    expect(entry?.state.error).toBeInstanceOf(Error);
    expect(entry?.state.error?.message).toBe("boom");

    await ensureLoaded(key, "v1", load, { force: true });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it("lets the newest load win when a forced reload overlaps", async () => {
    const key = "test:race";
    let releaseFirst: (value: string) => void = () => undefined;
    const first = ensureLoaded(key, "v1", () => new Promise<string>((resolve) => (releaseFirst = resolve)));
    await ensureLoaded(key, "v1", async () => "second", { force: true });
    releaseFirst("first");
    await first;
    expect(readCache<string>(key)?.state.data).toBe("second");
  });

  it("primes without awaiting and clears everything on demand", async () => {
    primeAsync("test:prime", async () => "warm", [7]);
    await flush();
    expect(readCache<string>("test:prime")?.stamp).toBe(stampOf([7]));

    const listener = vi.fn();
    subscribeCache("test:prime", listener);
    clearAsyncCache();
    expect(readCache("test:prime")).toBeNull();
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
