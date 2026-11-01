import type { Dict } from "../lang";

export default {
  "releases.navVersions": () => "Versões",
  "releases.navNews": () => "Notícias",
  "releases.version": () => "Versão",
  "releases.released": () => "Lançada",
  "releases.updatesUntil": () => "Atualizações até",
  "releases.securityUntil": () => "Segurança até",
  "releases.status": () => "Estado",
  "releases.supported": () => "Com suporte",
  "releases.securityOnly": () => "Só correções de segurança",
  "releases.ended": () => "Fim de vida",
  "releases.notSet": () => "Não anunciado",
  "releases.title": (p) => `${p.name} lançado`,
} satisfies Dict;
