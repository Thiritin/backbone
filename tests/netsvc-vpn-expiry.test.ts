import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { CERT_FEE, vpnOf } from "../src/sim/60-infra/netsvc-vpn";
import { netsvcTick } from "../src/sim/60-infra/netsvc";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { renewCert, setAutoEnroll } from "../src/sim/90-actions/netsvc-vpn";
import { panelVm, readyGame } from "./fixtures";

function setup(panel: string) {
  const s = readyGame(1), cloud = s.clusters.find((c) => c.kind === "cloud")!;
  const cust = addCustomer(s, "Anna Albers", "private");
  provisionService(s, cust, "vpn", { label: "anna", spec: sizeSpec("vpn", 0, 2005), clusterId: panelVm(s, cloud.id, panel) });
  const v = () => s.services.find((x) => x.product === "vpn")!;
  return { s, v, at: () => v().startedAt + 365 * 24 };
}

describe("vpn certificate expiry", () => {
  it("warns 30 days ahead, takes the service offline at expiry and comes back on renewal", () => {
    const { s, v, at } = setup("openveepeen");
    s.hour = at() - 30 * 24;
    expect(netsvcTick(s).map((e) => e.key)).toContain("event.vpnCertSoon");
    s.hour = at() - 1;
    netsvcTick(s);
    expect(serviceOnline(s, v().id)).toBe(true);
    s.hour = at();
    netsvcTick(s);
    expect(s.netsvc.broken[v().id]?.cause).toBe("cert");
    expect(serviceOnline(s, v().id)).toBe(false);
    const cash = s.cash;
    expect(renewCert(s, v().id).ok).toBe(true);
    expect(s.cash).toBe(cash);
    expect(serviceOnline(s, v().id)).toBe(true);
    expect(vpnOf(s, v()).serverExpiresAt).toBe(at() + 365 * 24);
  });

  it("charges the CA fee for AnyConnekt and renews by itself 7 days early when auto-enroll is on", () => {
    const { s, v, at } = setup("anyconnekt");
    const cash = s.cash;
    renewCert(s, v().id);
    expect(s.cash).toBe(cash - CERT_FEE);
    expect(setAutoEnroll(s, v().id, true).ok).toBe(true);
    s.hour = vpnOf(s, v()).serverExpiresAt - 7 * 24;
    const before = s.cash;
    netsvcTick(s);
    expect(s.cash).toBe(before - CERT_FEE);
    expect(s.netsvc.broken[v().id]).toBeUndefined();
    expect(at()).toBeLessThan(vpnOf(s, v()).serverExpiresAt);
  });

  it("refuses auto-enroll on OpenVeePeeN", () => {
    const { s, v } = setup("openveepeen");
    expect(setAutoEnroll(s, v().id, true)).toEqual({ ok: false, error: "error.noAutoEnroll" });
  });
});
