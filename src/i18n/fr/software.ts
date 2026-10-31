import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Un logiciel de cette machine utilise déjà l'un de ses ports.",
  "error.wrongOs": () => "Ce logiciel ne tourne pas sur le système d'exploitation de cette machine.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${Number(p.count) < 2 ? "machine" : "machines"}`,
  "ledger.licenseOnce": (p) => `Licence ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
