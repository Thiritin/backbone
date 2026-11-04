import { deliverMail } from "../42-mail/sources";
import { DOC_TYPES, type DocType } from "../40-support/letters";
import type { GameState } from "../50-state";
import { applyError, file, FILE_DAYS, FILED_WITH, NOTARY_MAIL, NOTARY_NAME, OFFICE_MAIL, OFFICE_NAME, SHARE_CAPITAL } from "../80-business/paperwork";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });
export const MAILER = "Mailer-Daemon";

// A new email; only the trade office and the notary answer, any other address bounces.
export function sendMail(s: GameState, to: string, subject: string, attachment: string | null): ActionResult {
  const address = to.trim().toLowerCase();
  if (!/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/.test(address)) return fail("error.mailAddress");
  if (!RESPONDERS.includes(address)) {
    deliverMail(s, MAILER, "bounce", { subject: subject.trim(), to: address });
    return { ok: true };
  }
  return respond(s, address, subject, attachment);
}

// Addresses that answer mail: the trade office and the notary.
export const RESPONDERS = [OFFICE_MAIL, NOTARY_MAIL];

// The office's or the notary's answer to a mail with this subject and attached document, sent back to the address it came from.
export function respond(s: GameState, address: string, subject: string, attachment: string | null, replyTo?: string): ActionResult {
  const params = { subject: subject.trim(), to: address };
  const from = address === OFFICE_MAIL ? OFFICE_NAME : NOTARY_NAME, back = { source: "office", to: replyTo };
  const form = s.docs.find((d) => d.id === attachment)?.form;
  if (!form) deliverMail(s, from, "noForm", params, back);
  else if (FILED_WITH[form.form] !== address) deliverMail(s, from, "wrongDesk", params, back);
  else if (form.signed === null) deliverMail(s, from, "unsigned", params, back);
  else {
    // Cash that dropped below the share capital after signing gets the notary's letter.
    const err = applyError(s, form.form);
    if (err && err !== "error.shareCapital") return fail(err);
    if (err) {
      deliverMail(s, from, "capital", { ...params, amount: SHARE_CAPITAL }, back);
      return { ok: true };
    }
    file(s, form.form);
    deliverMail(s, from, form.form === "limited" ? "notaryFiled" : "officeReceived", { ...params, days: FILE_DAYS, name: s.company.name }, back);
  }
  return { ok: true };
}

export function readLetter(s: GameState, id: string): ActionResult {
  const l = s.letters.find((x) => x.id === id);
  if (!l) return fail("error.unknownLetter");
  if (l.box) return fail("error.inLetterbox");
  s.letters = s.letters.map((x) => (x.id === id ? { ...x, read: true } : x));
  return { ok: true };
}

// Files a letter under another document type in DocuWhere.
export function retypeLetter(s: GameState, id: string, type: DocType): ActionResult {
  if (!s.letters.some((l) => l.id === id)) return fail("error.unknownLetter");
  if (!DOC_TYPES.includes(type)) return fail("error.unknownDocType");
  s.letters = s.letters.map((l) => (l.id === id ? { ...l, type } : l));
  return { ok: true };
}
