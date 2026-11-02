import type { Dict } from "../lang";

export default {
  "mail.folder.inbox": () => "Caixa de entrada",
  "mail.folder.sent": () => "Enviados",
  "mail.folder.drafts": () => "Rascunhos",
  "mail.folder.junk": () => "Spam",
  "mail.folder.trash": () => "Lixeira",
  "mail.folder.archive": () => "Arquivo",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Bem-vindo ao ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `Sua caixa ${p.address} está pronta. Sua senha é ${p.password}.`,
  "mail.host.gmix": () => "GMix",
  "mail.host.goggle": () => "Goggle Workspace",
  "mail.host.ionose": () => "Hosted Exchange by Ionose",
  "mail.host.lookout": () => "Lookout 365",
  "mail.host.self": () => "Servidor de e-mail próprio",
  "mail.footer.gmix": () => "Enviado com GMix FreeMix. Obtenha seu endereço grátis em gmix.com.",
} satisfies Dict;
