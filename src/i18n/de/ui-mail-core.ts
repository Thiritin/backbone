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
  "mail.host.gmix": () => "GMix",
  "mail.host.goggle": () => "Goggle Workspace",
  "mail.host.ionose": () => "Hosted Exchange by Ionose",
  "mail.host.lookout": () => "Lookout 365",
  "mail.host.self": () => "Eigener Mailserver",
  "mail.footer.gmix": () => "Gesendet mit GMix FreeMix. Jetzt kostenlos Ihre Adresse sichern auf gmix.com.",
} satisfies Dict;
