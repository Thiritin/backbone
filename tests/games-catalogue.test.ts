import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { interestAt, resourcesOf, successorOf, titleById, weightAt, WRITE_COST } from "../src/sim/10-catalog/games";
import { idNum } from "../src/sim/10-catalog/usage";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { HOURS_PER_MONTH } from "../src/sim/40-support/tickets";
import { newGame, type GameState } from "../src/sim/50-state";
import { workloadsOf } from "../src/sim/60-infra/cluster";
import { gameOf, titleCounts } from "../src/sim/60-infra/games";
import { gameLeadLost, offered, titleStatus } from "../src/sim/60-infra/titles";
import { workloadLoad } from "../src/sim/60-infra/usage";
import { gamesTick, isFan, SWITCH_HOURS } from "../src/sim/85-products/games-tick";
import { changeTitle, importTitle, installMod, switchTicket, writeTitleConfig } from "../src/sim/90-actions/games";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { connect, type ActionResult } from "../src/sim/90-actions/hardware";
import { closeTicket } from "../src/sim/90-actions/support";
import { buyDevice, panelServer, skipTo, withServer } from "./fixtures";
import { mountDevice } from "./plugged";

const ok = (r: ActionResult) => {
  if (!r.ok) throw new Error(r.error);
  return r.id!;
};

function world(year: number, panel = "tcadmen") {
  const s: GameState = { ...withServer(newGame(1)), cash: 100_000 };
  const two = ok(buyDevice(s, "g1-compute", "Dwell", 1, "loc1"));
  ok(mountDevice(s, two, "rack2", 2));
  ok(connect(s, { device: two, port: 0 }, { device: "dev4", port: 1 }));
  skipTo(s, year);
  return { s, cluster: panelServer(s, two, panel) };
}

function server(s: GameState, cluster: string, title?: string, size = 0) {
  const customer = addCustomer(s, "Ada Lang", "hobbyDev");
  const id = ok(provisionService(s, customer, "gameServer", { label: "ada", spec: sizeSpec("gameServer", size, 2005 + Math.floor(s.hour / 8766)), clusterId: cluster, title }));
  return { id, c: s.customers.find((x) => x.id === customer)! };
}

// A customer who will ask to move rather than stay a fan.
function drifter(s: GameState, cluster: string, title: string) {
  for (;;) {
    const x = server(s, cluster, title);
    if (!isFan(s, x.id)) return x;
  }
}

function ask(s: GameState, id: string) {
  for (let i = 0; i < 24 * 365 * 4 && !switchTicket(s, id); i++) { s.hour++; gamesTick(s); }
  return switchTicket(s, id)!;
}

describe("faded titles", () => {
  it("lose players online, not happiness", () => {
    const t = titleById("quackiii")!;
    expect(interestAt(t, t.fade)).toBe(1);
    expect(interestAt(t, t.fade + 1)).toBeCloseTo(0.7);
    expect(interestAt(t, t.fade + 20)).toBe(0.15);
    expect(weightAt(t, t.fade + 3)).toBeLessThan(weightAt(t, t.fade + 1));
    const { s, cluster } = world(2013), { id, c } = server(s, cluster, "counterstrife"), w = workloadsOf(s, id)[0];
    const hour = s.hour + 20;
    const faded = workloadLoad(s, w, hour);
    s.gameServers = s.gameServers.map((g) => ({ ...g, title: "teamfortune" }));
    expect(faded).toBeLessThan(workloadLoad(s, w, hour));
    s.gameServers = s.gameServers.map((g) => ({ ...g, title: "counterstrife" }));
    c.happiness = 70;
    for (let i = 0; i < 24; i++) { s.hour++; gamesTick(s); }
    expect(c.happiness).toBeCloseTo(70, 5);
  });

  it("keep about a quarter of their customers as fans", () => {
    const s = newGame(7), fans = Array.from({ length: 400 }, (_, i) => isFan(s, `svc${i}`)).filter(Boolean).length;
    expect(fans).toBeGreaterThan(70);
    expect(fans).toBeLessThan(130);
  });

  it("shrink a server once a month to the slots its busiest hour needs", () => {
    const { s, cluster } = world(2016), { id } = server(s, cluster, "quackiii", 2), before = gameOf(s, id)!.slots!;
    const price = s.services.find((v) => v.id === id)!.price;
    while ((s.hour + 1 + idNum(id)) % HOURS_PER_MONTH !== 0) s.hour++;
    s.hour++;
    gamesTick(s);
    const after = gameOf(s, id)!.slots!;
    expect(after).toBeLessThan(before);
    expect(after).toBeGreaterThanOrEqual(titleById("quackiii")!.slots[0]);
    expect(s.services.find((v) => v.id === id)!.price).toBeCloseTo((price * after) / before, 6);
  });

  it("show in the Titles summary with the faded flag", () => {
    const { s, cluster } = world(2013);
    server(s, cluster, "counterstrife");
    expect(titleCounts(s)).toEqual([{ title: "counterstrife", count: 1, faded: true }]);
  });
});

