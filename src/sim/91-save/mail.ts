import type { GameState } from "../50-state";
import { companyDomain } from "../30-customers/domains";
import { PROVIDER_HOSTS, providerById } from "../80-business/mail";
import { canAddMailbox, employeeMailbox } from "../42-mail/accounts";
import { emptyMail, gmixLocal, GMIX_DOMAIN, seededPassword, startMail } from "../42-mail/new";
import type { Attachment, MailState, MailTenant, Message } from "../42-mail/types";
import { kbOf, retain } from "../42-mail/deliver";
import { yearOf } from "../00-core/time";
import { ORDER } from "../80-business/vendor-shop";
import { mxSetAt } from "../10-catalog/mail-providers";
import type { CompanyRecord } from "../60-infra/company-zone";

// Goggle edition ids before the provider terms.
const GOGGLE_PLANS: Record<string, string> = { standard: "free", premier: "paid" };
const SOFTWARE_NAMES = { postfixit: "Postfixit", mailpig: "Mailpig" };

// Saves from before mailboxes get a tenant for their mail service and a primary mailbox on the sales address.
export function fillMail(s: GameState, saved: Partial<MailState> | undefined, zoneSaved: boolean): void {
  if (saved) {
    s.mail = { ...emptyMail(), ...saved };
    s.mail.tenants = s.mail.tenants.map((t) => (t.host === "goggle" && GOGGLE_PLANS[t.plan] ? { ...t, plan: GOGGLE_PLANS[t.plan] } : t));
  }
  else legacyMail(s);
  if (!zoneSaved) fillMx(s);
  fillStaffBoxes(s);
  mailTickets(s);
}

// Company emails from before mailboxes were closed tickets of kind mail; each becomes a message in the primary mailbox.
// A mail ticket a desk made from a message stays.
function mailTickets(s: GameState): void {
  const old = s.tickets.filter((x) => x.kind === "mail" && x.mail && !x.mail.msg), a = s.mail.accounts.find((x) => x.id === s.mail.primary);
  if (!old.length || !a) return;
  const to = `${a.local}@${a.domain}`;
  const msgs = old.map((x): Message => {
    const p = x.mail!.params, id = `msg${s.nextId++}`;
    const att: Attachment[] = p.payable !== undefined ? [{ k: "invoice", id: String(p.payable) }] : x.topic === ORDER ? [{ k: "key", order: String(p.order) }] : [];
    return {
      id, thread: id, folder: "inbox", from: `n:${x.mail!.from}`, to, kind: "system", topic: x.topic, p, ...(att.length && { att }),
      at: x.createdAt * 60, kb: kbOf("system", yearOf(x.createdAt), att), ...(!x.unread && { read: true as const }),
    };
  });
  const kb = msgs.reduce((n, m) => n + m.kb, 0);
  s.tickets = s.tickets.filter((x) => !old.includes(x));
  s.mail = { ...s.mail, msgs: { ...s.mail.msgs, [a.id]: [...msgs, ...(s.mail.msgs[a.id] ?? [])] }, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, usedKb: x.usedKb + kb } : x)) };
  retain(s, a.id);
}

// Employees from before employee mailboxes get one on the company-domain tenant, so the bill keeps its seats.
function fillStaffBoxes(s: GameState): void {
  const t = s.mail.tenants.find((x) => x.domain === companyDomain(s) && x.endsAt === null);
  if (!s.company.domain || !t) return;
  for (const e of s.staff) if (!s.mail.accounts.some((a) => a.employee === e.id) && canAddMailbox(s, t)) employeeMailbox(s, t, e.id, e.name);
}

// Saves from before the company zone point its MX at the mail tenant on the company domain, live at once.
function fillMx(s: GameState): void {
  const d = companyDomain(s), t = s.mail.tenants.find((x) => x.domain === d && x.endsAt === null);
  if (!s.company.domain || !t) return;
  const mx = mxSetAt(t.host, d, s.hour).map(([p, h]): CompanyRecord => ({ id: `z${s.nextId++}`, type: "MX", name: "@", ttl: 3600, data: `${p} ${h}` }));
  s.company = { ...s.company, zone: [...s.company.zone, ...mx] };
}

function legacyMail(s: GameState): void {
  const m = s.company.mail, pw = seededPassword(s.seed, 1), name = s.company.name;
  const tenant = (host: string, domain: string, plan: string, extra: Partial<MailTenant> = {}): MailTenant =>
    ({ id: "tn1", host, domain, plan, since: s.hour, verified: true, endsAt: null, admin: null, ...extra });
  if (m.kind === "free") s.mail = startMail(tenant("gmix", GMIX_DOMAIN, "free"), gmixLocal(name), name, pw, "GMix", s.hour);
  else if (m.kind === "external") {
    const [host, plan] = PROVIDER_HOSTS[m.provider];
    s.mail = startMail(tenant(host, companyDomain(s), plan), "sales", name, pw, providerById(m.provider)!.name, s.hour);
  } else s.mail = startMail(tenant("self", companyDomain(s), "self", { clusterId: m.clusterId }), "sales", name, pw, SOFTWARE_NAMES[m.software], s.hour);
}
