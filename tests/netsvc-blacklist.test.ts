import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { type GameState } from "../src/sim/50-state";
import { addressTick, mailAddress } from "../src/sim/60-infra/addresses";
import { delistHours, mailStateOf, spamSenders } from "../src/sim/60-infra/netsvc-mail";
import { provisionService } from "../src/sim/90-actions/clusters";
import { requestDelist } from "../src/sim/90-actions/addresses";
import { addCustomer, suspendCustomer } from "../src/sim/90-actions/customers";
import { setMailRelay } from "../src/sim/90-actions/netsvc-mail";
import { BASEMENT_SERVER, panelServer, withServer, newGame } from "./fixtures";

// One daily run of the address upkeep.
const day = (s: GameState) => { s.hour = (Math.floor(s.hour / 24) + 1) * 24; addressTick(s); };

function shadyHost() {
  const s = withServer(newGame(1));
  const host = panelServer(s, BASEMENT_SERVER);
  const anna = addCustomer(s, "Anna Albers", "private"), mal = addCustomer(s, "Mal Ware", "private");
  s.customers = s.customers.map((c) => ({ ...c, happiness: 80, shady: c.id === mal ? true : c.shady }));
  for (const [cust, label] of [[anna, "a"], [mal, "m"]] as const) provisionService(s, cust, "webHosting", { label, spec: sizeSpec("webHosting", 0, 2005), clusterId: host });
  addressTick(s);
  const addr = () => mailAddress(s, host)!;
  s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.id === addr().id ? { ...a, rep: 35 } : a)) };
  return { s, host, anna, mal, addr, happy: (id: string) => s.customers.find((c) => c.id === id)!.happiness };
}

describe("blacklist incident", () => {
  it("lists the address, costs 3 then 1 a day capped at 10 and names the sender", () => {
    const { s, anna, mal, addr, happy } = shadyHost();
    expect(spamSenders(s, addr().id).map((x) => x.customerId)).toEqual([mal]);
    day(s);
    expect(addr().listed).toBe(true);
    expect(happy(anna)).toBe(77);
    day(s);
    expect(happy(anna)).toBe(76);
    for (let i = 0; i < 12; i++) day(s);
    expect(happy(anna)).toBe(70);
    expect(mailStateOf(s, addr().id).hit).toBe(10);
  });

  it("stops the spam when the sender is suspended, so a delisting request works", () => {
    const { s, mal, addr } = shadyHost();
    day(s);
    expect(requestDelist(s, addr().id)).toEqual({ ok: false, error: "error.stillSpamming" });
    expect(suspendCustomer(s, mal, true).ok).toBe(true);
    expect(spamSenders(s, addr().id)).toEqual([]);
    day(s);
    expect(requestDelist(s, addr().id).ok).toBe(true);
    expect(addr().delistAt).toBe(s.hour + 24);
  });

  it("makes a second listing within 30 days wait 48 hours", () => {
    const { s, mal, addr } = shadyHost();
    day(s);
    suspendCustomer(s, mal, true);
    day(s);
    expect(delistHours(s, addr().id)).toBe(24);
    requestDelist(s, addr().id);
    day(s);
    day(s);
    expect(addr().listed).toBe(false);
    expect(mailStateOf(s, addr().id).hit).toBe(0);
    suspendCustomer(s, mal, false);
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.id === addr().id ? { ...a, rep: 35 } : a)) };
    day(s);
    expect(addr().listed).toBe(true);
    expect(delistHours(s, addr().id)).toBe(48);
  });
});

describe("mail relay", () => {
  it("moves a panel host's customers to the mail server's address and back", () => {
    const { s, host, anna, addr, happy } = shadyHost();
    const own = addr().id;
    const mx = { ...s.clusters.find((c) => c.id === host)!, id: "mx1", kind: "mail" as const, vm: undefined, nodes: [{ deviceId: "mxbox" }] } as never;
    s.clusters = [...s.clusters, mx];
    s.ips = { ...s.ips, addresses: [...s.ips.addresses, { id: "ipmx", ip: "78.0.0.9", v: 4, locationId: "x", holder: "mxbox", source: "provider", blockId: null, rep: 20, listed: false, spam: 0, delistAt: null }] };
    expect(setMailRelay(s, host, "nope")).toEqual({ ok: false, error: "error.unknownCluster" });
    expect(setMailRelay(s, host, "mx1").ok).toBe(true);
    expect(addr().id).toBe("ipmx");
    day(s);
    expect(mailAddress(s, "mx1")!.listed).toBe(true);
    expect(happy(anna)).toBe(77);
    expect(setMailRelay(s, host, null).ok).toBe(true);
    expect(addr().id).toBe(own);
  });

  it("keeps no relay on a fresh game", () => {
    expect(newGame(1).netsvc.relay).toEqual({});
  });
});
