import type { Dict } from "../lang";

export default {
  "mail.folder.inbox": () => "Posteingang",
  "mail.folder.sent": () => "Gesendet",
  "mail.folder.drafts": () => "Entwürfe",
  "mail.folder.junk": () => "Spam",
  "mail.folder.trash": () => "Papierkorb",
  "mail.folder.archive": () => "Archiv",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Willkommen bei ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `Ihr Postfach ${p.address} ist eingerichtet. Ihr Passwort lautet ${p.password}.`,
} satisfies Dict;
