import type { Dict } from "./lang";

export default {
  "books.status.draft": () => "Draft",
  "books.ref.invoice": (p) => `Invoice ${p.number}`,
  "books.ref.hosting": () => "Hosting",
  "books.ref.server": () => "Server",
  "books.ref.domain": () => "Domain",
  "books.ref.name": (p) => `${p.name}`,
} satisfies Dict;
