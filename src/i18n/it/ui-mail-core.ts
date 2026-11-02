import type { Dict } from "../lang";

export default {
  "mail.folder.inbox": () => "Posta in arrivo",
  "mail.folder.sent": () => "Posta inviata",
  "mail.folder.drafts": () => "Bozze",
  "mail.folder.junk": () => "Spam",
  "mail.folder.trash": () => "Cestino",
  "mail.folder.archive": () => "Archivio",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Benvenuto su ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `La tua casella ${p.address} è pronta. La tua password è ${p.password}.`,
  "mail.host.gmix": () => "GMix",
  "mail.host.goggle": () => "Goggle Workspace",
  "mail.host.ionose": () => "Hosted Exchange by Ionose",
  "mail.host.lookout": () => "Lookout 365",
  "mail.host.self": () => "Server di posta proprio",
  "mail.footer.gmix": () => "Inviato con GMix FreeMix. Ottieni il tuo indirizzo gratuito su gmix.com.",
} satisfies Dict;
