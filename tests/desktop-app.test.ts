import { describe, expect, it } from "vitest";
import { isDesktopApp, releaseChanges } from "../src/ui/desktop-app";

describe("desktop app", () => {
  it("is detected only when the Tauri bridge exists", () => {
    expect(isDesktopApp({})).toBe(false);
    expect(isDesktopApp({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(isDesktopApp()).toBe(false);
  });

  it("turns release notes into changelog days", () => {
    expect(releaseChanges("## 2026-11-04\n\n- First change.\n\n## 2026-11-03\n\n- Second change.")).toEqual([
      { date: "2026-11-04", items: ["First change."] },
      { date: "2026-11-03", items: ["Second change."] },
    ]);
    expect(releaseChanges("- First change.\n* Second change.\nplain line", "2026-11-05")).toEqual([{ date: "2026-11-05", items: ["First change.", "Second change."] }]);
    expect(releaseChanges("")).toEqual([]);
    expect(releaseChanges(undefined)).toEqual([]);
  });
});
