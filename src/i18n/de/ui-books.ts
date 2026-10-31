import type { Dict } from "../lang";

export default {
  "books.status.draft": () => "Entwurf",
  "books.ref.invoice": (p) => `Rechnung ${p.number}`,
  "books.ref.hosting": () => "Hosting",
  "books.ref.server": () => "Server",
  "books.ref.domain": () => "Domain",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
