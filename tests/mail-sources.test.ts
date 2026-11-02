import { describe, expect, it } from "vitest";
import { deliveryTrace } from "../src/sim/42-mail/deliver";
import { boxOf } from "../src/sim/42-mail/model";
import { defaultMailTo, deliverMail, ownAddresses } from "../src/sim/42-mail/sources";
import type { GameState } from "../src/sim/50-state";
import { bankTick, send } from "../src/sim/46-finance/bank";
import { supplierIban } from "../src/sim/46-finance/payables";
import { deliverPaidOrders, ORDER, orderKeys } from "../src/sim/80-business/vendor-shop";
import { renewKeys } from "../src/sim/85-products/products";
import { createMailAccount, deleteMailAccount } from "../src/sim/90-actions/mailbox";
import { addToCart, checkout } from "../src/sim/90-actions/vendor-shop";
import { deserialize, serialize } from "../src/sim/91-save/save";
import { STARTER_APPS } from "../src/sim/10-catalog/store";
import { idOf } from "./company-mail.helpers";
import { mailsAbout, newGame, orderDetails, readyGame, withCard } from "./fixtures";

const PLESKIT = "pleskit.com";
const owner = (s: GameState) => s.mail.accounts.find((a) => a.id === s.mail.primary)!;
const info = (s: GameState) => {
  const r = createMailAccount(s, { tenant: owner(s).tenant, local: "info", title: "Info", password: "secret1" });
  expect(r.ok).toBe(true);
  return s.mail.accounts.find((a) => a.id === idOf(r))!;
};
const game = () => withCard(Object.assign(readyGame(4), { cash: 10_000 }));

describe("mail sources", () => {
  it("sends a source's mail to its contact, fixed on first use, and other system mail to the owner", () => {
    const s = game(), first = owner(s);
    deliverMail(s, "Sparklasse", "bankWelcome", { bank: "Sparklasse" }, { source: "bank" });
    expect(s.mail.contacts.bank).toBe(first.id);
    expect(mailsAbout(s, "bankWelcome").map((m) => [m.to, m.kind])).toEqual([[`${first.local}@${first.domain}`, "bank"]]);
    const box = info(s);
    s.mail = { ...s.mail, contacts: { ...s.mail.contacts, bank: box.id } };
    deliverMail(s, "Sparklasse", "bankCard", { bank: "Sparklasse" }, { source: "bank" });
    expect(boxOf(s, box.id).filter((m) => m.kind === "bank").map((m) => m.topic)).toEqual(["bankCard"]);
    deliverMail(s, "Equinox", "priceRaise", { percent: 3, year: 2006 });
    expect(mailsAbout(s, "priceRaise")[0]).toMatchObject({ to: `${first.local}@${first.domain}`, kind: "system", from: "n:Equinox" });
    expect(s.mail.contacts[""]).toBeUndefined();
  });

  it("mails a checkout's keys to the address picked, which must be an own mailbox, and renewals follow it", () => {
    const s = game(), box = info(s), address = `info@${box.domain}`;
    expect(defaultMailTo(s)).toBe(address);
    expect(ownAddresses(s)).toContain(address);
    expect(addToCart(s, "pleskit", "webAdmin").ok).toBe(true);
    expect(checkout(s, PLESKIT, { ...orderDetails(s, "card"), email: "someone@example.com" })).toEqual({ ok: false, error: "error.mailTo" });
    const r = checkout(s, PLESKIT, orderDetails(s, "card")), order = idOf(r);
    expect(boxOf(s, box.id).filter((m) => m.topic === ORDER)).toMatchObject([{ to: address, kind: "licence", att: [{ k: "key", order }] }]);
    const k = orderKeys(s, order)[0];
    expect(k.mailTo).toBe(address);
    s.hour = k.renewsAt!;
    renewKeys(s);
    expect(boxOf(s, box.id).map((m) => m.topic)).toContain("licenceRenewed");
  });

  it("bounces the order email of a paid transfer to a deleted address and keeps the keys in My account", () => {
    const s = game(), box = info(s);
    addToCart(s, "pleskit", "webAdmin");
    const order = idOf(checkout(s, PLESKIT, { ...orderDetails(s, "transfer"), email: `info@${box.domain}` }));
    const p = s.payables.at(-1)!;
    expect(p.keys?.mailTo).toBe(`info@${box.domain}`);
    expect(deleteMailAccount(s, box.id).ok).toBe(true);
    s.hour = send(s, { name: "Pleskit", account: supplierIban("software"), amount: p.amount, reference: p.number }).arriveAt;
    bankTick(s);
    deliverPaidOrders(s);
    expect(orderKeys(s, order)).toHaveLength(1);
    expect(mailsAbout(s, ORDER)).toEqual([]);
    expect(deliveryTrace(s, { address: `info@${box.domain}`, result: "bounced" }).map((e) => e.topic)).toContain(ORDER);
  });

  it("moves an old save's company emails from tickets into the primary mailbox", () => {
    const s = readyGame(5), raw = JSON.parse(serialize(s));
    raw.tickets = [...raw.tickets,
      { id: "tkt9001", customerId: "", serviceId: null, kind: "mail", topic: "bankWelcome", status: "closed", createdAt: 10, dueAt: 10, updatedAt: 10, unread: false, replies: [], outcome: null, work: null, assignee: null, mail: { from: "Sparklasse", params: { bank: "Sparklasse", number: "123", pin: "4711" } } },
      { id: "tkt9002", customerId: "", serviceId: null, kind: "mail", topic: ORDER, status: "closed", createdAt: 11, dueAt: 11, updatedAt: 11, unread: true, replies: [], outcome: null, work: null, assignee: null, mail: { from: "Pleskit", params: { order: "ORD-1", total: 5, card: 1 } } },
    ];
    raw.licenses = [...(raw.licenses ?? []), { id: "lic1", product: "pleskit", edition: "webAdmin", kind: "term", key: "K", orderId: "ORD-1", boughtAt: 11, machineId: null, covers: { kind: "term", until: 99 }, renewsAt: 99, lapsedAt: null }];
    const back = deserialize(JSON.stringify(raw)), primary = owner(back);
    expect(back.tickets.some((t) => t.kind === "mail")).toBe(false);
    expect(boxOf(back, primary.id).slice(0, 2)).toMatchObject([
      { topic: "bankWelcome", from: "n:Sparklasse", at: 600, read: true, p: { pin: "4711" } },
      { topic: ORDER, at: 660, att: [{ k: "key", order: "ORD-1" }] },
    ]);
    expect(back.licenses[0].mailTo).toBeUndefined();
    expect(deserialize(serialize(back)).tickets.length).toBe(back.tickets.length);
  });

  it("docks Pear Mail in place of Support from the start", () => {
    expect(STARTER_APPS).toContain("Pear Mail");
    expect(STARTER_APPS).not.toContain("Support");
    expect(newGame(1).installed).not.toContain("Support");
  });
});
