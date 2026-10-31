import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.burninQuick.title": () => "Kurzer Burn-in beendet",
  "event.burninQuick.text": (p) => `${p.device} hat einen kurzen Burn-in beendet, ${p.found} ${Number(p.found) === 1 ? "Teil ist" : "Teile sind"} verschlissen.`,
  "event.burninFull.title": () => "Voller Burn-in beendet",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} hat einen vollen Burn-in beendet, ${p.found} ${Number(p.found) === 1 ? "Teil ist" : "Teile sind"} ausgefallen.` : `${p.device} hat einen vollen Burn-in bestanden.`),
  "event.burninAborted.title": () => "Burn-in abgebrochen",
  "event.burninAborted.text": (p) => `${p.device} hat während des Burn-ins den Strom verloren.`,
  "event.usedRefund.title": () => "Käuferschutz ausgezahlt",
  "event.usedRefund.text": (p) => `Ein Teil von ${p.device} ist innerhalb von 14 Tagen nach dem Kauf ausgefallen, und ${euro(Number(p.amount))} flossen zurück.`,
  "ledger.usedRefund": (p) => `Käuferschutz-Erstattung für ${p.device}`,
  "error.burninNoServer": () => "Nur ein eingebauter Server kann einem Burn-in unterzogen werden.",
  "error.burninRunning": () => "Ein Burn-in läuft bereits.",
  "error.burninNoPower": () => "Der Server muss laufen und Strom haben.",
  "error.burninTaken": () => "Der Server ist in Benutzung.",
} satisfies Dict;
