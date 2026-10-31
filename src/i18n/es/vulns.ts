import type { Dict } from "../lang";

export default {
  "event.vulnOpen.title": () => "Parche disponible",
  "event.vulnOpen.text": (p) => `${p.software} en ${p.host} tiene una vulnerabilidad (${p.severity}). El fabricante publicó hoy la actualización.`,
  "event.vulnCritical.title": () => "Vulnerabilidad crítica",
  "event.vulnCritical.text": (p) => `${p.software} en ${p.host} tiene una vulnerabilidad crítica y la actualización ya ha salido. Los atacantes leen el mismo registro de cambios.`,
  "event.techUpdated.title": () => "Software actualizado",
  "event.techUpdated.text": (p) => `${p.name} actualizó ${p.software} en ${p.device}.`,
  "error.upToDate": () => "Este software está al día.",
  "error.noAutoUpdate": () => "Este software aún no tiene actualizaciones automáticas.",
} satisfies Dict;
