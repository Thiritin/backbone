import type { Dict } from "../lang";

export default {
  "event.vulnOpen.title": () => "Patch disponível",
  "event.vulnOpen.text": (p) => `${p.software} em ${p.host} tem uma vulnerabilidade (${p.severity}). O fabricante lançou hoje a atualização.`,
  "event.vulnCritical.title": () => "Vulnerabilidade crítica",
  "event.vulnCritical.text": (p) => `${p.software} em ${p.host} tem uma vulnerabilidade crítica e a atualização já saiu. Os atacantes leem o mesmo registo de alterações.`,
  "event.techUpdated.title": () => "Software atualizado",
  "event.techUpdated.text": (p) => `${p.name} atualizou ${p.software} em ${p.device}.`,
  "error.upToDate": () => "Este software está atualizado.",
  "error.noAutoUpdate": () => "Este software ainda não tem atualizações automáticas.",
} satisfies Dict;
