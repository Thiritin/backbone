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
} satisfies Dict;
