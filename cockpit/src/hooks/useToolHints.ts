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

function notify() {
  for (const cb of listeners) cb();
}

function fetchHints(): Promise<void> {
  if (fetching) return fetching;
  fetching = fetch("/api/tool-hints")
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => {
      if (d && d.hints && typeof d.hints === "object") overrides = d.hints as Record<string, string>;
    })
    .catch(() => {
      // Offline/engine-down: defaults stand. Not auto-retried — a later
      // refreshToolHints() (e.g. after the user saves a hint) tries again.
    })
    .finally(() => {
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
