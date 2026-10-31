import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.burninQuick.title": () => "Burn-in rápido terminado",
  "event.burninQuick.text": (p) => `${p.device} terminó un burn-in rápido y tiene ${p.found} ${Number(p.found) === 1 ? "pieza desgastada" : "piezas desgastadas"}.`,
  "event.burninFull.title": () => "Burn-in completo terminado",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} terminó un burn-in completo y ${Number(p.found) === 1 ? "falló" : "fallaron"} ${p.found} ${Number(p.found) === 1 ? "pieza" : "piezas"}.` : `${p.device} superó un burn-in completo.`),
  "event.burninAborted.title": () => "Burn-in cancelado",
  "event.burninAborted.text": (p) => `${p.device} se quedó sin corriente durante su burn-in.`,
  "event.usedRefund.title": () => "Protección del comprador abonada",
  "event.usedRefund.text": (p) => `Una pieza de ${p.device} falló en los 14 días siguientes a la compra y volvieron ${euro(Number(p.amount))}.`,
  "ledger.usedRefund": (p) => `Reembolso de protección del comprador por ${p.device}`,
  "error.burninNoServer": () => "Solo un servidor montado en rack puede pasar un burn-in.",
  "error.burninRunning": () => "Ya hay un burn-in en marcha.",
  "error.burninNoPower": () => "El servidor tiene que estar encendido y con energía.",
  "error.burninTaken": () => "El servidor está en uso.",
} satisfies Dict;
