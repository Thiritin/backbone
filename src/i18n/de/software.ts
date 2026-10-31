import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "Software auf dieser Maschine belegt bereits einen ihrer Ports.",
  "error.wrongOs": () => "Diese Software läuft nicht auf dem Betriebssystem dieser Maschine.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "Maschine" : "Maschinen"}`,
  "ledger.licenseOnce": (p) => `${p.name}-Lizenz, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
