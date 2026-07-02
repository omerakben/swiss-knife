import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

// Regression test for the generation-guard described in useToolHints.ts
// (module-level `generation` counter): a stale in-flight fetch that resolves
// AFTER a newer one must not clobber the newer fetch's result. Scoped to the
// module-level fetch/generation logic only — usePlaceholder/useToolHintOverrides
// are React hooks (useSyncExternalStore) that need a render to call, and this
// vitest project runs in the "node" environment (no jsdom/testing-library), so
// they're exercised through refreshToolHints() + the __*ForTest seams instead.
// Each test gets a fresh module instance (vi.resetModules() + a fresh dynamic
// import) so the module-level overrides/fetched/fetching/generation state
// never leaks between tests.

type Deferred<T> = { promise: Promise<T>; resolve: (v: T) => void };

function deferred<T>(): Deferred<T> {
  let resolve!: (v: T) => void;
  const promise = new Promise<T>((r) => {
    resolve = r;
  });
  return { promise, resolve };
}

function fakeResponse(hints: Record<string, string>): Response {
  return { ok: true, json: async () => ({ hints }) } as unknown as Response;
}

describe("useToolHints fetch-race guard", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("a stale fetch that resolves after a newer one does not clobber the newer result", async () => {
    const responseA = deferred<Response>();
    const responseB = deferred<Response>();
    let calls = 0;
    const fetchMock = vi.fn(() => {
      calls += 1;
      return calls === 1 ? responseA.promise : responseB.promise;
    });
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./useToolHints");

    // Start fetch A (generation 1).
    const fetchA = mod.__fetchHintsForTest();
    expect(fetchMock).toHaveBeenCalledTimes(1);

    // A save fires refreshToolHints(), which bumps the generation and starts
    // fetch B (generation 2) — this is the exact sequence the file's own
    // comment describes (mount starts GET A, a save fires refreshToolHints()
    // which starts GET B).
    mod.refreshToolHints();
    expect(fetchMock).toHaveBeenCalledTimes(2);
    const fetchB = mod.__fetchHintsForTest(); // already in flight from refreshToolHints(); same promise, no 3rd call
    expect(fetchMock).toHaveBeenCalledTimes(2);

    // B resolves first with fresh data.
    responseB.resolve(fakeResponse({ "tasks-goal": "fresh from B" }));
    await fetchB;
    expect(mod.__getOverridesForTest()).toEqual({ "tasks-goal": "fresh from B" });

    // A resolves late with stale data — must be ignored.
    responseA.resolve(fakeResponse({ "tasks-goal": "stale from A" }));
    await fetchA;
    expect(mod.__getOverridesForTest()).toEqual({ "tasks-goal": "fresh from B" });
  });

  it("with no race, a single fetch's result is applied normally", async () => {
    const response = deferred<Response>();
    const fetchMock = vi.fn(() => response.promise);
    vi.stubGlobal("fetch", fetchMock);

    const mod = await import("./useToolHints");
    const fetch1 = mod.__fetchHintsForTest();
    response.resolve(fakeResponse({ "email-brief": "custom" }));
    await fetch1;

    expect(mod.__getOverridesForTest()).toEqual({ "email-brief": "custom" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });
});
