import { describe, expect, it } from "vitest";
import type { Product } from "../src/sim/30-customers/customers";
import { fqdn } from "../src/sim/30-customers/domains";
import { HOST_PREFIX } from "../src/sim/30-customers/hostnames";
import { createTicket } from "../src/sim/40-support/tickets";
import { subjectParams } from "../src/sim/40-support/notices";
import { newGame } from "../src/sim/50-state";
import { addCustomer, addService } from "../src/sim/90-actions/customers";
import { createVm, provisionService } from "../src/sim/90-actions/clusters";
import { buyDevice } from "../src/sim/90-actions/hardware";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { t } from "../src/i18n/en";
import { readyGame } from "./fixtures";

const PRODUCTS: Product[] = ["webHosting", "domain", "ssl", "dns", "gameServer", "vps", "vpn", "dedicated", "storage", "cloud", "colocation"];
const SIZE = { vcpu: 1, ramGb: 1, diskGb: 10 };

describe("hostnames", () => {
  it("numbers servers by purchase order", () => {
    const s = readyGame(1);
    s.cash = 1e6;
    buyDevice(s, "g1-compute", "Dwell", 2, "loc1");
    buyDevice(s, "g1-compute", "Dwell", 1, "loc1");
    expect(s.devices.filter((d) => d.hostname).map((d) => d.hostname)).toEqual(["node001", "node002", "node003", "node004"]);
    expect(s.devices.find((d) => d.id === "dev5")!.hostname).toBeUndefined();
    expect(s.nextNode).toBe(5);
  });

  it("numbers own VMs in order and gives customer workloads their service hostname", () => {
    const s = readyGame(2);
    const cluster = s.clusters.find((c) => c.kind === "cloud")!;
    expect(createVm(s, cluster.id, SIZE).ok).toBe(true);
    expect(createVm(s, cluster.id, SIZE).ok).toBe(true);
    expect(s.workloads.filter((w) => !w.serviceId).map((w) => w.hostname)).toEqual(["vm001", "vm002", "vm003"]);
    const r = provisionService(s, addCustomer(s, "Test", "private"), "vps", { label: "vps" });
    if (!r.ok) throw new Error(r.error);
    const v = s.services.find((x) => x.id === r.id)!;
    expect(s.workloads.find((w) => w.serviceId === v.id)!.hostname).toBe(v.hostname);
  });

  it("prefixes service hostnames by product and gives domain and SSL none", () => {
    const s = newGame(3);
    const cus = addCustomer(s, "Test", "private");
    for (const p of PRODUCTS) {
      const id = addService(s, cus, p, p, 1, "hour");
      const v = s.services.find((x) => x.id === id)!;
      if (p === "domain" || p === "ssl") expect(v.hostname).toBeUndefined();
      else expect(v.hostname).toMatch(new RegExp(`^${HOST_PREFIX[p]}\\d{8}$`));
    }
    expect(Object.keys(HOST_PREFIX).sort()).toEqual(PRODUCTS.filter((p) => p !== "domain" && p !== "ssl").sort());
  });

  it("draws unique numbers from the seeded start, growing by 1 to 97", () => {
    for (const seed of [1, 2, 99]) {
      const s = newGame(seed);
      expect(s.nextHostNo).toBeGreaterThanOrEqual(10_000_000);
      expect(s.nextHostNo).toBeLessThan(20_000_000);
      const cus = addCustomer(s, "Test", "private");
      for (let i = 0; i < 300; i++) addService(s, cus, "vps", "v", 1, "hour");
      const nums = s.services.map((v) => Number(v.hostname!.slice(3)));
      expect(new Set(nums).size).toBe(300);
      for (let i = 1; i < nums.length; i++) {
        expect(nums[i] - nums[i - 1]).toBeGreaterThanOrEqual(1);
        expect(nums[i] - nums[i - 1]).toBeLessThanOrEqual(97);
      }
    }
    expect(newGame(1).nextHostNo).not.toBe(newGame(2).nextHostNo);
  });

  it("leaves the game's random stream alone", () => {
    const a = newGame(5), b = newGame(5);
    addService(a, addCustomer(a, "T", "private"), "vps", "v", 1, "hour");
    addService(b, addCustomer(b, "T", "private"), "domain", "d", 1, "year");
    expect(a.rng).toEqual(b.rng);
  });

  it("numbers everything in an old save", () => {
    const s = readyGame(4);
    s.cash = 1e6;
    s.hour = 100;
    buyDevice(s, "g1-compute", "Dwell", 1, "loc1");
    const cus = addCustomer(s, "Test", "private");
    provisionService(s, cus, "vps", { label: "vps" });
    provisionService(s, cus, "webHosting", { label: "site.de" });
    addService(s, cus, "domain", "d", 1, "year");
    const raw = JSON.parse(serialize(s));
    for (const list of [raw.devices, raw.services, raw.workloads]) for (const x of list) delete x.hostname;
    delete raw.nextNode;
    delete raw.nextVm;
    delete raw.nextHostNo;
    // The bought server is older than the first one in this save, so it numbers first.
    raw.devices.find((d: { boughtAt: number }) => d.boughtAt === 100).boughtAt = -1;
    const old = deserialize(JSON.stringify(raw));
    const servers = old.devices.filter((d) => d.hostname).sort((a, b) => a.hostname!.localeCompare(b.hostname!));
    expect(servers.map((d) => d.boughtAt)).toEqual([-1, 0]);
    const hosted = old.services.filter((v) => v.product !== "domain");
    expect(hosted.length).toBeGreaterThan(2);
    expect(hosted.every((v) => /^[a-z]+\d{8}$/.test(v.hostname!))).toBe(true);
    expect(old.services.find((v) => v.product === "domain")!.hostname).toBeUndefined();
    expect(old.workloads.every((w) => w.hostname)).toBe(true);
    for (const w of old.workloads.filter((x) => x.serviceId)) expect(w.hostname).toBe(old.services.find((v) => v.id === w.serviceId)!.hostname);
    expect(old.workloads.filter((w) => !w.serviceId).map((w) => w.hostname)).toEqual(["vm001"]);
    expect(old.nextNode).toBe(3);
    expect(deserialize(serialize(old))).toEqual(old);
  });

  it("names the service in ticket texts", () => {
    const s = readyGame(6);
    const cus = addCustomer(s, "Jonas Weber", "private");
    addService(s, cus, "vps", "VPS 512", 1, "hour");
    const v = s.services.at(-1)!;
    const tk = createTicket(s, s.customers.find((c) => c.id === cus)!, "outage", v.id);
    tk.topic = "slow";
    const full = fqdn(s, v.hostname!);
    expect(full).toMatch(/^vps\d{8}\./);
    expect(t("ticket.outage.slow.text", subjectParams(s, tk))).toContain(full);
  });
});
