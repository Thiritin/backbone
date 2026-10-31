import type { Dict } from "../lang";

export default {
  "ticket.howTo.hacked.subject": () => "O meu site mostra o slogan de outra pessoa",
  "ticket.howTo.hacked.text": (p) => `${p.domain || "O meu site"} mostra uma caveira e uma mensagem em inglês macarrónico onde antes estava a minha página inicial. Consegues resolver isto?`,
  "ticket.howTo.update.subject": () => "Ajuda para atualizar o meu site",
  "ticket.howTo.update.text": () => "Escreveste que o software por trás do meu site precisa de uma atualização. Não faço ideia de como se faz. Podes tratar disso por mim?",
  "event.siteHacked.title": () => "Site de cliente vandalizado",
  "event.siteHacked.text": (p) => `O site ${p.site} de ${p.customer} foi vandalizado através de uma falha em ${p.software}. Envia spam até ser limpo.`,
  "event.siteLeft.title": () => "Cliente perdido",
  "event.siteLeft.text": (p) => `${p.customer} cancelou depois de ${p.site} ser vandalizado pela terceira vez num ano.`,
  "event.offerDeclined.title": () => "Oferta recusada",
  "event.offerDeclined.text": (p) => `${p.name} recusou a oferta.`,
  "outcome.cleaned": () => "Site limpo",
  "outcome.noBackup": () => "Sem backup, o cliente reconstrói o site",
  "outcome.updated": () => "Software atualizado",
  "outcome.updateSold": () => "Atualização vendida",
  "outcome.managedSold": () => "Atualizações geridas vendidas",
  "ledger.appUpdate": (p) => `Atualização de ${p.site}`,
  "error.notDefaced": () => "Este site não está vandalizado.",
  "error.noBackup": () => "Este site não tem backup para restaurar.",
  "error.unknownVulnerability": () => "Esta vulnerabilidade não é conhecida.",
  "error.nobodyToNotify": () => "Não há clientes a avisar.",
} satisfies Dict;
