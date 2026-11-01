import type { Dict } from "../lang";
import { euro } from "../../sim/00-core/money";

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
} satisfies Dict;
