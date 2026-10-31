import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "O software desta máquina já usa uma das suas portas.",
  "error.wrongOs": () => "Este software não corre no sistema operacional desta máquina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "máquina" : "máquinas"}`,
  "ledger.licenseOnce": (p) => `Licença ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
