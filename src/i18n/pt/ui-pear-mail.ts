import type { Dict } from "../lang";

export default {
  "apps.about.Pear Mail": () => "Lê e envia o correio de todas as contas que adicionar.",
  "pearMail.build": (p) => `Pear Mail ${p.version}`,
  "pearMail.welcome.title": () => "Bem-vindo ao Pear Mail",
  "pearMail.welcome.add": () => "Adicionar a primeira conta",
  "pearMail.activity.checked": (p) => `Correio verificado para ${p.account}: ${p.count} novas`,
  "core.notify.newMail": () => "Correio novo",
  "event.newMail.title": () => "Correio novo",
  "event.newMail.text": (p) => `Chegou uma nova mensagem a ${p.account}.`,
  "event.newMailMore.title": () => "Correio novo",
  "event.newMailMore.text": (p) => `Chegaram mais ${p.count} mensagens novas a ${p.account}.`,
  "error.mailNoBox": () => "Não existe nenhuma caixa de correio com este endereço no servidor.",
  "error.mailAuth": () => "O servidor recusou a palavra-passe.",
  "error.mailExternal": () => "O servidor não permite a ligação deste programa de correio.",
  "error.mailDown": () => "O servidor de correio não responde.",
  "error.mailDns": () => "O correio do domínio não chega a este servidor.",
  "error.mailClosed": () => "Esta caixa de correio foi encerrada.",
  "error.mailPoll": () => "O servidor recusou uma verificação tão pouco tempo após a anterior.",
} satisfies Dict;
