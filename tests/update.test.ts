import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { newEntries, parseChangelog } from "../src/ui/changelog";
import { shouldOffer, SNOOZE_MS } from "../src/ui/update";

describe("update offer", () => {
  it("offers only when the served build differs", () => {
    expect(shouldOffer("abc", "abc", null, 0)).toBe(false);
    expect(shouldOffer("abc", "def", null, 0)).toBe(true);
    expect(shouldOffer("abc", null, null, 0)).toBe(false);
  });

  it("stays quiet for an hour after Later", () => {
    expect(shouldOffer("abc", "def", 1000, 1000 + SNOOZE_MS - 1)).toBe(false);
    expect(shouldOffer("abc", "def", 1000, 1000 + SNOOZE_MS)).toBe(true);
  });
});

describe("changelog", () => {
  it("parses days and bullets newest first and ignores other lines", () => {
    const days = parseChangelog("# Changelog\n\nIntro text.\n\n## 2026-10-29\n\n- First change.\n- Second change.\n\n## 2026-10-28\n- Older change.\n");
    expect(days).toEqual([{ date: "2026-10-29", items: ["First change.", "Second change."] }, { date: "2026-10-28", items: ["Older change."] }]);
  });

  it("lists only the bullets the running build lacks", () => {
    const running = [{ date: "2026-10-28", items: ["Older change."] }];
    const served = [{ date: "2026-10-29", items: ["First change."] }, { date: "2026-10-28", items: ["Older change.", "Added later."] }];
    expect(newEntries(running, served)).toEqual([{ date: "2026-10-29", items: ["First change."] }, { date: "2026-10-28", items: ["Added later."] }]);
  });

  it("keeps the repository changelog in the standard shape", () => {
    const days = parseChangelog(readFileSync("CHANGELOG.md", "utf8"));
    expect(days.length).toBeGreaterThan(0);
    for (const d of days) {
      expect(d.items.length).toBeGreaterThan(0);
      for (const i of d.items) {
        expect(i).toMatch(/[.!?]$/);
        expect(i).not.toMatch(/—/);
        expect(i).not.toMatch(/\.(ts|tsx|md|css)\b/);
      }
    }
  });
});
