import { describe, expect, it } from "vitest";

import { deriveNoteTitle } from "./resultTitle";

describe("deriveNoteTitle", () => {
  it("uses a leading markdown heading", () => {
    expect(deriveNoteTitle("# My weekly plan\n\n- a\n- b", "Plan my week")).toBe("My weekly plan");
    expect(deriveNoteTitle("## Action items\nstuff", "X")).toBe("Action items");
  });
  it("uses a short first line when there is no heading", () => {
    expect(deriveNoteTitle("Reply to the school\n\nrest", "Reply")).toBe("Reply to the school");
  });
  it("falls back when the first line is long or empty", () => {
    const long = "x".repeat(120);
    expect(deriveNoteTitle(long, "Plan my week")).toBe("Plan my week");
    expect(deriveNoteTitle("   \n\n", "Summarize this")).toBe("Summarize this");
  });
  it("trims and caps the derived title", () => {
    expect(deriveNoteTitle("#   Spaced   ", "X")).toBe("Spaced");
  });
  it("strips ATX closing hashes and guards an empty fallback", () => {
    expect(deriveNoteTitle("# Title #", "X")).toBe("Title");
    expect(deriveNoteTitle("", "")).toBe("Saved result");
  });
});
