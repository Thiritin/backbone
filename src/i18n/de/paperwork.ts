import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE } from "../lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "Einzelunternehmen", partnership: "Personengesellschaft", limited: "GmbH" };
const pay = (p: Params) => `Bitte überweisen Sie ${euroCents(Number(p.amount))} bis zum ${day(p.due)} auf ${p.iban ? `IBAN ${p.iban}` : `Konto ${p.account}, BLZ ${p.code}`} mit dem Verwendungszweck ${p.number}.`;

export default {
  "doc.form.partnership": () => "Gewerbeummeldung GA-2.pdf",
  "doc.form.limited": () => "Gesellschaftsvertrag.pdf",
  "error.notRegistered": () => "Die Firma ist noch nicht angemeldet.",
  "error.legalFormDown": () => "Eine Rechtsform lässt sich nur in eine höhere ändern.",
  "error.changePending": () => "Ein Wechsel der Rechtsform läuft bereits.",
  "error.formSigned": () => "Dieses Formular ist bereits unterschrieben.",
  "error.mailAddress": () => "Gib eine gültige E-Mail-Adresse ein.",
  "error.unknownLetter": () => "Diesen Brief gibt es nicht mehr.",
  "ledger.tradeRegistration": () => "Gebühr Gewerbeanmeldung",
  "ledger.tradeChange": () => "Gebühr Gewerbeummeldung",
  "ledger.notary": () => "Notargebühr, Gesellschaftsvertrag",
  "ledger.registerEntry": () => "Gebühr Handelsregistereintrag",
  "ledger.chamber": (p) => `Grundbeitrag Handelskammer ${p.year}`,
  "sim.index.cat.government": () => "Behörden",
  "sim.index.office": () => "Gewerbe anmelden oder die Rechtsform ändern.",
  "browser-sites-1.ix.title": () => "Yahoy! Verzeichnis",

  "letter.officeRegistered.subject": (p) => `Gewerbeanmeldung Nr. GA ${p.number}`,
  "letter.officeRegistered.body": (p) => `Wir bestätigen die Anmeldung von ${p.name} unter der Nummer GA ${p.number}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Gewerbeummeldung",
  "letter.officeChange.body": (p) => `Wir bestätigen, dass ${p.name} ab heute als ${FORM[p.form] ?? p.form} eingetragen ist. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Rechnung ${p.number}`,
  "letter.notaryInvoice.body": (p) => `Für die Beurkundung des Gesellschaftsvertrags von ${p.name} und die Anmeldung zum Handelsregister berechnen wir ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Eintragung in das Handelsregister",
  "letter.registerEntry.body": (p) => `${p.name} ist als ${FORM[p.form] ?? p.form} in das Handelsregister eingetragen. Die Eintragung gilt ab heute. Unsere Rechnung für die Eintragung folgt gesondert.`,
  "letter.registerInvoice.subject": (p) => `Rechnung ${p.number}`,
  "letter.registerInvoice.body": (p) => `Für die Eintragung von ${p.name} in das Handelsregister berechnen wir ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Mitgliedsbeitrag ${p.year}`,
  "letter.chamberFee.body": (p) => `Als angemeldetes Gewerbe ist ${p.name} Mitglied der Handelskammer. Bei ${p.staff} Beschäftigten beträgt Ihr Grundbeitrag für ${p.year} ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Unzustellbare Nachricht zurück an den Absender",
  "ticket.mail.bounce.text": (p) => `Ihre Nachricht an ${p.to} konnte nicht zugestellt werden. Die Adresse existiert nicht.`,
  "ticket.mail.noForm.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.noForm.text": () => "Vielen Dank für Ihre Nachricht. Im Anhang fanden wir keinen Antrag. Bitte hängen Sie das unterschriebene Formular an.",
  "ticket.mail.wrongDesk.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Vielen Dank für Ihre Nachricht. Für diesen Antrag sind wir nicht zuständig. Bitte senden Sie ihn an die Adresse auf dem Formular.",
  "ticket.mail.unsigned.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Vielen Dank für Ihren Antrag. Das Formular ist nicht unterschrieben. Bitte unterschreiben Sie es und senden Sie es erneut.",
  "ticket.mail.capital.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Danke für den unterschriebenen Gesellschaftsvertrag. Eine GmbH braucht ein Stammkapital von ${euro(Number(p.amount))} auf ihrem Konto, bevor wir sie anmelden können. Bitte senden Sie den Vertrag erneut, sobald das Kapital bereitsteht.`,
  "ticket.mail.notaryFiled.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Danke für den unterschriebenen Gesellschaftsvertrag von ${p.name}. Wir reichen ihn innerhalb von ${p.days} Werktagen beim Handelsregister ein. Das Register bestätigt die Eintragung per Brief.`,
  "ticket.mail.officeReceived.subject": (p) => `AW: ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `Wir haben die Gewerbeummeldung für ${p.name} erhalten. Unsere Bestätigung erhalten Sie innerhalb von ${p.days} Werktagen per Brief.`,
} satisfies Dict;
