import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame } from "../src/sim/50-state";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { subscriptionsOf } from "../src/ui/apps/browser/consoles/pleskit/subscriptions";
import { panelServer, withServer } from "./fixtures";

const ok = (r: { ok: boolean; id?: string; error?: string }) => { if (!r.ok) throw new Error(r.error); return r.id!; };

describe("Pleskit subscriptions", () => {
  it("groups a customer's domain, dns and ssl services under the matching subscription", () => {
    const s = withServer(newGame(2));
    s.hour = hourOf(new Date(Date.UTC(2017, 0, 1)));
    const host = panelServer(s, "dev3", "pleskit");
    const ada = addCustomer(s, "Ada", "hobbyDev"), bob = addCustomer(s, "Bob", "hobbyDev");
    const a = ok(provisionService(s, ada, "webHosting", { label: "ada.de", spec: sizeSpec("webHosting", 0, 2017), clusterId: host }));
    const b = ok(provisionService(s, bob, "webHosting", { label: "bob.de", spec: sizeSpec("webHosting", 0, 2017), clusterId: host }));
    const mk = (customerId: string, product: "domain" | "dns" | "ssl", label: string) => {
      const base = s.services.find((v) => v.id === (customerId === ada ? a : b))!;
      s.services = [...s.services, { ...base, id: `x${s.nextId++}`, product, label, domain: undefined }];
    };
    mk(ada, "domain", "ada.de"); mk(ada, "dns", "ada.de"); mk(ada, "ssl", "ada.de"); mk(ada, "dns", "other.de"); mk(bob, "ssl", "ada.de");
    const subs = subscriptionsOf(s, host);
    expect(subs.map((x) => x.service.id).sort()).toEqual([a, b].sort());
    expect(subs.find((x) => x.service.id === a)!.domains.map((d) => d.product).sort()).toEqual(["dns", "domain", "ssl"]);
    expect(subs.find((x) => x.service.id === b)!.domains).toEqual([]);
  });
});
