import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Un software su questa macchina usa già una delle sue porte.",
  "error.wrongOs": () => "Questo software non gira sul sistema operativo di questa macchina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "macchina" : "macchine"}`,
  "ledger.licenseOnce": (p) => `Licenza ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
