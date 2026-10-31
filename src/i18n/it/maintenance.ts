import type { Dict, Params } from "../lang";

const DAYS = ["domenica", "lunedì", "martedì", "mercoledì", "giovedì", "venerdì", "sabato"];
const MONTHS = ["gennaio", "febbraio", "marzo", "aprile", "maggio", "giugno", "luglio", "agosto", "settembre", "ottobre", "novembre", "dicembre"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const day = (p: Params) => `${DAYS[Number(p.weekday)]} ${p.date} ${MONTHS[Number(p.month)]}`;
const when = (p: Params) => `${day(p)} dalle ${clock(p.from)} alle ${clock(p.to)}`;
const name = (p: Params) => p.hostname || p.service;

export default {
  "ticket.maintenance.notice.subject": (p) => `Manutenzione programmata su ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `Eseguiremo una manutenzione ${day(p)}. ${name(p)} non sarà disponibile dalle ${clock(p.from)} alle ${clock(p.to)} (${p.hours} ore).`,
  "ticket.maintenance.moved.subject": (p) => `Manutenzione su ${name(p)} riprogrammata`,
  "ticket.maintenance.moved.text": (p) => `La manutenzione programmata è stata spostata. ${name(p)} non sarà disponibile ${when(p)} (${p.hours} ore).`,
  "ticket.maintenance.move.subject": (p) => `Finestra di manutenzione per ${name(p)}`,
  "ticket.maintenance.move.text": () => "Per noi è un momento molto impegnato. Potresti fare la manutenzione di notte?",
  "ticket.maintenance.declined.subject": (p) => `Finestra di manutenzione per ${name(p)}`,
  "ticket.maintenance.declined.text": () => "Per noi è una brutta notte. Non accettiamo questa finestra.",
  "event.maintenanceStart.title": () => "Manutenzione iniziata",
  "event.maintenanceStart.text": (p) => `È iniziata la finestra di manutenzione di ${p.hours} ore su ${p.where}.`,
  "event.maintenanceEnd.title": () => "Finestra di manutenzione terminata",
  "event.maintenanceEnd.text": (p) => `La finestra di manutenzione su ${p.where} è finita.`,
  "error.maintenanceTarget": () => "Qui non si può programmare una manutenzione.",
  "error.maintenanceStart": () => "La finestra deve iniziare nel futuro.",
  "error.maintenanceHours": () => "La finestra ha bisogno di una durata.",
  "error.unknownMaintenance": () => "Questa finestra di manutenzione non è programmata.",
} satisfies Dict;
