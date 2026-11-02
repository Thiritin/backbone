import { expect } from "vitest";
import { hourOfMonth } from "../src/sim/00-core/time";
import { mxTarget } from "../src/sim/42-mail/caps";
import { deliver, type Inbound } from "../src/sim/42-mail/deliver";
import type { GameState } from "../src/sim/50-state";
import { removeCompanyRecord, setCompanyRecord } from "../src/sim/90-actions/domains";
import { verifyTenant } from "../src/sim/90-actions/mail";
import { signUpGoggle } from "../src/sim/90-actions/mail-provider";
import { setAccountPrefs } from "../src/sim/90-actions/mailbox";
import { err } from "./company-mail.helpers";
import { readyGame } from "./fixtures";

export const FRIEND = "ada@lovelace.example";

// A verified Goggle tenant the MX names, with one mailbox (the admin) whose spam filter is off, so mail lands in the Inbox.
export function goggleBox(seed: number, ym = "2009-03", plan = "paid"): { s: GameState; a: string; address: string } {
  const s = readyGame(seed);
  s.hour = hourOfMonth(ym);
  expect(err(signUpGoggle(s, { domain: s.company.domain!, plan, local: "admin", title: "Admin", password: "admin-pw" }))).toBe("ok");
  const t = s.mail.tenants.find((x) => x.host === "goggle")!;
  verifyTenant(s, t.id);
  for (const r of s.company.zone.filter((x) => x.type === "MX" && !x.gone)) removeCompanyRecord(s, r.id);
  setCompanyRecord(s, { type: "MX", name: "@", ttl: 300, data: "1 aspmx.l.goggle.com" });
  s.hour += 2;
  expect(mxTarget(s)?.id).toBe(t.id);
  const a = t.admin!;
  setAccountPrefs(s, a, { spam: "off" });
  return { s, a, address: `admin@${s.company.domain}` };
}

export const mail = (s: GameState, address: string, subject: string, o: Partial<Inbound> & { text?: string } = {}): string => {
  const { text = "Hello there", ...rest } = o;
  return deliver(s, { to: address, from: `ext:${FRIEND}`, kind: "reply", own: { subject, text }, ...rest }).id!;
};
