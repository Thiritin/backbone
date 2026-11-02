import type { Dict } from "../lang";

export default {
  "cl.forSale": () => "zu verkaufen",
  "cl.all": () => "Computerteile",
  "cl.max": () => "Höchstpreis",
  "cl.sort": () => "Sortierung",
  "cl.count": (p) => `${p.n} ${Number(p.n) === 1 ? "Anzeige" : "Anzeigen"}`,
  "cl.posted": (p) => `Eingestellt: ${p.date}`,
  "cl.notFound": () => "Diese Anzeige wurde gelöscht.",
} satisfies Dict;
