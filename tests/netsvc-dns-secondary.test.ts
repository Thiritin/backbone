import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { addressTick } from "../src/sim/60-infra/addresses";
import { dnsCovered, dnsZones, slavesServed } from "../src/sim/60-infra/netsvc-dns";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { setSecondary } from "../src/sim/90-actions/netsvc-dns";
import { panelVm, readyGame } from "./fixtures";

function setup() {
  const s = readyGame(1), cloud = s.clusters.find((c) => c.kind === "cloud")!;
  const one = panelVm(s, cloud.id, "bound"), two = panelVm(s, cloud.id, "bound"), cust = addCustomer(s, "Anna Albers", "private");
  provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005) });
  provisionService(s, cust, "dns", { label: "anna.com", clusterId: one });
  addressTick(s);
  const last = s.services.filter((y) => y.product === "dns").at(-1)!.id;
  s.services = s.services.map((x) => (x.id === last ? { ...x, spec: { ...x.spec, zones: 1 } } : x));
  const v = s.services.filter((x) => x.product === "dns").at(-1)!, zones = dnsZones(s, v);
  const stop = () => { s.workloads = s.workloads.map((w) => (w.serviceId === v.id ? { ...w, stopped: true } : w)); };
  return { s, v, zones, one, two, stop };
}

describe("secondary dns", () => {
  it("keeps the service online with the primary down when every zone is covered", () => {
    const { s, v, zones, two, stop } = setup();
    expect(setSecondary(s, zones[0], two).ok).toBe(true);
    expect(slavesServed(s, two)).toEqual(zones.slice(0, 1));
    stop();
    expect(dnsCovered(s, v.id)).toBe(true);
    expect(serviceOnline(s, v.id)).toBe(true);
  });

  it("goes offline when only some zones are covered", () => {
    const { s, v, zones, two, stop } = setup();
    s.services = s.services.map((x) => (x.id === v.id ? { ...x, spec: { ...x.spec, zones: 2 } } : x));
    expect(dnsZones(s, s.services.find((x) => x.id === v.id)).length).toBe(2);
    setSecondary(s, zones[0], two);
    stop();
    expect(dnsCovered(s, v.id)).toBe(false);
    expect(serviceOnline(s, v.id)).toBe(false);
    setSecondary(s, dnsZones(s, s.services.find((x) => x.id === v.id))[1], two);
    expect(serviceOnline(s, v.id)).toBe(true);
  });

  it("refuses the primary's own cluster and a cluster that is not a DNS server", () => {
    const { s, zones, one } = setup();
    expect(setSecondary(s, zones[0], one)).toEqual({ ok: false, error: "error.badSecondary" });
    expect(setSecondary(s, zones[0], s.clusters.find((c) => c.kind === "cloud")!.id)).toEqual({ ok: false, error: "error.badSecondary" });
  });
});
