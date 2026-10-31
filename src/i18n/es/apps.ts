import type { Dict } from "../lang";

export default {
  "ticket.howTo.hacked.subject": () => "Mi sitio web muestra el eslogan de otra persona",
  "ticket.howTo.hacked.text": (p) => `${p.domain || "Mi sitio web"} muestra una calavera y un mensaje en inglés chapucero donde antes estaba mi página de inicio. ¿Puedes arreglarlo?`,
  "ticket.howTo.update.subject": () => "Ayuda para actualizar mi sitio web",
  "ticket.howTo.update.text": () => "Escribiste que el software de mi sitio web necesita una actualización. No tengo ni idea de cómo se hace. ¿Puedes encargarte tú?",
  "event.siteHacked.title": () => "Sitio de cliente desfigurado",
  "event.siteHacked.text": (p) => `El sitio ${p.site} de ${p.customer} fue desfigurado por un agujero en ${p.software}. Envía spam hasta que se limpie.`,
  "event.siteLeft.title": () => "Cliente perdido",
  "event.siteLeft.text": (p) => `${p.customer} se dio de baja después de que ${p.site} fuera desfigurado por tercera vez en un año.`,
  "event.offerDeclined.title": () => "Oferta rechazada",
  "event.offerDeclined.text": (p) => `${p.name} rechazó la oferta.`,
  "outcome.cleaned": () => "Sitio limpiado",
  "outcome.noBackup": () => "Sin copia de seguridad, el cliente reconstruye el sitio",
  "outcome.updated": () => "Software actualizado",
  "outcome.updateSold": () => "Actualización vendida",
  "outcome.managedSold": () => "Actualizaciones gestionadas vendidas",
  "ledger.appUpdate": (p) => `Actualización de ${p.site}`,
  "error.notDefaced": () => "Este sitio no está desfigurado.",
  "error.noBackup": () => "Este sitio no tiene copia de seguridad que restaurar.",
  "error.unknownVulnerability": () => "Esta vulnerabilidad no se conoce.",
  "error.nobodyToNotify": () => "No hay clientes a los que avisar.",
} satisfies Dict;
