import type { Dict } from "../lang";

export default {
  "books.status.draft": () => "Bozza",
  "books.ref.invoice": (p) => `Fattura ${p.number}`,
  "books.ref.hosting": () => "Hosting",
  "books.ref.server": () => "Server",
  "books.ref.domain": () => "Dominio",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
