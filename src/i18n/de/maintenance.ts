import type { Dict, Params } from "../lang";

const DAYS = ["Sonntag", "Montag", "Dienstag", "Mittwoch", "Donnerstag", "Freitag", "Samstag"];
const MONTHS = ["Januar", "Februar", "März", "April", "Mai", "Juni", "Juli", "August", "September", "Oktober", "November", "Dezember"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const day = (p: Params) => `${DAYS[Number(p.weekday)]}, ${p.date}. ${MONTHS[Number(p.month)]}`;
const when = (p: Params) => `${day(p)} von ${clock(p.from)} bis ${clock(p.to)} Uhr`;
const name = (p: Params) => p.hostname || p.service;

export default {
  "ticket.maintenance.notice.subject": (p) => `Geplante Wartung an ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `Wir führen am ${day(p)} eine Wartung durch. ${name(p)} ist von ${clock(p.from)} bis ${clock(p.to)} Uhr nicht verfügbar (${p.hours} Stunden).`,
  "ticket.maintenance.moved.subject": (p) => `Wartung an ${name(p)} verschoben`,
  "ticket.maintenance.moved.text": (p) => `Die geplante Wartung wurde verschoben. ${name(p)} ist jetzt am ${when(p)} nicht verfügbar (${p.hours} Stunden).`,
  "ticket.maintenance.move.subject": (p) => `Wartungsfenster für ${name(p)}`,
  "ticket.maintenance.move.text": () => "Da ist bei uns viel los. Könntest du die Wartung stattdessen nachts machen?",
  "ticket.maintenance.declined.subject": (p) => `Wartungsfenster für ${name(p)}`,
  "ticket.maintenance.declined.text": () => "Das ist für uns eine schlechte Nacht. Wir stimmen diesem Fenster nicht zu.",
  "event.maintenanceStart.title": () => "Wartung gestartet",
  "event.maintenanceStart.text": (p) => `Das ${p.hours}-stündige Wartungsfenster an ${p.where} hat begonnen.`,
  "event.maintenanceEnd.title": () => "Wartungsfenster beendet",
  "event.maintenanceEnd.text": (p) => `Das Wartungsfenster an ${p.where} ist vorbei.`,
  "error.maintenanceTarget": () => "Dafür lässt sich keine Wartung planen.",
  "error.maintenanceStart": () => "Das Fenster muss in der Zukunft beginnen.",
  "error.maintenanceHours": () => "Das Fenster braucht eine Dauer.",
  "error.unknownMaintenance": () => "Dieses Wartungsfenster ist nicht geplant.",
} satisfies Dict;
