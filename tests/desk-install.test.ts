import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DESKS, deskHas, deskOf, seats } from "../src/sim/10-catalog/desks";
import { deskItem, monthlyCharge, storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { createTicket } from "../src/sim/40-support/tickets";
import type { Employee } from "../src/sim/47-staff/staff";
import type { GameState } from "../src/sim/50-state";
import { accountsOn } from "../src/sim/60-infra/licence";
import { resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { installDesk, removeDesk, subscribeDesk } from "../src/sim/90-actions/desk-install";
import { readyGame, registered, newGame } from "./fixtures";

const at = (y: number, m = 1) => hourOf(new Date(Date.UTC(y, m - 1, 1)));
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const year = (y: number): GameState => registered({ ...newGame(1), hour: at(y), cash: 1_000_000 });
const hosted = (y: number): GameState => { const s = readyGame(5); s.hour = at(y); s.cash = 1_000_000; return s; };
const panelOf = (s: GameState) => s.clusters.find((c) => c.kind === "panel")!;
const agent = (n: number, role: Employee["role"] = "support"): Employee => ({
  id: `emp${n}`, name: `Agent ${n}`, role, skill: 1, talent: 1, salary: 0, hiredAt: 0, assignment: "queue", location: null,
  trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, team: "office", worked: 0,
});
const deskBills = (s: GameState) => s.ledger.filter((e) => e.key === "ledger.subscriptionSeats");

describe("desk install and subscribe", () => {
  it("sells desks on their own sites, not in the Pear Store", () => {
    expect(DESKS.map((d) => [d.id, d.from, d.monthly])).toEqual([["ostickit", 2005, 0], ["zendusk", 2007, 49], ["freshdusk", 2011, 15], ["freescoot", 2018, 0]]);
    for (const d of DESKS) expect(storeItem(d.id)).toBeUndefined();
    const s = year(2011);
    expect(resolve(s, "www.zendusk.com").page).toEqual({ kind: "deskVendor", id: "zendusk" });
    expect(resolve(s, "freshdusk.com").page).toEqual({ kind: "deskVendor", id: "freshdusk" });
    expect(resolve(s, "ostickit.com").page).toEqual({ kind: "deskVendor", id: "ostickit" });
    expect(resolve(s, "freescoot.net").page).toEqual({ kind: "notfound" });
  });

  it("bills the owner and every support employee, the first month at once", () => {
    const s = year(2007);
    s.staff = [agent(1), agent(2), agent(3, "bookkeeper")];
    expect(seats(s)).toBe(3);
    const cash = s.cash, item = deskItem(DESKS[1]), price = subscriptionPrice(item, 2007);
    expect(price).toBeCloseTo(49 * 1.08 ** 2, 2);
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: true });
    expect(s.cash).toBeCloseTo(cash - price * 3, 2);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.subscriptionSeats", params: { name: "Zendusk", seats: 3 }, amount: -monthlyCharge(s, item) });
    expect(s.desk).toMatchObject({ id: "zendusk", hosting: { kind: "hosted" }, tenant: "pxl" });

    s.staff = [agent(1), agent(2)];
    runTo(s, at(2007, 2));
    expect(deskBills(s)).toHaveLength(2);
    expect(deskBills(s)[1]).toMatchObject({ params: { seats: 3 }, amount: -price * 3 });
    removeDesk(s);
    runTo(s, at(2007, 3));
    expect(deskBills(s)).toHaveLength(2);
  });

  it("mails the agent address on sign-up", () => {
    const s = year(2011);
    subscribeDesk(s, "pxl", "freshdusk");
    expect(s.tickets.at(-1)).toMatchObject({ kind: "mail", topic: "deskWelcome", mail: { from: "Freshdusk", params: { url: "pxl.freshdusk.com/helpdesk", address: "support@pxl.freshdusk.com" } } });
  });

  it("refuses a desk before its year, without cash, with a bad tenant or twice", () => {
    const s = year(2008);
    expect(subscribeDesk(s, "pxl", "freshdusk")).toEqual({ ok: false, error: "error.deskNotYet" });
    expect(subscribeDesk(s, "pxl", "ostickit")).toEqual({ ok: false, error: "error.unknownDesk" });
    expect(subscribeDesk(s, "-pxl", "zendusk")).toEqual({ ok: false, error: "error.deskTenant" });
    expect(subscribeDesk(s, "p x l", "zendusk")).toEqual({ ok: false, error: "error.deskTenant" });
    s.cash = 10;
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: false, error: "error.noCash" });
    expect(s.desk).toBeNull();
    s.cash = 1000;
    expect(subscribeDesk(s, " PXL ", "zendusk")).toEqual({ ok: true });
    expect(s.desk?.tenant).toBe("pxl");
    expect(subscribeDesk(s, "pxl", "zendusk")).toEqual({ ok: false, error: "error.deskInUse" });
    expect(removeDesk(s)).toEqual({ ok: true });
    expect(removeDesk(s)).toEqual({ ok: false, error: "error.noDesk" });
  });

  it("installs a self-hosted desk into a web space of a panel host, free and counted against its licence", () => {
    const s = hosted(2014), c = panelOf(s), cash = s.cash, before = accountsOn(s, c);
    expect(installDesk(s, "nope", "ostickit")).toEqual({ ok: false, error: "error.unknownCluster" });
    const other = s.clusters.find((x) => x.kind !== "panel");
    if (other) expect(installDesk(s, other.id, "ostickit")).toEqual({ ok: false, error: "error.deskHostPanel" });
    expect(installDesk(s, c.id, "zendusk")).toEqual({ ok: false, error: "error.unknownDesk" });
    expect(installDesk(s, c.id, "freescoot")).toEqual({ ok: false, error: "error.deskNotYet" });
    expect(installDesk(s, c.id, "ostickit")).toEqual({ ok: true, id: "1.7" });
    expect(s.desk?.hosting).toEqual({ kind: "self", clusterId: c.id, version: "1.7" });
    expect(installDesk(s, c.id, "ostickit")).toEqual({ ok: false, error: "error.deskInUse" });
    expect(accountsOn(s, c)).toBe(before + 1);
    expect(s.cash).toBe(cash);
    runTo(s, at(2014, 2));
    expect(deskBills(s)).toHaveLength(0);
  });

  it("has the features of the installed release", () => {
    const s = hosted(2014), c = panelOf(s);
    installDesk(s, c.id, "ostickit");
    expect([deskHas(s, "slaTimers"), deskHas(s, "customerSidebar")]).toEqual([true, false]);
    s.hour = at(2020);
    expect([deskHas(s, "customerSidebar"), deskHas(s, "merge")]).toEqual([false, false]);
    removeDesk(s);
    installDesk(s, c.id, "ostickit");
    expect([deskHas(s, "customerSidebar"), deskHas(s, "merge")]).toEqual([true, true]);
  });

  it("keeps one desk at a time; switching drops the configuration and keeps the tickets", () => {
    const s = hosted(2018), c = panelOf(s);
    const id = addCustomer(s, "Customer", "private");
    createTicket(s, s.customers.find((x) => x.id === id)!, "howTo");
    const tickets = s.tickets.length;
    subscribeDesk(s, "pxl", "zendusk");
    s.desk!.rules = [{ when: "howTo", set: { priority: "low" } }];
    expect(installDesk(s, c.id, "freescoot")).toEqual({ ok: true, id: "1.0" });
    expect(deskOf(s)?.id).toBe("freescoot");
    expect(s.desk!.rules).toEqual([]);
    expect(s.mail.channels.map((x) => x.desk)).toEqual(["freescoot"]);
    expect(s.tickets).toHaveLength(tickets + 1);
    expect(s.tickets.filter((t) => t.kind === "howTo").every((t) => t.channelId === s.mail.channels[0].id)).toBe(true);
    runTo(s, at(2018, 2));
    expect(deskBills(s)).toHaveLength(1);
  });
});
