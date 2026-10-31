import { describe, expect, it } from "vitest";
import { sizeSpec } from "../src/sim/10-catalog/products";
import { newGame, type GameState } from "../src/sim/50-state";
import { addressTick, mailAddress } from "../src/sim/60-infra/addresses";
import { bounceFactor, mailsPerBox, mailStateOf, queueEntries } from "../src/sim/60-infra/netsvc-mail";
import { tick } from "../src/sim/88-tick/tick";
import { provisionService } from "../src/sim/90-actions/clusters";
import { addCustomer } from "../src/sim/90-actions/customers";
import { deleteQueue, flushQueue } from "../src/sim/90-actions/netsvc-mail";
import { cleanUp } from "../src/sim/90-actions/security";
import { BASEMENT_SERVER, panelServer, withServer } from "./fixtures";

const run = (s: GameState, hours: number) => { for (let h = 0; h < hours; h++) tick(s); };

function mailHost() {
  const s = withServer(newGame(1));
  const host = panelServer(s, BASEMENT_SERVER);
  const cust = addCustomer(s, "Anna Albers", "private");
  expect(provisionService(s, cust, "webHosting", { label: "a", spec: sizeSpec("webHosting", 0, 2005), clusterId: host }).ok).toBe(true);
  addressTick(s);
  return { s, host, addr: () => mailAddress(s, host)!, cust: () => s.customers.find((c) => c.id === cust)! };
}

describe("mail queue", () => {
  it("fills while the address is listed and drains by half a day once clean", () => {
    const { s, host, addr } = mailHost();
    const boxes = s.services[0].spec.mailboxes, perDay = boxes * mailsPerBox(2005);
    expect(perDay).toBeGreaterThan(0);
    s.security = { ...s.security, hacked: [host] };
    run(s, 24);
    expect(addr().listed).toBe(true);
    const full = mailStateOf(s, addr().id).deferred;
    expect(full).toBeGreaterThanOrEqual(perDay);
    expect(queueEntries(s, addr().id).length).toBe(Math.min(30, full));
    cleanUp(s, host);
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => ({ ...a, listed: false, rep: 100 })) };
    run(s, 24);
    expect(mailStateOf(s, addr().id).deferred).toBe(Math.floor(full / 2));
  });

  it("refuses a flush while listed and empties the queue when clean", () => {
    const { s, addr } = mailHost();
    s.netsvc.mail[addr().id] = { deferred: 500, hit: 0, listings: [] };
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => (a.id === addr().id ? { ...a, listed: true } : a)) };
    expect(flushQueue(s, addr().id)).toEqual({ ok: false, error: "error.mailStillListed" });
    s.ips = { ...s.ips, addresses: s.ips.addresses.map((a) => ({ ...a, listed: false })) };
    expect(flushQueue(s, addr().id).ok).toBe(true);
    expect(mailStateOf(s, addr().id).deferred).toBe(0);
  });

  it("costs the customers happiness when the queue is deleted, once a day", () => {
    const { s, addr, cust } = mailHost();
    s.netsvc.mail[addr().id] = { deferred: 500, hit: 0, listings: [] };
    const before = cust().happiness;
    expect(deleteQueue(s, addr().id).ok).toBe(true);
    expect(cust().happiness).toBe(before - 2);
    expect(mailStateOf(s, addr().id).deferred).toBe(0);
    expect(deleteQueue(s, addr().id)).toEqual({ ok: false, error: "error.queueDeleted" });
    s.hour += 24;
    expect(deleteQueue(s, addr().id).ok).toBe(true);
  });

  it("raises the bounce chance with the queue up to three times", () => {
    const { s, addr } = mailHost();
    expect(bounceFactor(s, addr().id)).toBe(1);
    s.netsvc.mail[addr().id] = { deferred: 1000, hit: 0, listings: [] };
    expect(bounceFactor(s, addr().id)).toBe(1.5);
    s.netsvc.mail[addr().id] = { deferred: 20000, hit: 0, listings: [] };
    expect(bounceFactor(s, addr().id)).toBe(3);
  });
});
