import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import type { GameState } from "../src/sim/50-state";
import { addressTick, serviceAddress } from "../src/sim/60-infra/addresses";
import { dnsTick, dnsZones, zoneOf } from "../src/sim/60-infra/netsvc-dns";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deleteRecord, saveRecord } from "../src/sim/90-actions/netsvc-dns";
import { askedIp } from "../src/sim/60-infra/netsvc-dns";
import { readyGame, panelVm } from "./fixtures";

function setup() {
  const s = readyGame(1), cloud = s.clusters.find((c) => c.kind === "cloud")!;
  const dns = panelVm(s, cloud.id, "bound"), cust = addCustomer(s, "Anna Albers", "private");
  provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005) });
  provisionService(s, cust, "dns", { label: "anna.com", clusterId: dns });
  addressTick(s);
  return { s };
}
const find = (s: GameState, p: string) => s.services.filter((v) => v.product === p).at(-1)!;

describe("dns zones", () => {
  it("derives default records from the customer's service and copies on the first edit", () => {
    const { s } = setup(), zone = dnsZones(s, find(s, "dns"))[0], ip = serviceAddress(s, find(s, "webHosting").id)?.ip;
    expect(s.netsvc.zones[zone]).toBeUndefined();
    const www = zoneOf(s, zone).records.find((r) => r.name === "www")!;
    expect(www.data).toBe(ip);
    expect(saveRecord(s, zone, { ...www, ttl: 300 }).ok).toBe(true);
    expect(s.netsvc.zones[zone].records.find((r) => r.id === www.id)!.ttl).toBe(300);
  });

  it("refuses records the real tool would refuse", () => {
    const { s } = setup(), zone = dnsZones(s, find(s, "dns"))[0];
    const bad = (r: object) => saveRecord(s, zone, { type: "A", name: "x", ttl: 3600, data: "1.2.3.4", ...r });
    expect(bad({ data: "999.1.1.1" })).toEqual({ ok: false, error: "error.badRecord" });
    expect(bad({ type: "CNAME", name: "@", data: "x.net" })).toEqual({ ok: false, error: "error.badRecord" });
    expect(bad({ name: "a.other.org." })).toEqual({ ok: false, error: "error.badRecord" });
    expect(bad({ ttl: 5 })).toEqual({ ok: false, error: "error.badRecord" });
    expect(saveRecord(s, "nowhere.com", { type: "A", name: "x", ttl: 300, data: "1.2.3.4" })).toEqual({ ok: false, error: "error.unknownZone" });
    expect(bad({}).ok).toBe(true);
  });

  it("takes the site offline on a valid wrong address, restores it on the right one and writes in after 4 hours", () => {
    const { s } = setup(), zone = dnsZones(s, find(s, "dns"))[0], web = find(s, "webHosting");
    const ip = serviceAddress(s, web.id)!.ip, www = zoneOf(s, zone).records.find((r) => r.name === "www")!;
    expect(serviceOnline(s, web.id)).toBe(true);
    saveRecord(s, zone, { ...www, data: "203.0.113.9" });
    expect(serviceOnline(s, web.id)).toBe(false);
    s.hour += 3; dnsTick(s);
    expect(s.tickets.some((t) => t.topic === "dnsChange")).toBe(false);
    s.hour += 1; dnsTick(s);
    const tk = s.tickets.find((t) => t.topic === "dnsChange")!;
    expect(tk.serviceId).toBe(web.id);
    expect(askedIp(s, tk.id)).toBe(ip);
    saveRecord(s, zone, { ...www, data: ip });
    expect(serviceOnline(s, web.id)).toBe(true);
    expect(s.tickets.find((t) => t.id === tk.id)!.status).toBe("resolved");
  });

  it("accepts the address the customer asked for and deleting the bad record restores the site", () => {
    const { s } = setup(), zone = dnsZones(s, find(s, "dns"))[0], web = find(s, "webHosting");
    const www = zoneOf(s, zone).records.find((r) => r.name === "www")!;
    saveRecord(s, zone, { ...www, data: "203.0.113.9" });
    expect(deleteRecord(s, zone, www.id).ok).toBe(true);
    expect(serviceOnline(s, web.id)).toBe(true);
  });
});
