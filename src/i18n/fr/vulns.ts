import type { Dict } from "../lang";

export default {
  "event.vulnOpen.title": () => "Correctif disponible",
  "event.vulnOpen.text": (p) => `${p.software} sur ${p.host} présente une vulnérabilité (${p.severity}). L'éditeur a publié la mise à jour aujourd'hui.`,
  "event.vulnCritical.title": () => "Vulnérabilité critique",
  "event.vulnCritical.text": (p) => `${p.software} sur ${p.host} présente une vulnérabilité critique et la mise à jour est sortie. Les attaquants lisent le même journal des modifications.`,
  "event.techUpdated.title": () => "Logiciel mis à jour",
  "event.techUpdated.text": (p) => `${p.name} a mis à jour ${p.software} sur ${p.device}.`,
  "error.upToDate": () => "Ce logiciel est à jour.",
  "error.noAutoUpdate": () => "Ce logiciel n'a pas encore de mises à jour automatiques.",
} satisfies Dict;
