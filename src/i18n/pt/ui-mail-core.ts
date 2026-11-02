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
} satisfies Dict;
