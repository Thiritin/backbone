import type { Dict } from "../lang";

export default {
  "releases.navVersions": () => "Versiones",
  "releases.navNews": () => "Noticias",
  "releases.version": () => "Versión",
  "releases.released": () => "Publicada",
  "releases.updatesUntil": () => "Actualizaciones hasta",
  "releases.securityUntil": () => "Seguridad hasta",
  "releases.status": () => "Estado",
  "releases.supported": () => "Con soporte",
  "releases.securityOnly": () => "Solo parches de seguridad",
  "releases.ended": () => "Fin de vida",
  "releases.notSet": () => "Sin anunciar",
  "releases.title": (p) => `${p.name} ya está disponible`,
} satisfies Dict;
