import type { Dict } from "../lang";

export default {
  "books.status.draft": () => "Rascunho",
  "books.ref.invoice": (p) => `Fatura ${p.number}`,
  "books.ref.hosting": () => "Alojamento",
  "books.ref.server": () => "Servidor",
  "books.ref.domain": () => "Domínio",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
