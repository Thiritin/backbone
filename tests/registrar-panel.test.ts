import { describe, expect, it } from "vitest";
import { DAY, domainOf, domainStatus, heldDomains, register, YEAR } from "../src/sim/30-customers/registry";
import { monthlyDomains, REFUSE_PENALTY, wholesale } from "../src/sim/30-customers/registrar";
import { cancelCustomer, createTicket } from "../src/sim/40-support/tickets";
import type { GameState } from "../src/sim/50-state";
import { tick } from "../src/sim/88-tick/tick";
import { answerDomainTransfer, generateAuthCode, setDomainRenewal, signRegistrar, transferDomains } from "../src/sim/90-actions/registrar";
import { readyGame } from "./fixtures";

const runTo = (s: GameState, hour: number) => { while (s.hour < hour) tick(s); };
// A day boundary shortly before the hour, so the daily domain check runs before it.
const before = (hour: number, days: number) => hour - days * DAY - (hour % DAY);
const customer = (s: GameState, id: string) => s.customers.find((c) => c.id === id)!;

function withDomain(seed: number, name = "kunde.de") {
  const s = readyGame(seed), c = s.customers[0];
  register(s, name, c.id, false);
  return { s, c, d: () => domainOf(s, name)! };
}

describe("registrar panel", () => {
  it("renews a domain at the partner after its customer left and keeps billing it", () => {
    const { s, c, d } = withDomain(3);
    cancelCustomer(s, c);
    const expiry = d().expiresAt, billed = () => s.invoices.filter((i) => i.customerId === c.id).length, invoices = billed();
    s.hour = before(expiry, 2);
    runTo(s, expiry + DAY);
    expect(domainStatus(d())).toBe("active");
    expect(d().expiresAt).toBe(expiry + YEAR);
    expect(billed()).toBe(invoices);
    const company = s.company.domain!;
    expect(monthlyDomains(s)).toBeCloseTo((wholesale(s, company) + wholesale(s, "kunde.de")) / 12, 1);
  });

  it("lapses a cancelled domain at expiry and stops billing it", () => {
    const { s, d } = withDomain(4);
    expect(setDomainRenewal(s, "kunde.de", false).ok).toBe(true);
    expect(domainStatus(d())).toBe("cancelled");
    const expiry = d().expiresAt;
    s.hour = before(expiry, 2);
    runTo(s, expiry + DAY);
    expect(domainStatus(d())).toBe("gone");
    expect(d().expiresAt).toBe(expiry);
    expect(heldDomains(s).map((x) => x.name)).not.toContain("kunde.de");
    expect(setDomainRenewal(s, "kunde.de", true).ok).toBe(false);
  });

  it("opens a transfer request when a customer leaves, resolves it with the auth code and lets the domain go", () => {
    const s = readyGame(5), c = s.customers[0];
    const names = Array.from({ length: 8 }, (_, i) => `kunde${i}.de`);
    for (const n of names) register(s, n, c.id, false);
    cancelCustomer(s, c);
    runTo(s, s.hour + DAY + 1);
    const asks = s.tickets.filter((t) => t.topic === "domainOut" && t.customerId === c.id);
    expect(asks.length).toBeGreaterThan(0);
    expect(asks.every((t) => t.dueAt === t.createdAt + 3 * DAY)).toBe(true);
    const t = asks[0], name = t.domain!;
    expect(answerDomainTransfer(s, t.id, "WRONGCODE")).toMatchObject({ ok: false, error: "error.authCode" });
    expect(generateAuthCode(s, name).ok).toBe(true);
    const code = domainOf(s, name)!.code!;
    expect(answerDomainTransfer(s, t.id, code.toLowerCase()).ok).toBe(true);
    runTo(s, s.hour + 2);
    const done = s.tickets.find((x) => x.id === t.id)!;
    expect(done).toMatchObject({ status: "resolved", outcome: "complied" });
    expect(done.replies.at(-1)!.params).toMatchObject({ domain: name, code });
    expect(domainStatus(domainOf(s, name)!)).toBe("transfer");
    runTo(s, s.hour + 3 * DAY);
    expect(domainStatus(domainOf(s, name)!)).toBe("gone");
    expect(heldDomains(s).map((x) => x.name)).not.toContain(name);
  });

  it("charges happiness for a transfer request left waiting and more for a refusal", () => {
    const { s, c } = withDomain(6);
    const waiting = createTicket(s, c, "billing", null, "domainOut");
    Object.assign(waiting, { domain: "kunde.de", dueAt: s.hour + 3 * DAY });
    const start = c.happiness;
    runTo(s, s.hour + 3 * DAY);
    expect(customer(s, c.id).happiness).toBe(start);
    runTo(s, s.hour + 2 * DAY);
    const waited = customer(s, c.id).happiness;
    expect(waited).toBeLessThan(start);
    expect(answerDomainTransfer(s, waiting.id, null).ok).toBe(true);
    runTo(s, s.hour + 2);
    expect(s.tickets.find((x) => x.id === waiting.id)).toMatchObject({ status: "resolved", outcome: "domainKept" });
    expect(customer(s, c.id).happiness).toBeLessThanOrEqual(waited - REFUSE_PENALTY);
  });

  it("books a year at the new partner for every moved domain and shifts its expiry", () => {
    const { s, d } = withDomain(7);
    const company = s.company.domain!, was = [d().expiresAt, domainOf(s, company)!.expiresAt];
    s.cash = 1e5;
    expect(signRegistrar(s, "goDuddy").ok).toBe(true);
    expect(transferDomains(s).ok).toBe(true);
    const ledger = s.ledger.length, payables = s.payables.length;
    runTo(s, s.registrar!.transfer!.doneAt! + 1);
    expect(s.registrar!.transfer).toBeNull();
    expect([d().expiresAt, domainOf(s, company)!.expiresAt]).toEqual(was.map((x) => x + YEAR));
    const lines = [...s.ledger.slice(ledger), ...s.payables.slice(payables).flatMap((p) => p.lines)].filter((e) => e.key === "ledger.domainsMoved");
    expect(lines).toHaveLength(1);
    expect(lines[0].amount).toBeCloseTo(-(wholesale(s, "kunde.de") + wholesale(s, company)), 2);
  });
});
