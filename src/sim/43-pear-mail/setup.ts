// What the Add Account assistant fills in (docs/design/plans/mail-client.md, Add Account assistant).
import { nowMinutes, yearOf } from "../00-core/time";
import { mailServersOf } from "../10-catalog/mail-providers";
import { accountByAddress, tenantOf } from "../42-mail/address";
import { capsOf } from "../42-mail/caps";
import { GMIX_DOMAIN } from "../42-mail/new";
import type { GameState } from "../50-state";
import { clientAccount, type ClientAccount } from "./state";

// host empty means automatic setup.
export interface AccountInput { fullName: string; address: string; password: string; protocol: "imap" | "pop"; description?: string; host?: string; smtp?: string }

export const CHECK_EVERY = [5, 15, 30, 60];
// Before its first check an account has seen nothing, so a POP account downloads the whole Inbox.
const NEVER = -1e6;

const mailbox = (s: GameState, address: string) => {
  const a = accountByAddress(s, address), t = a && tenantOf(s, a);
  return a && t ? { a, t } : null;
};

// The settings automatic setup finds: IMAP where the plan offers it, else POP. Null without autoconfig.
export function autoServers(s: GameState, address: string): { protocol: "imap" | "pop"; host: string; smtp: string } | null {
  const box = mailbox(s, address);
  if (!box) return null;
  const caps = capsOf(s, box.a);
  if (!caps.autoconfig) return null;
  const servers = mailServersOf(box.t.host, box.a.domain, yearOf(s.hour)), protocol = caps.imap ? "imap" : "pop";
  const host = servers[protocol]?.host;
  return host && servers.smtp ? { protocol, host, smtp: servers.smtp.host } : null;
}

// The account the input describes, not yet stored. It checks at the shortest interval the provider's poll gap allows.
export function draftClient(s: GameState, id: string, i: AccountInput): ClientAccount {
  const address = i.address.trim().toLowerCase(), box = mailbox(s, address), host = i.host?.trim().toLowerCase();
  const gap = box ? capsOf(s, box.a).pollGapMin : 0;
  return {
    ...clientAccount(id, { accountId: box?.a.id ?? "", address, description: i.description?.trim() || address, fullName: i.fullName.trim(), password: i.password, protocol: i.protocol }, nowMinutes(s)),
    server: host ? { host, port: i.protocol === "imap" ? 993 : 995, tls: true } : null,
    smtp: i.smtp?.trim().toLowerCase() || null,
    checkEvery: CHECK_EVERY.find((m) => m >= gap) ?? CHECK_EVERY.at(-1)!,
    checkedAt: NEVER, syncedAt: NEVER,
  };
}

// Registering the company opens the free GMix box to mail programs, stores its login for the browser and sets it up in Pear Mail.
// Safe to run again: each part is skipped once it exists.
export function provisionStarterMail(s: GameState): void {
  const a = s.mail.accounts.find((x) => x.id === s.mail.primary);
  if (!a || a.domain !== GMIX_DOMAIN) return;
  const address = `${a.local}@${a.domain}`, key = `mail:${address}`;
  if (a.external !== true) s.mail = { ...s.mail, accounts: s.mail.accounts.map((x) => (x.id === a.id ? { ...x, external: true } : x)) };
  if (!s.logins[key]) s.logins = { ...s.logins, [key]: [address, a.password] };
  if (s.pearMail.accounts.some((c) => c.address === address)) return;
  const caps = capsOf(s, a), protocol = caps.imap ? "imap" : "pop", servers = mailServersOf("gmix", a.domain, yearOf(s.hour));
  const draft = draftClient(s, `cl${s.nextId++}`, { fullName: a.title, address, password: a.password, protocol, host: servers[protocol]?.host, smtp: servers.smtp?.host });
  s.pearMail = { ...s.pearMail, accounts: [...s.pearMail.accounts, { ...draft, popRemove: "never" }] };
}
