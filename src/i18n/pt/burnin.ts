import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.burninQuick.title": () => "Teste de burn-in rápido terminado",
  "event.burninQuick.text": (p) => `${p.device} terminou um teste de burn-in rápido e tem ${p.found} ${Number(p.found) === 1 ? "peça gasta" : "peças gastas"}.`,
  "event.burninFull.title": () => "Teste de burn-in completo terminado",
  "event.burninFull.text": (p) => (Number(p.found) ? `${p.device} terminou um teste de burn-in completo e ${Number(p.found) === 1 ? "falhou" : "falharam"} ${p.found} ${Number(p.found) === 1 ? "peça" : "peças"}.` : `${p.device} passou num teste de burn-in completo.`),
  "event.burninAborted.title": () => "Teste de burn-in interrompido",
  "event.burninAborted.text": (p) => `${p.device} ficou sem energia durante o teste de burn-in.`,
  "event.usedRefund.title": () => "Proteção do comprador paga",
  "event.usedRefund.text": (p) => `Uma peça de ${p.device} falhou nos 14 dias seguintes à compra e voltaram ${euro(Number(p.amount))}.`,
  "ledger.usedRefund": (p) => `Reembolso da proteção do comprador por ${p.device}`,
  "error.burninNoServer": () => "Só um servidor montado em rack pode fazer um teste de burn-in.",
  "error.burninRunning": () => "Já está a decorrer um teste de burn-in.",
  "error.burninNoPower": () => "O servidor tem de estar ligado e com energia.",
  "error.burninTaken": () => "O servidor está em uso.",
} satisfies Dict;
