import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { transferHost, transferHours, transferMinutes, transferTick } from "../src/sim/60-infra/transfers";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { startTransfer } from "../src/sim/90-actions/webpanel";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { panelServer, withServer } from "./fixtures";

const year = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };
const req = (n: number) => ({ id: `req${n}`, kind: "order" as const, product: "webHosting" as const, serviceId: null });

function world(spec = {}, panel = "cpanic") {
  const s = withServer(newGame(3));
  s.hour = year(2012);
  const host = panelServer(s, "dev3", panel);
  const cust = addCustomer(s, "Mover", "hobbyDev");
  const id = ok(provisionService(s, cust, "webHosting", { label: "mover.de", spec: { ...sizeSpec("webHosting", 0, 2005), transferFrom: "old-host-7.example", ...spec }, clusterId: host }));
  return { s, host, id, cust };
}

describe("account transfers", () => {
  it("flags about 30% of web hosting orders from 2008 and none before", () => {
    const s = newGame(5);
    s.hour = year(2012);
    const n = Array.from({ length: 400 }, (_, i) => i).filter((i) => transferHost(s, req(i))).length;
    expect(n / 400).toBeGreaterThan(0.22);
    expect(n / 400).toBeLessThan(0.38);
    expect(transferHost(s, req(1))).toBe(transferHost(s, req(1)));
    s.hour = year(2007);
    expect(Array.from({ length: 100 }, (_, i) => transferHost(s, req(i))).some(Boolean)).toBe(false);
    s.hour = year(2012);
    expect(transferHost(s, { ...req(1), product: "vps" as never })).toBeUndefined();
  });

  it("lasts an hour per 20 GB and costs player minutes by size", () => {
    expect([1, 20, 21, 100].map(transferHours)).toEqual([1, 1, 2, 5]);
    expect(transferMinutes(25)).toBe(15 + 5 * 3);
    const { s, host, id } = world();
    const before = s.playerBusyUntil, gb = s.services.find((v) => v.id === id)!.spec.diskGb;
    ok(startTransfer(s, host, id));
    const x = s.webpanel.transfers[id];
    expect(x).toMatchObject({ from: "old-host-7.example", status: "running", doneAt: s.hour + transferHours(gb) });
    expect(s.playerBusyUntil).toBeGreaterThan(before);
    expect(startTransfer(s, host, id)).toEqual({ ok: false, error: "error.transferStarted" });
  });

  it("refuses accounts without a flag and hosts that are not cPanic", () => {
    const a = world({ transferFrom: undefined });
    expect(startTransfer(a.s, a.host, a.id)).toEqual({ ok: false, error: "error.noTransfer" });
    const b = world({}, "pleskit");
    expect(startTransfer(b.s, b.host, b.id)).toEqual({ ok: false, error: "error.notCpanic" });
  });

  it("ends in time, raising happiness when quick, and fails more often behind on PHP", () => {
    let done = 0, failed = 0, tickets = 0;
    for (let seed = 1; seed <= 200; seed++) {
      const { s, host, id, cust } = world();
      s.seed = seed;
      ok(startTransfer(s, host, id));
      const happy = s.customers.find((c) => c.id === cust)!.happiness;
      transferTick(s);
      expect(s.webpanel.transfers[id].status).toBe("running");
      s.hour = s.webpanel.transfers[id].doneAt;
      transferTick(s);
      const st = s.webpanel.transfers[id].status;
      if (st === "done") { done++; expect(s.customers.find((c) => c.id === cust)!.happiness).toBeGreaterThan(happy); } else failed++;
      tickets += s.tickets.filter((t) => t.topic === "transferFailed").length;
    }
    expect(failed).toBeGreaterThan(0);
    expect(failed).toBeLessThan(40);
    expect(tickets).toBe(failed);
    expect(done + failed).toBe(200);
  });

  it("can run a failed transfer again and resolves its ticket", () => {
    for (let seed = 1; seed < 400; seed++) {
      const { s, host, id } = world();
      s.seed = seed;
      ok(startTransfer(s, host, id));
      s.hour = s.webpanel.transfers[id].doneAt;
      transferTick(s);
      if (s.webpanel.transfers[id].status !== "failed") continue;
      ok(startTransfer(s, host, id));
      expect(s.webpanel.transfers[id].status).toBe("running");
      expect(s.tickets.filter((t) => t.topic === "transferFailed" && t.status !== "resolved")).toHaveLength(0);
      return;
    }
    throw new Error("no failure drawn");
  });

  it("keeps transfers through a save and drops ended services", () => {
    const { s, host, id } = world();
    ok(startTransfer(s, host, id));
    const back = deserialize(serialize(s));
    expect(back.webpanel.transfers[id]).toEqual(s.webpanel.transfers[id]);
    back.services = back.services.map((v) => (v.id === id ? { ...v, endedAt: back.hour } : v));
    transferTick(back);
    expect(back.webpanel.transfers).toEqual({});
  });
});
