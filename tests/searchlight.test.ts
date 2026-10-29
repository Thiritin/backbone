import { describe, expect, it } from "vitest";
import { isAvailable } from "../src/sim/10-catalog/research";
import { storeItem, subscriptionPrice } from "../src/sim/10-catalog/store";
import { install } from "../src/sim/90-actions/store";
import { createVm } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { createTicket } from "../src/sim/40-support/tickets";
import { t } from "../src/i18n/en";
import { subjectParams } from "../src/sim/40-support/notices";
import { fqdn } from "../src/sim/30-customers/domains";
import { rank } from "../src/ui/search/rank";
import { search, PER_GROUP, TOTAL } from "../src/ui/search/hits";
import { readyGame } from "./fixtures";

const item = (key: string, recent?: number) => ({ keys: [key], recent });

describe("rank", () => {
  it("puts a prefix before a word prefix before a substring", () => {
    const out = rank("web", [item("a-webhost"), item("xxwebxx"), item("web01"), item("the web box")]);
    expect(out.map((x) => x.keys[0])).toEqual(["web01", "a-webhost", "the web box", "xxwebxx"]);
  });

  it("breaks ties by the more recent first and keeps equal items in order", () => {
    const out = rank("node", [item("node001", 1), item("node003", 9), item("node002", 5), item("node004")]);
    expect(out.map((x) => x.keys[0])).toEqual(["node003", "node002", "node001", "node004"]);
  });

  it("uses the best of an item's keys and ignores case and surrounding space", () => {
    const out = rank("  VM0 ", [{ keys: ["Mail box", "vm001"] }, { keys: ["Other"] }]);
    expect(out).toHaveLength(1);
    expect(rank("", [item("a")])).toEqual([]);
    expect(rank("zzz", [item("a")])).toEqual([]);
  });
});

describe("Searchlight in the store", () => {
  it("is an upgrade that needs no skill and costs 2 a month in 2005", () => {
    const it = storeItem("searchlight")!;
    expect(it.kind).toBe("upgrade");
    expect(isAvailable("searchlight", [])).toBe(true);
    expect(subscriptionPrice(it, 2005)).toBe(2);
    const s = readyGame(1);
    s.cash = 100;
    expect(install(s, "searchlight")).toEqual({ ok: true });
    expect(s.installed).toContain("searchlight");
  });
});

describe("search", () => {
  it("finds machines, customers and sites and opens them in their apps", () => {
    const s = readyGame(3);
    s.installed.push("Virtual machines");
    s.company.domain = "example.test";
    expect(createVm(s, s.clusters.find((c) => c.kind === "cloud")!.id, { vcpu: 1, ramGb: 1, diskGb: 10 }).ok).toBe(true);
    const cus = addCustomer(s, "Zelda Flowers", "private");
    const tk = createTicket(s, s.customers.find((c) => c.id === cus)!, "howTo", null, "email");

    const vm = search(s, "vm001").find((h) => h.group === "Machines")!;
    expect(vm).toMatchObject({ app: "Virtual machines", target: { kind: "workload" } });
    expect(search(s, "node001").find((h) => h.group === "Machines")).toMatchObject({ app: "Locations", target: { kind: "device" } });
    expect(search(s, "zelda")[0]).toMatchObject({ group: "Customers", app: "Customers", target: { kind: "customer", id: cus } });
    expect(search(s, fqdn(s, "vm001")).find((h) => h.group === "Sites and consoles")).toMatchObject({ app: "Browser", target: { kind: "url", id: fqdn(s, "vm001") } });
    expect(search(s, "admin").find((h) => h.group === "Sites and consoles")!.target!.id).toMatch(/\/admin$/);
    expect(search(s, "notif")[0]).toMatchObject({ group: "Settings", app: "Settings" });
    expect(search(s, t(`ticket.${tk.kind}.${tk.topic}.subject`, subjectParams(s, tk))).find((h) => h.group === "Tickets")).toMatchObject({ app: "Support", target: { kind: "ticket", id: tk.id } });
    expect(search(s, "")).toEqual([]);
  });

  it("hides apps that are not installed and caps groups and the total", () => {
    const s = readyGame(4);
    expect(search(s, "marketing")).toEqual([]);
    for (let i = 0; i < 40; i++) addCustomer(s, `Cust ${i}`, "private");
    const hits = search(s, "c");
    expect(hits.filter((h) => h.group === "Customers").length).toBeLessThanOrEqual(PER_GROUP);
    expect(hits.length).toBeLessThanOrEqual(TOTAL);
  });
});
