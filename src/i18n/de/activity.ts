import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const KIND: Record<string, string> = {
  howTo: "Anleitungs-Ticket", billing: "Abrechnungs-Ticket", outage: "Ausfall-Ticket", upgrade: "Upgrade-Ticket", cancellation: "Kündigungs-Ticket", abuse: "Abuse-Ticket",
  appeal: "Einspruchs-Ticket", notice: "Hinweis-Ticket", legal: "Rechts-Ticket", refund: "Erstattungs-Ticket", order: "Bestell-Ticket",
};
const RESOLVED: Record<string, string> = {
  credit: "10 % der Monatsrechnung gutgeschrieben", "retain.half": "50 % Rabatt auf den nächsten Monat angeboten", "retain.free": "Einen Gratismonat angeboten",
  "retain.d3": "20 % Rabatt für 3 Monate angeboten", "retain.d6": "20 % Rabatt für 6 Monate angeboten", "retain.d12": "20 % Rabatt für 12 Monate angeboten",
  "retain.upgrade": "Ein kostenloses Upgrade angeboten", "retain.fix": "Eine Lösung versprochen", "retain.move": "Einen Umzug auf einen besseren Server angeboten", cancel: "Kündigung bearbeitet",
  unsuspend: "Dienste mit Zahlungsfrist wieder freigeschaltet", keep: "Dienste gesperrt gelassen", forward: "Abuse-Meldung weitergeleitet",
  takedown: "Inhalt entfernt", reject: "Anfrage abgelehnt", comply: "Anfrage erfüllt", object: "Der Anfrage widersprochen",
  refund: "Zahlung erstattet", accept: "Bestellung angenommen", quote: "Angebot gesendet", account: "Kundenkonto angelegt",
  invoice: "Bestellung bestätigt und Rechnung gesendet", domain: "Domain registriert", provision: "Dienst eingerichtet",
};
const ticket = (p: Params) => KIND[p.kind] ?? "Ticket";

export default {
  "activity.reply": (p) => `${ticket(p)} beantwortet`,
  "activity.escalate": (p) => `${ticket(p)} eskaliert`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `${ticket(p)} gelöst`,
  "activity.checkInvoice": (p) => `Rechnung ${p.invoice} geprüft`,
  "activity.reminder": (p) => `Zahlungserinnerung für Rechnung ${p.invoice} gesendet`,
  "activity.dunning": (p) => `Mahnung für Rechnung ${p.invoice} gesendet`,
  "activity.final": (p) => `Letzte Mahnung für Rechnung ${p.invoice} gesendet`,
  "activity.collections": (p) => `Rechnung ${p.invoice} an das Inkasso übergeben`,
  "activity.suspend": (p) => `Dienste wegen Rechnung ${p.invoice} gesperrt`,
  "activity.unsuspend": (p) => `Dienste wegen Rechnung ${p.invoice} wieder freigeschaltet`,
  "activity.writeOff": (p) => `Rechnung ${p.invoice} abgeschrieben`,
  "activity.price": (p) => `Preis auf ${euroCents(Number(p.price))} im Monat geändert`,
} satisfies Dict;
