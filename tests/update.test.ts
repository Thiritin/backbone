import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { changeKeys, newEntries, parseChangelog, unseenChanges } from "../src/ui/changelog";
import { EMBEDDED, newCompany } from "../src/ui/embedded";
import { markChangesSeen } from "../src/sim/90-actions/changes";
import { deserialize, serialize } from "../src/sim/91-save/save";
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
    expect(days).toEqual([{ date: "2026-10-29", items: ["First change.", "Second change."], version: 2 }, { date: "2026-10-28", items: ["Older change."], version: 1 }]);
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

describe("what is new since the last play", () => {
  const oldSave = () => {
    const { seenChanges: _, ...rest } = newCompany(7);
    return deserialize(JSON.stringify(rest));
  };

  it("shows a new game nothing", () => {
    const g = newCompany(7);
    expect(EMBEDDED.length).toBeGreaterThan(0);
    expect(unseenChanges(g.seenChanges, EMBEDDED)).toEqual([]);
    expect(unseenChanges(deserialize(serialize(g)).seenChanges, EMBEDDED)).toEqual([]);
  });

  it("shows an old save every entry, newest day first", () => {
    const g = oldSave();
    expect(g.seenChanges).toEqual([]);
    expect(unseenChanges(g.seenChanges, EMBEDDED)).toEqual(EMBEDDED);
  });

  it("leaves nothing after closing and shows only later entries next time", () => {
    const g = oldSave();
    markChangesSeen(g, changeKeys(EMBEDDED));
    expect(unseenChanges(g.seenChanges, EMBEDDED)).toEqual([]);
    const later = [{ date: "2099-01-01", items: ["A later change."] }, ...EMBEDDED];
    expect(unseenChanges(deserialize(serialize(g)).seenChanges, later)).toEqual([later[0]]);
  });
});
