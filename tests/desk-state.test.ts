import { describe, expect, it } from "vitest";
import { hourOf } from "../src/sim/00-core/time";
import { createTicket, deliverMail, type Ticket } from "../src/sim/40-support/tickets";
import { deskReachable, deskStatus } from "../src/sim/40-support/desk";
import type { GameState } from "../src/sim/50-state";
import { companyDomain } from "../src/sim/30-customers/domains";
import { resolve } from "../src/sim/80-business/browser";
import { tick } from "../src/sim/88-tick/tick";
import { addCustomer } from "../src/sim/90-actions/customers";
import { cancel, install } from "../src/sim/90-actions/store";
import { closeTicket } from "../src/sim/90-actions/support";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { newGame, readyGame, registered } from "./fixtures";

const at = (y: number) => hourOf(new Date(Date.UTC(y, 0, 1)));
// A game in the year with a few customer tickets and a company mail.
function withTickets(y: number, seed = 1): GameState {
  const s = registered({ ...newGame(seed), hour: at(y), cash: 1e6 });
  for (let i = 0; i < 3; i++) {
    const id = addCustomer(s, `Customer ${i}`, "private");
    createTicket(s, s.customers.find((c) => c.id === id)!, "howTo");
    s.hour += 1;
  }
  deliverMail(s, "bank", "welcome");
  return s;
}
// A save as written before desk websites existed: no desk, no channels, tickets without desk fields.
function oldSave(s: GameState): string {
  const raw = JSON.parse(serialize(s));
  delete raw.desk;
  raw.mail.channels = [];
  for (const t of raw.tickets) for (const k of ["channelId", "via", "ref", "deptId", "notes"]) delete t[k];
  return JSON.stringify(raw);
}

describe("desk state", () => {
  it("starts a new game without a desk", () => {
    const s = newGame(1);
    expect(s.desk).toBeNull();
    expect(deskStatus(s)).toBe("down");
  });

  it("loads an old save with a Pear Store desk as a legacy desk that has fetched every ticket", () => {
    const s = withTickets(2008);
    s.installed = [...s.installed, "zendusk"];
    const back = deserialize(oldSave(s));
    expect(back.desk).toMatchObject({ id: "zendusk", hosting: { kind: "legacy" }, departments: [{ id: "support", name: "Support", members: [] }] });
    expect(back.mail.channels).toEqual([expect.objectContaining({ accountId: back.mail.primary, desk: "zendusk", after: "keep" })]);
    const ch = back.mail.channels[0].id;
    expect(back.tickets).toHaveLength(s.tickets.length);
    expect(back.tickets.map((t) => [t.channelId, t.deptId, t.via])).toEqual(back.tickets.map(() => [ch, "support", "email"]));
    expect(back.tickets.map((t) => t.ref)).toEqual(["1", "2", "3", "4"]);
    expect(back.desk!.lastRef).toBe(4);
    expect(deskStatus(back)).toBe("up");
    expect(back.installed).toContain("zendusk");
  });

  it("numbers OsTickit tickets with unique random six digits", () => {
    const s = withTickets(2006);
    s.installed = [...s.installed, "ostickit"];
    const refs = deserialize(oldSave(s)).tickets.map((t) => t.ref!);
    expect(refs.every((r) => /^\d{6}$/.test(r))).toBe(true);
    expect(new Set(refs).size).toBe(refs.length);
    expect(deserialize(oldSave(s)).tickets.map((t) => t.ref)).toEqual(refs);
  });

  it("loads an old save without a desk with the ticket defaults", () => {
    const back = deserialize(oldSave(withTickets(2008)));
    expect(back.desk).toBeNull();
    expect(back.mail.channels).toEqual([]);
    for (const t of back.tickets) expect(t).toMatchObject({ channelId: null, via: "email", ref: "", deptId: null, notes: [] });
  });

  it("keeps a saved desk as it is", () => {
    const s = withTickets(2008);
    install(s, "zendusk");
    const back = deserialize(serialize(s));
    expect(back.desk).toEqual(s.desk);
    expect(back.mail.channels).toEqual(s.mail.channels);
  });

  it("sets up and removes the desk with the Pear Store item", () => {
    const s = withTickets(2011);
    expect(install(s, "zendusk")).toEqual({ ok: true });
    expect(s.desk?.id).toBe("zendusk");
    expect(install(s, "freshdusk")).toEqual({ ok: true });
    expect(s.desk?.id).toBe("freshdusk");
    expect(s.mail.channels.map((c) => c.desk)).toEqual(["freshdusk"]);
    expect(cancel(s, "freshdusk")).toEqual({ ok: true });
    expect(s.desk).toBeNull();
    expect(s.mail.channels).toEqual([]);
    expect(s.tickets.every((t) => t.channelId === null)).toBe(true);
  });

  it("follows the web space for a self-hosted desk and is up when hosted", () => {
    const s = readyGame(5);
    const panel = s.clusters.find((c) => c.kind === "panel")!;
    s.desk = { id: "ostickit", hosting: { kind: "self", clusterId: panel.id }, tenant: null, departments: [], rules: [], addons: {}, lastRef: 0 };
    expect(deskStatus(s)).not.toBe("down");
    s.desk = { ...s.desk, hosting: { kind: "self", clusterId: "gone" } };
    expect(deskStatus(s)).toBe("down");
    const imported = { channelId: "ch1" } as Ticket, mailbox = { channelId: null } as Ticket;
    expect([deskReachable(s, imported), deskReachable(s, mailbox)]).toEqual([false, true]);
    s.desk = { ...s.desk, id: "zendusk", hosting: { kind: "hosted" }, tenant: "pxl" };
    expect(deskStatus(s)).toBe("up");
    expect(deskReachable(s, imported)).toBe(true);
  });

  it("charges no wait for mail and spam tickets and closes them without a customer", () => {
    const s = withTickets(2008);
    const spam = { ...deliverMail(s, "junk", "offer"), kind: "spam" as const, status: "open" as const, dueAt: s.hour - 10 };
    const mail = { ...deliverMail(s, "info", "question"), status: "open" as const, dueAt: s.hour - 10 };
    s.tickets = [...s.tickets.slice(0, -2), spam, mail];
    for (let i = 0; i < 5; i++) tick(s);
    expect(closeTicket(s, spam.id)).toEqual({ ok: true, id: spam.id });
    expect(closeTicket(s, mail.id)).toEqual({ ok: true, id: mail.id });
    expect(s.tickets.find((t) => t.id === spam.id)?.status).toBe("closed");
  });

  it("finds nothing at the support address", () => {
    const s = withTickets(2008);
    expect(resolve(s, `support.${companyDomain(s)}`).page).toEqual({ kind: "notfound" });
    install(s, "zendusk");
    expect(resolve(s, `support.${companyDomain(s)}`).page).toEqual({ kind: "notfound" });
  });
});
