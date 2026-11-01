import { START_CASH } from "../src/sim/10-catalog/economy";
import { describe, expect, it, vi } from "vitest";
import { prefOf, useStore, type Win } from "../src/ui/store";
import { readSession } from "../src/ui/session";
import { newGame } from "../src/sim/50-state";
import { serialize } from "../src/sim/91-save/save";
import { readyGame } from "./fixtures";
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

  it("plays sounds for every app by default until switched off", () => {
    expect(prefOf({}, "Support")).toEqual({ allow: true, sound: true });
    expect(prefOf({}, "Billing")).toEqual({ allow: true, sound: true });
    expect(prefOf({ Support: { sound: false } }, "Support").sound).toBe(false);
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

  it("opens Getting started on a new game", () => {
    const s = useStore.getState;
    s().startGame();
    expect(s().windows.map((w) => w.app)).toEqual(["Getting started"]);
  });
});

describe("metrics", () => {
  it("starts on level 1 with cash, hardware and two years of the friends' revenue counted toward level 2", () => {
    const m = metrics(readyGame(1));
    expect(m.mrr).toBeCloseTo(18);
    // The savings that bought the 2500 server, the switch and the rack, all at 90% of their price in the first hour.
    expect(m.netWorth).toBeCloseTo(START_CASH - 0.1 * 2500 + 0.9 * (60 + 350) + 24 * 18);
    expect(m.level.level).toBe(1);
    expect(m.next?.level).toBe(2);
    expect(m.progress).toBeCloseTo(m.netWorth / 15000);
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

describe("reload", () => {
  it("keeps the open windows for the tab, without the focus another app asked for", () => {
    const kept = new Map<string, string>();
    vi.stubGlobal("sessionStorage", { getItem: (k: string) => kept.get(k) ?? null, setItem: (k: string, v: string) => kept.set(k, v) });
    try {
      useStore.getState().openApp("Support", { kind: "ticket", id: "tkt1" });
      const ws = readSession<Win[]>("windows", []);
      expect(ws.map((w) => w.app)).toContain("Support");
      expect(ws.find((w) => w.app === "Support")!.focus).toBeUndefined();
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("new game", () => {
  it("clears every stored tab, shell and flag but the sound settings", () => {
    const mem = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), clear: () => m.clear() });
    const local = new Map([["backbone.shell", "1"], ["backbone.theme", "dark"], ["backbone.earlyAccessSeen", "1"]]);
    const session = new Map([["backbone.ui.browser.tabs", "[]"], ["backbone.ui.terminal.history", "[\"ls\"]"]]);
    vi.stubGlobal("localStorage", mem(local));
    vi.stubGlobal("sessionStorage", mem(session));
    try {
      const s = useStore.getState;
      s().setSound({ volume: 0.2 });
      s().setNotifyPref("Finance", { allow: false });
      s().startGame();
      expect([...local.keys()].sort()).toEqual(["backbone.prefs", "backbone.save"]);
      expect(JSON.parse(local.get("backbone.prefs")!)).toEqual({ notify: {}, sound: expect.objectContaining({ volume: 0.2 }) });
      expect([...session.keys()].every((k) => k === "backbone.ui.windows" || k === "backbone.ui.speed")).toBe(true);
      expect(s().notifyPrefs).toEqual({});
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

describe("reload clock", () => {
  // Re-creates the store module the way a page reload does, over the given storages.
  async function reload(local: Map<string, string>, session: Map<string, string>) {
    const mem = (m: Map<string, string>) => ({ getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => m.set(k, v), removeItem: (k: string) => m.delete(k) });
    vi.stubGlobal("localStorage", mem(local));
    vi.stubGlobal("sessionStorage", mem(session));
    vi.resetModules();
    return (await import("../src/ui/store")).useStore;
  }

  it("keeps the speed of a loaded game across a reload and starts a new game paused", async () => {
    const local = new Map<string, string>(), session = new Map<string, string>();
    try {
      const first = await reload(local, session);
      first.getState().setSpeed(2);
      expect(session.get("backbone.ui.speed")).toBe("2");
      expect((await reload(local, session)).getState().speed).toBe(0);
      local.set("backbone.save", serialize(readyGame(1)));
      expect((await reload(local, session)).getState().speed).toBe(2);
      session.set("backbone.ui.speed", "3");
      expect((await reload(local, session)).getState().speed).toBe(0);
    } finally {
      vi.unstubAllGlobals();
      vi.resetModules();
    }
  });
});

describe("alerts", () => {
  it("stops advancing at an alert event, pauses, and Continue restores the speed", () => {
    const s = useStore.getState;
    const game = readyGame(11);
    game.cash = -1000;
    game.brokeSince = null;
    useStore.setState({ game, speed: 4, alert: null, resume: 0 });
    s().setNotifyPref("Finance", { allow: false });
    const start = game.hour;
    s().advance(48);
    expect(s().alert).toMatchObject({ key: "event.cashNegative", title: expect.any(String) });
    expect(s().speed).toBe(0);
    expect(s().resume).toBe(4);
    expect(s().game.hour).toBeLessThan(start + 48);
    s().closeAlert(true);
    expect(s().alert).toBeNull();
    expect(s().speed).toBe(4);
    s().setNotifyPref("Finance", { allow: true });
  });

  it("keeps the game paused when the sheet opens an app", () => {
    const s = useStore.getState;
    useStore.setState({ speed: 0, resume: 4, alert: { id: 1, app: "Finance", title: "a", text: "b", hour: 0, key: "event.cashNegative" } });
    s().closeAlert(false);
    expect(s()).toMatchObject({ alert: null, speed: 0 });
  });
});
