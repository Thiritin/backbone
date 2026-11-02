import type { Dict } from "../lang";

export default {
  "mail.folder.inbox": () => "Boîte de réception",
  "mail.folder.sent": () => "Envoyés",
  "mail.folder.drafts": () => "Brouillons",
  "mail.folder.junk": () => "Indésirables",
  "mail.folder.trash": () => "Corbeille",
  "mail.folder.archive": () => "Archives",
  "mail.daemon": () => "Mail Delivery System",
  "ticket.mail.mailWelcome.subject": (p) => `Bienvenue sur ${p.provider}`,
  "ticket.mail.mailWelcome.text": (p) => `Votre boîte ${p.address} est prête. Votre mot de passe est ${p.password}.`,
  "mail.host.gmix": () => "GMix",
  "mail.host.goggle": () => "Goggle Workspace",
  "mail.host.ionose": () => "Hosted Exchange by Ionose",
  "mail.host.lookout": () => "Lookout 365",
  "mail.host.self": () => "Serveur de messagerie propre",
  "mail.footer.gmix": () => "Envoyé avec GMix FreeMix. Obtenez votre adresse gratuite sur gmix.com.",
} satisfies Dict;
