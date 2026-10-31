import type { Dict } from "../lang";

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

export default {
  "ticket.migration.offer.subject": (p) => `Umzug von ${p.hostname || p.service} nach ${p.target}`,
  "ticket.migration.offer.text": (p) => `Wir möchten ${p.hostname || p.service} nach ${p.target} umziehen. Sag uns bitte, ob du einverstanden bist.`,
  "ticket.migration.accept.text": (p) => `Passt für mich. Bitte am ${DAYS[Number(p.day)]} zwischen ${clock(p.from)} und ${clock(p.to)} Uhr.`,
  "ticket.migration.acceptAny.text": () => "Passt für mich. Leg los, wann immer es dir passt.",
  "ticket.migration.decline.text": () => "Mir wäre lieber, wenn alles bleibt, wie es ist.",
  "ticket.migration.missed.text": () => "Der Umzug hat nie stattgefunden. Damit bin ich nicht glücklich.",
  "outcome.moved": () => "Umgezogen",
  "outcome.moveDeclined": () => "Abgelehnt",
  "event.moveAccepted.title": () => "Umzug zugesagt",
  "event.moveAccepted.text": (p) => `${p.name} ist mit dem Umzug von ${p.service} einverstanden.`,
  "event.moveDeclined.title": () => "Umzug abgelehnt",
  "event.moveDeclined.text": (p) => `${p.name} hat den Umzug von ${p.service} abgelehnt.`,
  "event.moveWindow.title": () => "Umzugsfenster offen",
  "event.moveWindow.text": (p) => `${p.name} erwartet, dass ${p.service} bis ${clock(p.to)} Uhr umgezogen ist.`,
  "event.moveDone.title": () => "Dienst umgezogen",
  "event.moveDone.text": (p) => `${p.service} von ${p.name} ist nach ${p.target} umgezogen.`,
  "event.moveMissed.title": () => "Umzug verpasst",
  "event.moveMissed.text": (p) => `Der Umzug von ${p.service} von ${p.name} hat nicht stattgefunden.`,
  "error.moveOffered": () => "Für diesen Dienst wartet ein Umzugsangebot auf Antwort.",
  "error.moveTarget": () => "Dieser Dienst kann dorthin nicht umziehen.",
  "ledger.moveServer": (p) => `Umzug von ${p.device} nach ${p.location}`,
  "error.moveServerOnly": () => "Nur ein Server zieht samt Workloads um.",
  "error.locationNotReady": () => "Der Standort ist noch nicht bereit.",
  "error.clusterSpans": () => "Der Cluster läuft auf mehr Servern als diesem.",
} satisfies Dict;
