import type { Dict } from "../lang";

const DAYS = ["domingo", "lunes", "martes", "miércoles", "jueves", "viernes", "sábado"];
const clock = (h: unknown) => `${String(h).padStart(2, "0")}:00`;

export default {
  "ticket.migration.offer.subject": (p) => `Traslado de ${p.hostname || p.service} a ${p.target}`,
  "ticket.migration.offer.text": (p) => `Nos gustaría trasladar ${p.hostname || p.service} a ${p.target}. Dinos si estás de acuerdo.`,
  "ticket.migration.accept.text": (p) => `Por mí bien. Hazlo el ${DAYS[Number(p.day)]} entre las ${clock(p.from)} y las ${clock(p.to)}.`,
  "ticket.migration.acceptAny.text": () => "Por mí bien. Adelante cuando te venga bien.",
  "ticket.migration.decline.text": () => "Prefiero dejarlo todo como está.",
  "ticket.migration.missed.text": () => "El traslado nunca se hizo. No estoy contento.",
  "outcome.moved": () => "Trasladado",
  "outcome.moveDeclined": () => "Rechazado",
  "event.moveAccepted.title": () => "Traslado aceptado",
  "event.moveAccepted.text": (p) => `${p.name} aceptó el traslado de ${p.service}.`,
  "event.moveDeclined.title": () => "Traslado rechazado",
  "event.moveDeclined.text": (p) => `${p.name} rechazó el traslado de ${p.service}.`,
  "event.moveWindow.title": () => "Ventana de traslado abierta",
  "event.moveWindow.text": (p) => `${p.name} espera que ${p.service} esté trasladado antes de las ${clock(p.to)}.`,
  "event.moveDone.title": () => "Servicio trasladado",
  "event.moveDone.text": (p) => `${p.service} de ${p.name} se trasladó a ${p.target}.`,
  "event.moveMissed.title": () => "Traslado perdido",
  "event.moveMissed.text": (p) => `El traslado de ${p.service} de ${p.name} no se ejecutó.`,
  "error.moveOffered": () => "Este servicio tiene una oferta de traslado pendiente de respuesta.",
  "error.moveTarget": () => "Este servicio no puede trasladarse allí.",
  "ledger.moveServer": (p) => `Traslado de ${p.device} a ${p.location}`,
  "error.moveServerOnly": () => "Solo un servidor se traslada con sus cargas de trabajo.",
  "error.locationNotReady": () => "La ubicación aún no está lista.",
  "error.clusterSpans": () => "El clúster se ejecuta en más servidores que este.",
} satisfies Dict;
