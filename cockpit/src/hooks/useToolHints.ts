"use client";

import { useSyncExternalStore } from "react";

import { PLACEHOLDER_DEFAULTS } from "@/lib/toolHints";

// Module-level store shared by every usePlaceholder() call on the page (same
// idiom as usePersisted/useIsMac) — one shared bulk GET on first subscribe,
// so a page with a dozen hinted inputs costs one network round trip, not a
// dozen. Both the server snapshot AND the pre-fetch client snapshot are
// PLACEHOLDER_DEFAULTS, so first paint (SSR and a cold/empty DB alike) is
// deterministic — the getByPlaceholder e2e selectors never race the fetch.
// Overrides swap in via re-render once the GET resolves.
let overrides: Record<string, string> = {};
let fetched = false;
let fetching: Promise<void> | null = null;
const listeners = new Set<() => void>();

// Bumped on every fetch start, so a response can tell whether a newer fetch
// has since superseded it. Without this: mount starts GET A, a save fires
// refreshToolHints() (nulling `fetching`) and starts GET B, B resolves first
// with fresh data, then A resolves late and clobbers `overrides` with the
// pre-save snapshot.
let generation = 0;

function notify() {
  for (const cb of listeners) cb();
}

function fetchHints(): Promise<void> {
  if (fetching) return fetching;
  const gen = ++generation;
  fetching = fetch("/api/tool-hints")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (gen !== generation) return; // superseded by a newer fetch — ignore this stale response
      if (d && d.hints && typeof d.hints === "object") overrides = d.hints as Record<string, string>;
    })
    .catch(() => {
      // Offline/engine-down: defaults stand. Not auto-retried — a later
      // refreshToolHints() (e.g. after the user saves a hint) tries again.
    })
    .finally(() => {
      if (gen !== generation) return; // let the newer in-flight fetch own `fetching`/`fetched`
      fetched = true;
      fetching = null;
      notify();
    });
  return fetching;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  if (!fetched) fetchHints();
  return () => listeners.delete(cb);
}

/**
 * The effective placeholder text for a hint key: a saved override if one
 * exists, else the code default from PLACEHOLDER_DEFAULTS. An unregistered
 * key resolves to "" rather than throwing — a typo'd key should degrade to an
 * empty (if odd-looking) placeholder, not crash the page.
 */
export function usePlaceholder(key: string): string {
  return useSyncExternalStore(
    subscribe,
    () => overrides[key] ?? PLACEHOLDER_DEFAULTS[key] ?? "",
    () => PLACEHOLDER_DEFAULTS[key] ?? ""
  );
}

/** Re-fetch the saved hint overrides and notify every subscriber (call after a save/reset). */
export function refreshToolHints(): void {
  fetched = false;
  fetching = null;
  fetchHints();
}

/**
 * The full saved-overrides map (same store as usePlaceholder, one bulk GET
 * shared across both). For a generated field loop (Quick Actions) where the
 * key is computed per-input rather than known at a fixed call site — calling
 * usePlaceholder per field isn't an option since the number of fields is
 * dynamic — a consumer reads this map directly:
 * `overrides[quickActionHintKey(id, field)] ?? codeDefault`.
 */
export function useToolHintOverrides(): Record<string, string> {
  return useSyncExternalStore(subscribe, () => overrides, () => overrides);
}

// Test-only seams for the module-level fetch/generation guard above. Not part
// of the public hook API — usePlaceholder/useToolHintOverrides are the real
// surface. useSyncExternalStore can't be called outside a React render, so
// unit tests exercise the store directly through these instead of mounting a
// component (this vitest project runs in the "node" environment, no
// jsdom/testing-library — see useToolHints.race.test.ts).
export const __fetchHintsForTest = fetchHints;
export const __getOverridesForTest = (): Record<string, string> => overrides;
