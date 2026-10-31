import type { Dict } from "../lang";

export default {
  "books.status.draft": () => "Brouillon",
  "books.ref.invoice": (p) => `Facture ${p.number}`,
  "books.ref.hosting": () => "Hébergement",
  "books.ref.server": () => "Serveur",
  "books.ref.domain": () => "Domaine",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
