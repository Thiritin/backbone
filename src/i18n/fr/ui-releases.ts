import type { Dict } from "../lang";

export default {
  "releases.navVersions": () => "Versions",
  "releases.navNews": () => "Actualités",
  "releases.version": () => "Version",
  "releases.released": () => "Sortie",
  "releases.updatesUntil": () => "Mises à jour jusqu'à",
  "releases.securityUntil": () => "Sécurité jusqu'à",
  "releases.status": () => "Statut",
  "releases.supported": () => "Prise en charge",
  "releases.securityOnly": () => "Correctifs de sécurité uniquement",
  "releases.ended": () => "Fin de vie",
  "releases.notSet": () => "Non annoncée",
  "releases.title": (p) => `${p.name} est sorti`,
} satisfies Dict;
