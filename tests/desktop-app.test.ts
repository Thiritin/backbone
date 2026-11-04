import { describe, expect, it } from "vitest";
import { isDesktopApp, releaseChanges } from "../src/ui/desktop-app";

describe("desktop app", () => {
  it("is detected only when the Tauri bridge exists", () => {
    expect(isDesktopApp({})).toBe(false);
    expect(isDesktopApp({ __TAURI_INTERNALS__: {} })).toBe(true);
    expect(isDesktopApp()).toBe(false);
  });

  it("turns release notes into one changelog day", () => {
    expect(releaseChanges("2026.11.4", "- First change.\n* Second change.\nplain line")).toEqual([{ date: "2026-11-04", items: ["First change.", "Second change."] }]);
    expect(releaseChanges("2026.11.4", "")).toEqual([]);
    expect(releaseChanges("2026.11.4", undefined)).toEqual([]);
  });
});
