import { deliverMail } from "../40-support/tickets";
import type { GameState } from "../50-state";
import { applyError, file, FILE_DAYS, FILED_WITH, NOTARY_MAIL, NOTARY_NAME, OFFICE_MAIL, OFFICE_NAME, SHARE_CAPITAL } from "../80-business/paperwork";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
export const MAILER = "Mailer-Daemon";

// A new email; only the trade office and the notary answer, any other address bounces.
export function sendMail(s: GameState, to: string, subject: string, attachment: string | null): ActionResult {
  const address = to.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(address)) return fail("error.mailAddress");
  const params = { subject: subject.trim(), to: address };
  if (address !== OFFICE_MAIL && address !== NOTARY_MAIL) {
    deliverMail(s, MAILER, "bounce", params);
    return { ok: true };
  }
  const from = address === OFFICE_MAIL ? OFFICE_NAME : NOTARY_NAME;
  const form = s.docs.find((d) => d.id === attachment)?.form;
  if (!form) deliverMail(s, from, "noForm", params);
  else if (FILED_WITH[form.form] !== address) deliverMail(s, from, "wrongDesk", params);
  else if (form.signed === null) deliverMail(s, from, "unsigned", params);
  else {
    const err = applyError(s, form.form);
    if (err) return fail(err);
    if (form.form === "limited" && s.cash < SHARE_CAPITAL) {
      deliverMail(s, from, "capital", { ...params, amount: SHARE_CAPITAL });
      return { ok: true };
    }
    file(s, form.form);
    deliverMail(s, from, form.form === "limited" ? "notaryFiled" : "officeReceived", { ...params, days: FILE_DAYS, name: s.company.name });
  }
  return { ok: true };
}

export function readLetter(s: GameState, id: string): ActionResult {
  if (!s.letters.some((l) => l.id === id)) return fail("error.unknownLetter");
  s.letters = s.letters.map((l) => (l.id === id ? { ...l, read: true } : l));
  return { ok: true };
}
