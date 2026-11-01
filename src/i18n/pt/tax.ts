import type { Dict } from "../lang";
import { euro } from "../../sim/00-core/money";

export default {
  "letter.taxQuestionnaire.subject": () => "Questionário de registo fiscal",
  "letter.taxQuestionnaire.body": (p) => `O serviço de comércio informou-nos de que ${p.name} iniciou uma atividade. Preencha o questionário de registo fiscal no DOHLE, em www.dohle.de/erfassung/. Uma empresa cuja faturação fique abaixo de ${euro(Number(p.limit))} por ano pode usar o regime de pequena empresa e não cobra IVA.`,
  "letter.taxNumber.subject": (p) => `O seu número fiscal ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} está registada connosco com o número fiscal ${p.number}. Indique-o em todas as declarações e cartas. ${p.period === "none" ? "Como pequena empresa não cobra IVA nem entrega declarações periódicas." : "Entregue a declaração periódica de IVA de cada mês até ao dia 10 do mês seguinte."}`,
  "sim.index.dohle": () => "Entregar declarações fiscais online.",
  "error.taxNoQuestionnaire": () => "O questionário das Finanças ainda não chegou.",
  "error.taxAnswered": () => "O questionário já foi enviado.",
  "error.taxRevenue": () => "Introduza a faturação prevista.",
  "error.taxSmallLimit": () => "A faturação prevista excede o limite do regime de pequena empresa.",
} satisfies Dict;
