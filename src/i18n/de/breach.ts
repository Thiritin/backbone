import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.breach.title": () => "Kundendaten gestohlen",
  "event.breach.text": (p) => `Angreifer haben die Kundendaten auf ${p.host} kopiert und fordern ${euro(Number(p.ransom))} innerhalb von ${p.hours} Stunden.`,
  "event.breachPress.title": () => "Datenleck in der Presse",
  "event.breachPress.text": (p) => `Tech-Seiten berichten, dass Kundendaten von ${p.host} online zum Verkauf stehen. ${p.customers} ${Number(p.customers) === 1 ? "Kunde war" : "Kunden waren"} betroffen.`,
  "event.breachFine.title": () => "Bußgeld wegen Datenschutz",
  "event.breachFine.text": (p) => `Die Datenschutzbehörde hat das Unternehmen wegen des Datenlecks auf ${p.host} mit ${euro(Number(p.amount))} bestraft.`,
  "ticket.extortion.data.subject": () => "Deine Kundendaten stehen zum Verkauf",
  "ticket.extortion.data.text": (p) =>
    `Wir haben die Kundendaten von ${p.host} und online zum Verkauf angeboten. Zahle ${euro(Number(p.ransom))} innerhalb von 72 Stunden, und wir nehmen das Angebot raus. Danach bekommt der Meistbietende alles.`,
  "ledger.ransom": (p) => `Lösegeld für ${p.host}`,
  "ledger.fine": (p) => `Bußgeld wegen Datenschutz für ${p.host}`,
  "outcome.ransomPaid": () => "Lösegeld gezahlt",
  "outcome.ransomRefused": () => "Lösegeld verweigert",
} satisfies Dict;
