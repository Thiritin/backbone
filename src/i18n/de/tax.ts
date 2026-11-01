import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { day, period } from "../tax";

type Params = Record<string, string | number>;
const pay = (p: Params) => `Bitte überweisen Sie ${euroCents(Number(p.amount))} bis zum ${day(p.due)} auf ${p.iban ? `IBAN ${p.iban}` : `Konto ${p.account}, BLZ ${p.code}`} mit dem Verwendungszweck ${p.number}.`;
const PERIOD: Record<string, string> = {"month": "gibt die Umsatzsteuer-Voranmeldung monatlich ab, jeweils bis zum 10. des Folgemonats", "quarter": "gibt die Umsatzsteuer-Voranmeldung vierteljährlich ab, jeweils bis zum 10. des Monats nach dem Quartal", "year": "gibt keine Umsatzsteuer-Voranmeldungen mehr ab und erklärt die Umsatzsteuer mit der Jahreserklärung", "none": "weist keine Umsatzsteuer aus und gibt keine Umsatzsteuer-Voranmeldungen ab"};

export default {
  "letter.taxQuestionnaire.subject": () => "Fragebogen zur steuerlichen Erfassung",
  "letter.taxQuestionnaire.body": (p) => `Das Gewerbeamt hat uns mitgeteilt, dass ${p.name} einen Betrieb eröffnet hat. Bitte füllen Sie den Fragebogen zur steuerlichen Erfassung in DOHLE unter www.dohle.de/erfassung/ aus. Ein Unternehmen, dessen Umsatz unter ${euro(Number(p.limit))} im Jahr bleibt, kann die Kleinunternehmerregelung nach § 19 UStG nutzen und weist keine Umsatzsteuer aus.`,
  "letter.taxNumber.subject": (p) => `Ihre Steuernummer ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} wird bei uns unter der Steuernummer ${p.number} geführt. Bitte geben Sie sie bei allen Erklärungen und Schreiben an. ${p.period === "none" ? "Als Kleinunternehmer weisen Sie keine Umsatzsteuer aus und geben keine Umsatzsteuer-Voranmeldungen ab." : "Bitte geben Sie die Umsatzsteuer-Voranmeldung monatlich bis zum 10. des Folgemonats ab."}`,
  "sim.index.dohle": () => "Steuererklärungen online beim Finanzamt abgeben.",
  "error.taxNoQuestionnaire": () => "Der Fragebogen des Finanzamts ist noch nicht angekommen.",
  "error.taxAnswered": () => "Der Fragebogen wurde bereits gesendet.",
  "error.taxRevenue": () => "Geben Sie den erwarteten Umsatz ein.",
  "error.taxSmallLimit": () => "Der erwartete Umsatz liegt über der Grenze der Kleinunternehmerregelung.",
  "letter.taxSurcharge.subject": () => "Festsetzung eines Verspätungszuschlags",
  "letter.taxSurcharge.body": (p) => `Steuernummer ${p.taxNo}. Die Umsatzsteuer-Voranmeldung für ${period(p)} war am ${day(p.deadline)} fällig und liegt uns nicht vor. Wir setzen einen Verspätungszuschlag von ${euroCents(Number(p.amount))} fest. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `Schätzung der Umsatzsteuer für ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Steuernummer ${p.taxNo}. Die Umsatzsteuer-Voranmeldung für ${period(p)} wurde nicht abgegeben. Wir haben die Umsatzsteuer daher auf ${euroCents(Number(p.amount))} geschätzt. Die Abgabe der Voranmeldung ersetzt diese Schätzung. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "Wegfall der Kleinunternehmerregelung",
  "letter.taxSmallEnd.body": (p) => `Der Umsatz von ${p.name} lag im Vorjahr bei ${euro(Number(p.revenue))} und damit über der Grenze von ${euro(Number(p.limit))}. Ab dem 1. Januar ${p.year} weist das Unternehmen Umsatzsteuer aus und gibt Umsatzsteuer-Voranmeldungen ab.`,
  "letter.taxPeriod.subject": (p) => `Voranmeldungszeitraum ${p.year}`,
  "letter.taxPeriod.body": (p) => `Ab dem 1. Januar ${p.year} gilt für ${p.name}: Das Unternehmen ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Umsatzsteuer-Voranmeldung ${period(p)}`,
  "ledger.vatEstimate": (p) => `Umsatzsteuer-Schätzung ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Verspätungszuschlag ${period(p)}`,
  "error.taxNumber": () => "Das Unternehmen hat noch keine Steuernummer.",
  "error.taxReturn": () => "Diese Erklärung gibt es nicht.",
  "error.taxNotSmall": () => "Das Unternehmen nutzt die Kleinunternehmerregelung nicht.",
  "error.taxReturnFiled": () => "Diese Erklärung wurde bereits abgegeben.",
  "ticket.mail.dohleId.subject": () => "Ihre Registrierung bei DOHLE",
  "ticket.mail.dohleId.text": (p) => `Vielen Dank für Ihre Registrierung zur Steuernummer ${p.number}. Ihre Aktivierungs-ID lautet ${p.id}. Den Aktivierungscode erhalten Sie per Post. Geben Sie beides unter www.dohle.de/registrieren/ ein, um Ihre Zertifikatsdatei zu erhalten.`,
  "letter.dohleCode.subject": () => "Ihr Aktivierungscode für DOHLE",
  "letter.dohleCode.body": (p) => `Für Ihre Registrierung zur Steuernummer ${p.number} lautet der Aktivierungscode ${p.code}. Geben Sie ihn zusammen mit der Aktivierungs-ID aus unserer E-Mail unter www.dohle.de/registrieren/ ein.`,
  "error.dohleCert": () => "Die DOHLE-Zertifikatsdatei wurde auf dem Schreibtisch nicht gefunden.",
  "error.dohleTaxNumber": () => "Die Steuernummer stimmt nicht.",
  "error.dohleMail": () => "Geben Sie die E-Mail-Adresse des Unternehmens ein.",
  "error.dohleNoCode": () => "Der Aktivierungscode ist noch nicht angekommen.",
  "error.dohleCode": () => "Aktivierungs-ID oder Aktivierungscode ist falsch.",
} satisfies Dict;
