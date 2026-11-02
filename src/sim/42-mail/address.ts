// Addresses and tenants with no imports beyond types, so billing and roles can read them without the mail views.
import type { GameState } from "../50-state";
import type { MailAccount, MailTenant } from "./types";

export const tenantOf = (s: GameState, a: MailAccount): MailTenant | undefined => s.mail.tenants.find((x) => x.id === a.tenant);
export const addressesOf = (a: MailAccount): string[] => [a.local, ...a.aliases].map((l) => `${l}@${a.domain}`);
export const ownsAddress = (a: MailAccount, address: string): boolean => addressesOf(a).includes(address.trim().toLowerCase());
// An open mailbox wins over a closed one with the same address in an ended tenant.
export const accountByAddress = (s: GameState, address: string, tenantId?: string): MailAccount | undefined => {
  const all = s.mail.accounts.filter((a) => (!tenantId || a.tenant === tenantId) && ownsAddress(a, address));
  return all.find((a) => a.closedAt === null) ?? all[0];
};
