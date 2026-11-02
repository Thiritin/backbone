import type { Dict } from "./lang";

export default {
  "cl.forSale": () => "for sale",
  "cl.all": () => "computer parts",
  "cl.max": () => "Max price",
  "cl.sort": () => "Sort",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "posting" : "postings"}`,
  "cl.posted": (p) => `Posted: ${p.date}`,
  "cl.notFound": () => "This posting has been deleted.",
} satisfies Dict;
