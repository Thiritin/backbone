import type { Dict } from "../lang";

export default {
  "releases.navVersions": () => "Versioni",
  "releases.navNews": () => "Notizie",
  "releases.version": () => "Versione",
  "releases.released": () => "Rilasciata",
  "releases.updatesUntil": () => "Aggiornamenti fino a",
  "releases.securityUntil": () => "Sicurezza fino a",
  "releases.status": () => "Stato",
  "releases.supported": () => "Supportata",
  "releases.securityOnly": () => "Solo patch di sicurezza",
  "releases.ended": () => "Fine vita",
  "releases.notSet": () => "Non annunciata",
  "releases.title": (p) => `${p.name} è uscito`,
} satisfies Dict;
