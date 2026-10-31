import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "El software de esta máquina ya usa uno de sus puertos.",
  "error.wrongOs": () => "Este software no se ejecuta en el sistema operativo de esta máquina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "máquina" : "máquinas"}`,
  "ledger.licenseOnce": (p) => `Licencia de ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
