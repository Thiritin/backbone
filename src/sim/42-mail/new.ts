// Company email: the state of a new game and the records the sim creates (docs/design/plans/mail-core.md).
import { hashRng, rand } from "../00-core/rng";
import { ascii } from "../30-customers/domains";
import type { MailAccount, MailState, MailTenant, Message } from "./types";

export const GMIX_DOMAIN = "gmix.com";

const PASSWORD_CHARS = "abcdefghjkmnpqrstuvwxyz23456789";
// Eight characters fixed by the seed parts, for mailboxes the sim creates.
export function seededPassword(...xs: number[]): string {
  const r = hashRng(...xs, 4217);
  return Array.from({ length: 8 }, () => PASSWORD_CHARS[Math.floor(rand(r) * PASSWORD_CHARS.length)]).join("");
}

export const gmixLocal = (companyName: string): string => ascii(companyName) || "hosting";

export const emptyMail = (): MailState => ({
  tenants: [], accounts: [], primary: "", catchAll: null, contacts: {}, folders: [], msgs: {}, filters: [], queue: [],
  channels: [], groups: [], snoozed: [], fetch: [], trace: [], retired: [], seen: 0,
});

export const newAccount = (id: string, tenant: MailTenant, local: string, title: string, password: string, at: number): MailAccount => ({
  id, tenant: tenant.id, local, domain: tenant.domain, title, password, reset: null, employee: null, roles: [], aliases: [],
  quotaMb: null, usedKb: 0, older: { n: 0, kb: 0 }, forward: null, vacation: null, trained: 0, junkCaught: 0, dropped: 0, createdAt: at, closedAt: null,
  ...(tenant.host === "gmix" && { external: false }),
});

// The provider's welcome in a new mailbox's Inbox, which states the address and the password.
export const welcome = (id: string, a: MailAccount, provider: string, at: number): Message => ({
  id, thread: id, folder: "inbox", from: `n:${provider}`, to: `${a.local}@${a.domain}`, kind: "system", topic: "mailWelcome",
  p: { address: `${a.local}@${a.domain}`, password: a.password, provider }, at, kb: 3,
});

// One mail service with its primary mailbox holding every role, and the welcome in its Inbox.
export function startMail(tenant: MailTenant, local: string, title: string, password: string, provider: string, at: number): MailState {
  const a: MailAccount = { ...newAccount("mb1", tenant, local, title, password, at), roles: ["owner", "sales", "support", "abuse"] };
  const w = welcome("msg1", a, provider, at * 60);
  return { ...emptyMail(), tenants: [{ ...tenant, admin: a.id }], accounts: [{ ...a, usedKb: w.kb }], primary: a.id, msgs: { [a.id]: [w] } };
}

// A new game: one free GMix tenant and the box `<company>@gmix.com`.
export const newMail = (seed: number, companyName: string): MailState =>
  startMail({ id: "tn1", host: "gmix", domain: GMIX_DOMAIN, plan: "free", since: 0, verified: true, endsAt: null, admin: null },
    gmixLocal(companyName), companyName, seededPassword(seed, 1), "GMix", 0);

