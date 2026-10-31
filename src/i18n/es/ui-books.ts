import type { Dict } from "../lang";

export default {
  "books.status.draft": () => "Borrador",
  "books.ref.invoice": (p) => `Factura ${p.number}`,
  "books.ref.hosting": () => "Hosting",
  "books.ref.server": () => "Servidor",
  "books.ref.domain": () => "Dominio",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
