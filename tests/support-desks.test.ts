import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { DESKS, deskHas, deskOf, seats } from "../src/sim/10-catalog/desks";
import { monthlyCharge, storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { newGame, type GameState } from "../src/sim/50-state";
import type { Employee } from "../src/sim/47-staff/staff";
import { tick } from "../src/sim/88-tick/tick";
import { cancel, install } from "../src/sim/90-actions/store";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { stepOf } from "../src/ui/apps/guide";
import { DESK_FEATURES, supportApp } from "../src/ui/apps/support/desk";
import { FreeScootMark, FreshduskMark, GoggleMark, IonoseMark, LookoutMark, GMixMark, OsTickitMark, PearMailMark, ZenduskMark } from "../src/ui/art/mailmarks";
import { registered } from "./fixtures";

const at = (y: number, m: number) => hourOf(new Date(Date.UTC(y, m - 1, 1)));
const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
const year = (y: number): GameState => registered({ ...newGame(1), hour: at(y, 1), cash: 1_000_000 });

const agent = (n: number, role: Employee["role"] = "support"): Employee => ({
  id: `emp${n}`, name: `Agent ${n}`, role, skill: 1, talent: 1, salary: 0, hiredAt: 0, assignment: "queue", location: null,
  trained: [], plan: [], training: null, busyUntil: 0, raise: null, nextRaiseAt: 0, refusedAt: null, team: "office", worked: 0,
});

describe("support desks", () => {
  it("lists the four desks with the Pear Store prices and per-seat billing", () => {
    expect(DESKS.map((d) => [d.id, d.from, d.monthly])).toEqual([["ostickit", 2005, 0], ["zendusk", 2007, 49], ["freshdusk", 2010, 15], ["freescoot", 2018, 0]]);
    for (const d of DESKS) expect(storeItem(d.id)).toMatchObject({ kind: "desk", perSeat: true });
  });

  it("bills the owner and every support employee each month, with the yearly rise", () => {
    const s = year(2007);
    s.staff = [agent(1), agent(2), agent(3, "bookkeeper")];
    expect(seats(s)).toBe(3);
    const cash = s.cash;
    expect(install(s, "zendusk")).toEqual({ ok: true });
    const item = storeItem("zendusk")!;
    const price = subscriptionPrice(item, 2007);
    expect(price).toBeCloseTo(49 * 1.08 ** 2, 2);
    expect(monthlyCharge(s, item)).toBeCloseTo(price * 3, 2);
    expect(s.cash).toBeCloseTo(cash - price * 3, 2);
    expect(s.ledger.at(-1)).toMatchObject({ key: "ledger.subscriptionSeats", params: { name: "Zendusk", seats: 3 }, amount: -monthlyCharge(s, item) });

    s.staff = [agent(1), agent(2)];
    runTo(s, at(2007, 2));
    const bills = s.ledger.filter((e) => e.key === "ledger.subscriptionSeats");
    expect(bills).toHaveLength(2);
    expect(bills[1]).toMatchObject({ params: { seats: 3 }, amount: -price * 3 });
  });

  it("bills a free desk nothing", () => {
    const s = year(2005);
    const cash = s.cash;
    expect(install(s, "ostickit")).toEqual({ ok: true });
    expect(s.cash).toBe(cash);
    expect(s.ledger.some((e) => e.key.startsWith("ledger.subscription"))).toBe(false);
  });

  it("is sold from its year on", () => {
    const s = year(2005);
    expect(install(s, "zendusk")).toEqual({ ok: false, error: "error.deskNotYet" });
    s.hour = at(2007, 1);
    expect(install(s, "zendusk")).toEqual({ ok: true });
    s.hour = at(2009, 1);
    expect(install(s, "freshdusk")).toEqual({ ok: false, error: "error.deskNotYet" });
    s.hour = at(2010, 1);
    expect(install(s, "freshdusk")).toEqual({ ok: true });
    expect(install(s, "freescoot")).toEqual({ ok: false, error: "error.deskNotYet" });
  });

  it("keeps one desk at a time", () => {
    const s = year(2010);
    expect(install(s, "zendusk")).toEqual({ ok: true });
    expect(deskOf(s)?.id).toBe("zendusk");
    expect(install(s, "freshdusk")).toEqual({ ok: true });
    expect(s.installed.filter((id) => DESKS.some((d) => d.id === id))).toEqual(["freshdusk"]);
    expect(install(s, "freshdusk")).toEqual({ ok: false, error: "error.installed" });
    s.cash = 0;
    expect(install(s, "zendusk")).toEqual({ ok: false, error: "error.noCash" });
    expect(deskOf(s)?.id).toBe("freshdusk");
    expect(cancel(s, "freshdusk")).toEqual({ ok: true });
    expect(deskOf(s)).toBeUndefined();
    expect(s.installed).toContain("Support");
  });

  it("gates the interface by desk", () => {
    expect(DESK_FEATURES).toEqual({
      ostickit: ["filters"],
      zendusk: ["filters", "search", "assign", "templates", "slaTimers", "customerSidebar", "reports"],
      freshdusk: ["filters", "search", "assign", "templates", "slaTimers"],
      freescoot: ["filters", "search", "assign"],
    });
    const s = year(2018);
    for (const f of ["filters", "search", "assign", "templates", "slaTimers", "customerSidebar", "reports"] as const) expect(deskHas(s, f)).toBe(false);
    install(s, "freescoot");
    expect(deskHas(s, "search")).toBe(true);
    expect(deskHas(s, "templates")).toBe(false);
    install(s, "zendusk");
    expect(deskHas(s, "reports")).toBe(true);
  });

  it("shows the app as Email with the provider's mark until a desk is installed", () => {
    const s = year(2012);
    expect(s.company.mail.kind).toBe("free");
    expect(supportApp(s)).toMatchObject({ name: "Email", brand: "GMix", icon: GMixMark, style: "gmix" });
    const mail = (m: GameState["company"]["mail"]) => supportApp({ ...s, company: { ...s.company, mail: m } });
    expect(mail({ kind: "external", provider: "goggleWorkspace", seats: 1 })).toMatchObject({ name: "Email", brand: "Goggle Workspace", icon: GoggleMark, style: "goggle" });
    expect(mail({ kind: "external", provider: "lookout365", seats: 1 })).toMatchObject({ icon: LookoutMark, style: "lookout" });
    expect(mail({ kind: "external", provider: "hostedExchange", seats: 1 })).toMatchObject({ icon: IonoseMark, style: "ionose" });
    expect(mail({ kind: "self", software: "postfixit", clusterId: "c1" })).toMatchObject({ icon: PearMailMark, style: "pear" });
  });

  it("shows the app as Support with the desk's mark once one is installed, whatever the mail", () => {
    const marks = { ostickit: OsTickitMark, zendusk: ZenduskMark, freshdusk: FreshduskMark, freescoot: FreeScootMark };
    for (const d of DESKS) {
      const s = year(2018);
      s.company = { ...s.company, mail: { kind: "external", provider: "goggleWorkspace", seats: 1 } };
      install(s, d.id);
      expect(supportApp(s)).toMatchObject({ name: "Support", icon: marks[d.id as keyof typeof marks], style: d.id });
    }
  });

  it("names the dock's mail app in the Getting started steps", () => {
    const s = year(2018);
    for (const id of ["email", "firstCustomer"] as const) expect(stepOf(s, id).text).toContain("in Email.");
    install(s, "zendusk");
    for (const id of ["email", "firstCustomer"] as const) expect(stepOf(s, id).text).toContain("in Support.");
  });

  it("keeps the app id Support in a save and loads a save without a desk as Email", () => {
    const s = year(2007);
    install(s, "zendusk");
    const back = deserialize(serialize(s));
    expect(back.installed).toContain("Support");
    expect(supportApp(back).name).toBe("Support");
    const raw = JSON.parse(serialize(newGame(2)));
    expect(supportApp(deserialize(JSON.stringify(raw))).name).toBe("Email");
  });
});
