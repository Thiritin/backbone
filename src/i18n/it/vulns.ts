import type { Dict } from "../lang";

export default {
  "event.vulnOpen.title": () => "Patch disponibile",
  "event.vulnOpen.text": (p) => `${p.software} su ${p.host} ha una vulnerabilità (${p.severity}). Il produttore ha rilasciato oggi l'aggiornamento.`,
  "event.vulnCritical.title": () => "Vulnerabilità critica",
  "event.vulnCritical.text": (p) => `${p.software} su ${p.host} ha una vulnerabilità critica e l'aggiornamento è uscito. Gli attaccanti leggono lo stesso changelog.`,
  "event.techUpdated.title": () => "Software aggiornato",
  "event.techUpdated.text": (p) => `${p.name} ha aggiornato ${p.software} su ${p.device}.`,
  "error.upToDate": () => "Questo software è aggiornato.",
  "error.noAutoUpdate": () => "Questo software non ha ancora aggiornamenti automatici.",
} satisfies Dict;
