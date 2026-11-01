import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { STARTER_APPS, storeItem, subscriptionPrice, WIDGETS } from "../src/sim/10-catalog/store";
import { type GameState } from "../src/sim/50-state";
import { knowHowPerMonth, tick } from "../src/sim/88-tick/tick";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { cancel, install } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { registered, newGame } from "./fixtures";

const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const at = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m - 1, 1)));

describe("pear store", () => {
  it("starts with the Browser, gets the starter apps with the registration and has no know-how", () => {
    const s = newGame(1);
    expect(s.installed).toEqual(["Browser", "Chat"]);
    expect([...registered(s).installed].sort()).toEqual([...STARTER_APPS, "Chat"].sort());
    expect(s.knowHow).toBe(0);
  });

  it("old saves get the starter apps, every widget and no know-how", () => {
    const raw = JSON.parse(serialize(newGame(2)));
    delete raw.installed;
    delete raw.knowHow;
    const s = deserialize(JSON.stringify(raw));
    expect(s.installed).toEqual([...STARTER_APPS, "Chat", ...WIDGETS.map(([id]) => id)]);
    expect(s.knowHow).toBe(0);
    expect(deserialize(serialize({ ...s, installed: [...s.installed, "Network"] })).installed).toContain("Network");
  });

  it("earns know-how from active contracts at each month start", () => {
    const s = newGame(3);
    const c = addCustomer(s, "Ada", "private");
    addService(s, c, "webHosting", "ada.com", 0.01, "hour");
    addService(s, c, "vps", "ada-vps", 0.02, "hour");
    addService(s, c, "domain", "ada.com", 12, "year");
    expect(knowHowPerMonth(s)).toBeCloseTo(3.2);
    runTo(s, at(2005, 3));
    expect(s.knowHow).toBeCloseTo(6.4);
  });

  it("installs into the dock once the skill is learned and bills monthly", () => {
    const s = newGame(4);
    expect(install(s, "Staff")).toEqual({ ok: false, error: "error.needsResearch" });
    s.unlocks = ["people"];

    const cash = s.cash;
    expect(install(s, "Staff")).toEqual({ ok: true });
    expect(s.installed).toContain("Staff");
    expect(s.cash).toBe(cash - 20);
    expect(s.ledger.at(-1)).toMatchObject({ category: "subscriptions", key: "ledger.subscription", amount: -20 });
    expect(install(s, "Staff")).toEqual({ ok: false, error: "error.installed" });

    runTo(s, at(2005, 2));
    expect(s.ledger.filter((e) => e.key === "ledger.subscription")).toHaveLength(2);

    expect(cancel(s, "Staff")).toEqual({ ok: true });
    expect(s.installed).not.toContain("Staff");
    expect(s.unlocks).toContain("people");
    runTo(s, at(2005, 3));
    expect(s.ledger.filter((e) => e.key === "ledger.subscription")).toHaveLength(2);
    expect(cancel(s, "Locations")).toEqual({ ok: false, error: "error.notInstalled" });
  });

  it("sells widgets without research", () => {
    const s = newGame(6);
    expect(s.installed.some((id) => id.startsWith("widget"))).toBe(false);
    const cash = s.cash;
    expect(install(s, "widgetCash")).toEqual({ ok: true });
    expect(s.installed).toContain("widgetCash");
    expect(s.cash).toBe(cash - 1);
    expect(cancel(s, "widgetCash")).toEqual({ ok: true });
    expect(s.installed).not.toContain("widgetCash");
  });

  it("blocks an install the cash cannot pay", () => {
    const s = newGame(5);
    s.unlocks = ["monitoring"];
    s.cash = 4;
    expect(install(s, "Nagiosaurus")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.installed).not.toContain("Nagiosaurus");
  });

  it("installs free apps while in debt", () => {
    const s = newGame(5);
    s.cash = -500;
    s.unlocks.push("network");
    expect(install(s, "Network")).toEqual({ ok: true });
    expect(s.cash).toBe(-500);
  });

  it("keeps the Network app until network operations is learned", () => {
    const s = newGame(5);
    expect(install(s, "Network")).toEqual({ ok: false, error: "error.needsResearch" });
    s.unlocks.push("network");
    expect(install(s, "Network")).toEqual({ ok: true });
  });

  it("raises prices 8% every year", () => {
    const net = storeItem("Market")!;
    expect(subscriptionPrice(net, 2005)).toBe(15);
    expect(subscriptionPrice(net, 2007)).toBe(17.5);
  });
});
