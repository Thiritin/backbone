import { describe, expect, it } from "vitest";
import { useStore } from "../src/ui/store";
import { newGame } from "../src/sim/50-state";
import { metrics } from "../src/sim/metrics";

describe("notification settings", () => {
  it("drops muted apps and keeps banner-less ones in the history only", () => {
    const s = useStore.getState;
    s().setNotifyPref("Finance", { allow: false });
    s().notify("Finance", "a", "b");
    expect(s().history).toHaveLength(0);

    s().setNotifyPref("Finance", { allow: true, banners: false });
    s().notify("Finance", "a", "b");
    expect(s().history).toHaveLength(1);
    expect(s().banners).toHaveLength(0);

    s().notify("Support", "a", "b");
    expect(s().banners).toHaveLength(1);
  });
});

describe("metrics", () => {
  it("starts on level 1 a third of the way to level 2", () => {
    const m = metrics(newGame(1));
    expect(m.level.level).toBe(1);
    expect(m.next?.level).toBe(2);
    expect(m.progress).toBeCloseTo(5000 / 15000);
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
