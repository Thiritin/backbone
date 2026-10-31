import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.burninQuick.title": () => "Burn-in test rapido terminato",
  "event.burninQuick.text": (p) => `${p.device} ha terminato un burn-in test rapido e ha ${p.found} ${Number(p.found) === 1 ? "componente usurato" : "componenti usurati"}.`,
  "event.burninFull.title": () => "Burn-in test completo terminato",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} ha terminato un burn-in test completo e ${p.found} ${Number(p.found) === 1 ? "componente si è guastato" : "componenti si sono guastati"}.` : `${p.device} ha superato un burn-in test completo.`),
  "event.burninAborted.title": () => "Burn-in test interrotto",
  "event.burninAborted.text": (p) => `${p.device} ha perso l'alimentazione durante il burn-in test.`,
  "event.usedRefund.title": () => "Protezione acquirente pagata",
  "event.usedRefund.text": (p) => `Un componente di ${p.device} si è guastato entro 14 giorni dall'acquisto e sono tornati ${euro(Number(p.amount))}.`,
  "ledger.usedRefund": (p) => `Rimborso protezione acquirente per ${p.device}`,
  "error.burninNoServer": () => "Solo un server montato in rack può fare il burn-in test.",
  "error.burninRunning": () => "Un burn-in test è già in corso.",
  "error.burninNoPower": () => "Il server deve essere acceso e alimentato.",
  "error.burninTaken": () => "Il server è in uso.",
} satisfies Dict;
