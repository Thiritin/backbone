import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { serviceOnline } from "../src/sim/40-support/status";
import { newGame } from "../src/sim/50-state";
import { netsvcBroken } from "../src/sim/60-infra/netsvc";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { BASEMENT_SERVER, panelServer, withServer } from "./fixtures";

describe("netsvc state", () => {
  it("round trips through a save", () => {
    const s = newGame(1);
    s.netsvc.mail["ip1"] = { deferred: 12, hit: 3, listings: [5] };
    expect(deserialize(serialize(s)).netsvc.mail["ip1"]).toEqual({ deferred: 12, hit: 3, listings: [5] });
  });

  it("loads an old save without netsvc as empty records", () => {
    const data = JSON.parse(serialize(newGame(1))) as Record<string, unknown>;
    delete data.netsvc;
    const s = deserialize(JSON.stringify(data));
    expect(s.netsvc).toEqual({ mail: {}, relay: {}, quotas: {}, zones: {}, vpn: {}, buckets: {}, ec: {}, shares: {}, policy: { shareExpiryDays: 0 }, broken: {} });
  });

  it("takes a service offline while it is marked broken", () => {
    const s = withServer(newGame(1));
    const host = panelServer(s, BASEMENT_SERVER), cust = addCustomer(s, "Anna Albers", "private");
    const r = provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005), clusterId: host });
    const id = s.services[0].id;
    expect(r.ok).toBe(true);
    expect(serviceOnline(s, id)).toBe(true);
    s.netsvc.broken[id] = { cause: "dns", since: s.hour };
    expect(netsvcBroken(s, id)).toBe(true);
    expect(serviceOnline(s, id)).toBe(false);
  });
});
