import type { Dict } from "../lang";

export default {
  "mail.folder.inbox": () => "Recibidos",
  "mail.folder.sent": () => "Enviados",
  "mail.folder.drafts": () => "Borradores",
  "mail.folder.junk": () => "Spam",
  "mail.folder.trash": () => "Papelera",
  "mail.folder.archive": () => "Archivo",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Bienvenido a ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `Tu buzón ${p.address} está listo. Tu contraseña es ${p.password}.`,
} satisfies Dict;
