import type { Dict, Params } from "../lang";

const DAYS = ["dimanche", "lundi", "mardi", "mercredi", "jeudi", "vendredi", "samedi"];
const MONTHS = ["janvier", "février", "mars", "avril", "mai", "juin", "juillet", "août", "septembre", "octobre", "novembre", "décembre"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;
const day = (p: Params) => `${DAYS[Number(p.weekday)]} ${p.date} ${MONTHS[Number(p.month)]}`;
const when = (p: Params) => `${day(p)} de ${clock(p.from)} à ${clock(p.to)}`;
const name = (p: Params) => p.hostname || p.service;

export default {
  "ticket.maintenance.notice.subject": (p) => `Maintenance planifiée sur ${name(p)}`,
  "ticket.maintenance.notice.text": (p) => `Nous effectuerons une maintenance le ${day(p)}. ${name(p)} sera indisponible de ${clock(p.from)} à ${clock(p.to)} (${p.hours} heures).`,
  "ticket.maintenance.moved.subject": (p) => `Maintenance sur ${name(p)} reportée`,
  "ticket.maintenance.moved.text": (p) => `La maintenance planifiée a été décalée. ${name(p)} sera désormais indisponible le ${when(p)} (${p.hours} heures).`,
  "ticket.maintenance.move.subject": (p) => `Créneau de maintenance pour ${name(p)}`,
  "ticket.maintenance.move.text": () => "C'est une période chargée pour nous. Pourrais-tu faire la maintenance la nuit plutôt ?",
  "ticket.maintenance.declined.subject": (p) => `Créneau de maintenance pour ${name(p)}`,
  "ticket.maintenance.declined.text": () => "C'est une mauvaise nuit pour nous. Nous n'acceptons pas ce créneau.",
  "event.maintenanceStart.title": () => "Maintenance démarrée",
  "event.maintenanceStart.text": (p) => `Le créneau de maintenance de ${p.hours} heures sur ${p.where} a commencé.`,
  "event.maintenanceEnd.title": () => "Créneau de maintenance terminé",
  "event.maintenanceEnd.text": (p) => `Le créneau de maintenance sur ${p.where} est terminé.`,
  "error.maintenanceTarget": () => "Une maintenance ne peut pas être planifiée ici.",
  "error.maintenanceStart": () => "Le créneau doit commencer dans le futur.",
  "error.maintenanceHours": () => "Le créneau a besoin d'une durée.",
  "error.unknownMaintenance": () => "Ce créneau de maintenance n'est pas planifié.",
} satisfies Dict;