describe("switch requests", () => {
  it("name the current title of the same genre", () => {
    expect(successorOf(titleById("quackiii")!, 2013)?.id).toBe("teamfortune");
    expect(successorOf(titleById("arkaic")!, 2026)?.id).toBe("rost");
    expect(successorOf(titleById("warcrafty")!, 2016)).toBeUndefined();
  });

  it("come from drifters and keep the customer when accepted", () => {
    const { s, cluster } = world(2014), { id, c } = drifter(s, cluster, "counterstrife");
    ok(installMod(s, id, "metamix"));
    const tk = ask(s, id), before = gameOf(s, id)!, from = titleById("counterstrife")!, to = titleById("teamfortune")!;
    expect(tk.topic).toBe("switchTitle");
    expect(before.switchTo).toBe("teamfortune");
    c.happiness = 60;
    ok(changeTitle(s, id, "teamfortune"));
    const g = gameOf(s, id)!;
    expect(g).toMatchObject({ title: "teamfortune", mods: [], switchTo: null });
    expect(c.happiness).toBeCloseTo(63, 5);
    expect(s.tickets.find((x) => x.id === tk.id)!.outcome).toBe("accepted");
    expect(resourcesOf(to, g.slots!).ramGb).toBeLessThanOrEqual(resourcesOf(from, before.slots!).ramGb + 1e-9);
    expect(c.churnedAt).toBeNull();
  });

  it("are the only way to change a title", () => {
    const { s, cluster } = world(2013), { id } = server(s, cluster, "counterstrife");
    expect(changeTitle(s, id, "teamfortune")).toEqual({ ok: false, error: "error.noSwitchRequest" });
    expect(changeTitle(s, "svc-none", "blockcraft").ok).toBe(false);
  });

  it("lose the customer when declined or left for a week", () => {
    const { s, cluster } = world(2014), a = drifter(s, cluster, "counterstrife");
    const ta = ask(s, a.id);
    ok(closeTicket(s, ta.id));
    expect(s.tickets.find((x) => x.id === ta.id)!.outcome).toBe("declined");
    expect(s.services.find((v) => v.id === a.id)!.endedAt).toBe(s.hour);
    expect(a.c.churnedAt).toBe(s.hour);
    const w = world(2014), b = drifter(w.s, w.cluster, "counterstrife"), tb = ask(w.s, b.id), until = tb.createdAt + SWITCH_HOURS;
    while (w.s.hour < until - 1) { w.s.hour++; gamesTick(w.s); }
    expect(switchTicket(w.s, b.id)).toBeDefined();
    w.s.hour++;
    gamesTick(w.s);
    expect(w.s.tickets.find((x) => x.id === tb.id)!.outcome).toBe("declined");
    expect(w.s.services.find((v) => v.id === b.id)!.endedAt).not.toBeNull();
  });

  it("need the new title on the panel", () => {
    const { s, cluster } = world(2026), { id } = drifter(s, cluster, "arkaic");
    ask(s, id);
    expect(gameOf(s, id)!.switchTo).toBe("rost");
    expect(changeTitle(s, id, "rost")).toEqual({ ok: false, error: "error.titleNotOffered" });
    ok(importTitle(s, "tcadmen", "rost"));
    ok(changeTitle(s, id, "rost"));
  });
});

describe("title catalogue", () => {
  it("ships some titles with each panel and keeps MultiKraft to Blockcraft", () => {
    const { s } = world(2013);
    expect(offered(s, "tcadmen", "counterstrife")).toBe(true);
    expect(offered(s, "tcadmen", "terrarea")).toBe(false);
    expect(offered(s, "pterodaktyl", "battlefeld")).toBe(false);
    expect(titleStatus(s, "multikraft", titleById("terrarea")!)).toBe("none");
    const m = world(2013, "multikraft"), x = server(m.s, m.cluster);
    expect(gameOf(m.s, x.id)!.title).toBe("blockcraft");
  });

  it("imports a community config only after the panel's lag", () => {
    const { s } = world(2012);
    s.hour = hourOf(new Date(Date.UTC(2012, 3, 1)));
    expect(importTitle(s, "tcadmen", "terrarea")).toEqual({ ok: false, error: "error.titleNotYet" });
    expect(titleStatus(s, "tcadmen", titleById("terrarea")!)).toBe("write");
    s.hour = hourOf(new Date(Date.UTC(2012, 6, 3)));
    ok(importTitle(s, "tcadmen", "terrarea"));
    expect(offered(s, "tcadmen", "terrarea")).toBe(true);
    expect(importTitle(s, "tcadmen", "terrarea").ok).toBe(false);
  });

  it("writes a config for a fee, ready after its days", () => {
    const { s } = world(2024), cash = s.cash;
    ok(writeTitleConfig(s, "pterodaktyl", "pallworld"));
    expect(s.cash).toBe(cash - WRITE_COST.pterodaktyl);
    expect(titleStatus(s, "pterodaktyl", titleById("pallworld")!)).toBe("writing");
    s.hour += 3 * 24;
    expect(offered(s, "pterodaktyl", "pallworld")).toBe(true);
    expect(writeTitleConfig(s, "multikraft", "pallworld").ok).toBe(false);
  });

  it("counts game leads lost to titles no panel offers", () => {
    const { s } = world(2024);
    let lost = 0;
    for (let i = 0; i < 200; i++) { s.nextId++; if (gameLeadLost(s)) lost++; }
    expect(lost).toBeGreaterThan(0);
    expect(Object.keys(s.gameLost).every((id) => !offered(s, "tcadmen", id))).toBe(true);
    expect(Object.values(s.gameLost).flat().length).toBe(lost);
    s.gameTitles = { tcadmen: Object.fromEntries(["terrarea", "rost", "arkaic", "fiveem", "valhome", "pallworld"].map((id) => [id, { since: 0 }])) };
    for (let i = 0; i < 200; i++) { s.nextId++; expect(gameLeadLost(s)).toBe(false); }
  });

  it("counts a title a panel already runs as offered, for saves from before the catalogue", () => {
    const { s, cluster } = world(2013);
    server(s, cluster, "terrarea");
    expect(s.gameTitles).toEqual({});
    expect(offered(s, "tcadmen", "terrarea")).toBe(true);
  });
});
