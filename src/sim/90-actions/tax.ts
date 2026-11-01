// docs/design/plans/tax-office.md: what the player files with the tax office through DOHLE.
import { yearOf } from "../00-core/time";
import type { GameState } from "../50-state";
import { answer, CERT_FILE, certOk, fileVat, FORMULAR_APP, normalCode, registerDohle, smallLimit, taxNumber } from "../80-business/tax";
import { salesAddress } from "../80-business/mail";
import { freeSpot } from "./docs";
import type { ActionResult } from "./hardware";

const fail = (error: string): ActionResult => ({ ok: false, error });

// The questionnaire for tax registration, answered on DOHLE once its letter has arrived.
export function answerQuestionnaire(s: GameState, expected: number, small: boolean): ActionResult {
  const asked = s.letters.some((l) => l.topic === "taxQuestionnaire" && l.arrived);
  if (!asked) return fail("error.taxNoQuestionnaire");
  if (s.tax.answered !== null) return fail("error.taxAnswered");
  if (!Number.isFinite(expected) || expected < 0) return fail("error.taxRevenue");
  if (small && expected > smallLimit(yearOf(s.hour))) return fail("error.taxSmallLimit");
  answer(s, Math.round(expected), small);
  return { ok: true };
}

// An advance VAT return filed with the tax office.
export function fileVatReturn(s: GameState, id: string): ActionResult {
  if (!taxNumber(s)) return fail("error.taxNumber");
  if (!certOk(s)) return fail("error.dohleCert");
  const r = s.tax.returns.find((x) => x.id === id && x.kind === "vat");
  if (!r) return fail("error.taxReturn");
  if (r.filedAt !== null) return fail("error.taxReturnFiled");
  fileVat(s, r);
  return { ok: true };
}

// Leaving the small business rule early; the company charges VAT from now on.
export function leaveSmallRule(s: GameState): ActionResult {
  if (!s.tax.small) return fail("error.taxNotSmall");
  s.tax = { ...s.tax, small: false };
  return { ok: true };
}

// Registering on DOHLE with the tax number and the company's email address; a new registration revokes the old certificate.
export function registerForDohle(s: GameState, taxNo: string, email: string): ActionResult {
  const number = taxNumber(s);
  if (!number) return fail("error.taxNumber");
  if (normalCode(taxNo) !== normalCode(number)) return fail("error.dohleTaxNumber");
  if (email.trim().toLowerCase() !== salesAddress(s).toLowerCase()) return fail("error.dohleMail");
  registerDohle(s);
  return { ok: true };
}

// The activation ID from the email and the code from the letter put the certificate file on the desktop.
export function activateDohle(s: GameState, id: string, code: string): ActionResult {
  const t = s.tax;
  if (!t.dohleCode || t.codeAt === null || s.hour < t.codeAt) return fail("error.dohleNoCode");
  if (normalCode(id) !== normalCode(t.dohleId) || normalCode(code) !== normalCode(t.dohleCode)) return fail("error.dohleCode");
  const doc = `doc${s.nextId++}`;
  s.docs = [...s.docs, { id: doc, kind: "cert", title: CERT_FILE, body: "", ...freeSpot(s) }];
  s.tax = { ...t, dohleId: "", dohleCode: "", codeAt: null, cert: doc };
  return { ok: true, id: doc };
}

// DohleFormular from the download page, installed on the dock.
export function installDohleFormular(s: GameState): ActionResult {
  if (s.installed.includes(FORMULAR_APP)) return fail("error.installed");
  s.installed = [...s.installed, FORMULAR_APP];
  return { ok: true };
}
