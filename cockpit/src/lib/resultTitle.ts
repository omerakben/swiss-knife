// Deterministic title for a saved note (no model call). Prefer a leading
// markdown heading, else a short first line, else the action's title.
const MAX = 80;

export function deriveNoteTitle(text: string, fallback: string): string {
  const lines = text.split(/\r?\n/);
  const firstNonEmpty = lines.find((l) => l.trim().length > 0)?.trim() ?? "";

  const heading = firstNonEmpty.match(/^#{1,6}\s+(.+)$/);
  if (heading) return heading[1].trim().slice(0, MAX);

  if (firstNonEmpty && firstNonEmpty.length <= MAX) return firstNonEmpty;
  return fallback;
}
