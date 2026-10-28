import { START_CASH } from "../src/sim/10-catalog/economy";
import { describe, expect, it } from "vitest";
import { useStore } from "../src/ui/store";
import { newGame } from "../src/sim/50-state";
import { metrics } from "../src/sim/metrics";

describe("notification settings", () => {
  it("drops muted apps and shows allowed ones as banners and in the history", () => {
    const s = useStore.getState;
    s().setNotifyPref("Finance", { allow: false });
    s().notify("Finance", "a", "b");
    expect(s().history).toHaveLength(0);
    expect(s().banners).toHaveLength(0);

    // A pref stored before banners merged into allow still shows banners.
    s().setNotifyPref("Finance", { allow: true, banners: false } as never);
    s().notify("Finance", "a", "b");
    expect(s().history).toHaveLength(1);
    expect(s().banners).toHaveLength(1);
  });

  it("removes a notification from the center, then clears the rest", () => {
    const s = useStore.getState;
    s().setNotifyPref("Finance", { allow: true });
    s().notify("Finance", "one", "x");
    s().notify("Finance", "two", "x");
    const [two, one] = s().history;
    s().forget(two.id);
    expect(s().history.map((b) => b.title)).not.toContain("two");
    expect(s().banners.some((b) => b.id === two.id)).toBe(false);
    expect(s().history).toContainEqual(one);
    s().forget(null);
    expect(s().history).toEqual([]);
  });

  it("opens Welcome to Pear on a new game and Getting started once it closes", () => {
    const s = useStore.getState;
    s().startGame();
    expect(s().welcome).toBe(true);
    expect(s().windows).toHaveLength(0);
    s().closeWelcome();
    expect(s().welcome).toBe(false);
    expect(s().windows.map((w) => w.app)).toEqual(["Getting started"]);
  });
});

describe("metrics", () => {
  it("starts on level 1 with its starting cash counted toward level 2", () => {
    const m = metrics(newGame(1));
    expect(m.level.level).toBe(1);
    expect(m.next?.level).toBe(2);
    expect(m.progress).toBeCloseTo(START_CASH / 15000);
  });
  it("stays on level 1 when spent loan money pushes net worth below zero", () => {
    const s = newGame(1);
    s.loans.push({ id: "l", amount: 10_000, rate: 0.1, months: 12, left: 12, payment: 0, balance: 10_000, takenAt: 0, missed: 0 });
    const m = metrics(s);
    expect(m.netWorth).toBeLessThan(0);
    expect(m.level.level).toBe(1);
    expect(m.progress).toBe(0);
  });
});

describe("save handling", () => {
  it("imports a save, rejects junk, and deletes progress back to the start screen", async () => {
    const { serialize } = await import("../src/sim/91-save/save");
    const s = useStore.getState;
    s().importSave(serialize(newGame(7)));
    expect(s().started).toBe(true);
    expect(s().game.seed).toBe(7);

    s().importSave("not a save");
    expect(s().game.seed).toBe(7);
    expect(s().history[0].title).toBe("Import failed");

    s().deleteProgress();
    expect(s().started).toBe(false);
    expect(s().windows).toHaveLength(0);
  });
});

describe("cross-app focus", () => {
  it("opens an app on an item and renews the request when it repeats", () => {
    const s = useStore.getState;
    s().openApp("Billing", { kind: "invoice", id: "inv1" });
    const first = s().windows.find((w) => w.app === "Billing")!.focus!;
    expect(first).toMatchObject({ kind: "invoice", id: "inv1" });
    s().openApp("Billing");
    expect(s().windows.find((w) => w.app === "Billing")!.focus).toBe(first);
    s().openApp("Billing", { kind: "invoice", id: "inv1" });
    expect(s().windows.filter((w) => w.app === "Billing")).toHaveLength(1);
    expect(s().windows.find((w) => w.app === "Billing")!.focus!.n).toBeGreaterThan(first.n);
  });
});
