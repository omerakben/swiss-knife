import { describe, expect, it } from "vitest";

import { NAV_ITEMS } from "./nav";
import { MANUAL } from "./manual";
import { buildWizardSystemPrompt, suggestTools } from "./wizard";

describe("wizard grounding", () => {
  it("the system prompt lists every nav tool and marks the advanced ones", () => {
    const p = buildWizardSystemPrompt();
    for (const it of NAV_ITEMS) expect(p, `${it.label} missing from prompt`).toContain(it.label);
    expect(p).toContain("/tools/quick-actions");
    expect(p).toMatch(/advanced/i); // professional tools flagged
    expect(p).toMatch(/never (mention|invent)/i); // closed-list instruction
  });

  it("MANUAL only references real nav tools, and covers every everyday tool (drift tripwire)", () => {
    const hrefs = new Set(NAV_ITEMS.map((n) => n.href));
    for (const key of Object.keys(MANUAL)) {
      expect(hrefs.has(key), `MANUAL key ${key} is not a nav href`).toBe(true);
    }
    for (const it of NAV_ITEMS) {
      if (!it.professional && it.desc) {
        expect(MANUAL[it.href], `everyday tool ${it.label} has no manual entry`).toBeTruthy();
      }
    }
  });

  it("suggestTools matches nav labels, dedups, and returns real nav items", () => {
    expect(suggestTools("Use the Email Writer to draft it.").map((t) => t.label)).toEqual(["Email Writer"]);
    expect(suggestTools("nothing here matches a tool").map((t) => t.label)).toEqual([]);
    expect(suggestTools("Open Tasks, then Tasks again").map((t) => t.label)).toEqual(["Tasks"]); // dedup
    const hrefs = new Set(NAV_ITEMS.map((n) => n.href));
    for (const t of suggestTools("Try Quick Actions and Tasks.")) expect(hrefs.has(t.href)).toBe(true);
  });

  it("suggestTools puts everyday tools before advanced ones and caps at 3", () => {
    const labels = suggestTools("Try Quick Actions, the QA Pipeline, Tasks, and Email Writer.").map((t) => t.label);
    expect(labels.length).toBe(3);
    expect(labels).not.toContain("QA Pipeline"); // advanced down-ranked off the end
    expect(labels[0]).not.toBe("QA Pipeline");
  });

  it("suggestTools includes an advanced tool when it is the clear match", () => {
    expect(suggestTools("The QA Pipeline drafts Gherkin.").map((t) => t.label)).toContain("QA Pipeline");
  });
});
