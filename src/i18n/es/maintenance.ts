import type { Dict, Params } from "../lang";

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const MONTHS = ["enero", "febrero", "marzo", "abril", "mayo", "junio", "julio", "agosto", "septiembre", "octubre", "noviembre", "diciembre"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const day = (p: Params) => `${DAYS[Number(p.weekday)]} ${p.date} de ${MONTHS[Number(p.month)]}`;
const when = (p: Params) => `el ${day(p)} de ${clock(p.from)} a ${clock(p.to)}`;
const name = (p: Params) => p.hostname || p.service;

export default {
  "ticket.maintenance.notice.subject": (p) => `Mantenimiento planificado en ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `Realizaremos un mantenimiento el ${day(p)}. ${name(p)} no estará disponible de ${clock(p.from)} a ${clock(p.to)} (${p.hours} horas).`,
  "ticket.maintenance.moved.subject": (p) => `Mantenimiento de ${name(p)} reprogramado`,
  "ticket.maintenance.moved.text": (p) => `El mantenimiento planificado se ha movido. ${name(p)} no estará disponible ${when(p)} (${p.hours} horas).`,
  "ticket.maintenance.move.subject": (p) => `Ventana de mantenimiento para ${name(p)}`,
  "ticket.maintenance.move.text": () => "Es una hora de mucho trabajo para nosotros. ¿Podrías hacer el mantenimiento por la noche?",
  "ticket.maintenance.declined.subject": (p) => `Ventana de mantenimiento para ${name(p)}`,
  "ticket.maintenance.declined.text": () => "Es una mala noche para nosotros. No aceptamos esta ventana.",
  "event.maintenanceStart.title": () => "Mantenimiento iniciado",
  "event.maintenanceStart.text": (p) => `Ha empezado la ventana de mantenimiento de ${p.hours} horas en ${p.where}.`,
  "event.maintenanceEnd.title": () => "Ventana de mantenimiento terminada",
  "event.maintenanceEnd.text": (p) => `La ventana de mantenimiento en ${p.where} ha terminado.`,
  "error.maintenanceTarget": () => "No se puede planificar un mantenimiento aquí.",
  "error.maintenanceStart": () => "La ventana debe empezar en el futuro.",
  "error.maintenanceHours": () => "La ventana necesita una duración.",
  "error.unknownMaintenance": () => "Esta ventana de mantenimiento no está planificada.",
} satisfies Dict;
