// What the Add Account assistant fills in (docs/design/plans/mail-client.md, Add Account assistant).
import { nowMinutes, yearOf } from "../00-core/time";
import { mailServersOf } from "../10-catalog/mail-providers";
import { accountByAddress, tenantOf } from "../42-mail/address";
import { capsOf } from "../42-mail/caps";
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
