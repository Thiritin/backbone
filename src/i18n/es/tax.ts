import type { Dict } from "../lang";
import { euro } from "../../sim/00-core/money";

export default {
  "letter.taxQuestionnaire.subject": () => "Cuestionario de alta fiscal",
  "letter.taxQuestionnaire.body": (p) => `La oficina de comercio nos ha comunicado que ${p.name} ha iniciado una actividad. Rellene el cuestionario de alta fiscal en DOHLE, en www.dohle.de/erfassung/. Una empresa cuya facturación no supere ${euro(Number(p.limit))} al año puede acogerse al régimen de pequeña empresa y no cobrar IVA.`,
  "letter.taxNumber.subject": (p) => `Su número fiscal ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} está registrada con el número fiscal ${p.number}. Indíquelo en cada declaración y carta. ${p.period === "none" ? "Como pequeña empresa no cobra IVA ni presenta declaraciones previas de IVA." : "Presente la declaración previa de IVA de cada mes antes del día 10 del mes siguiente."}`,
  "sim.index.dohle": () => "Presentar declaraciones de impuestos en línea.",
  "error.taxNoQuestionnaire": () => "El cuestionario de Hacienda aún no ha llegado.",
  "error.taxAnswered": () => "El cuestionario ya se ha enviado.",
  "error.taxRevenue": () => "Introduzca la facturación prevista.",
  "error.taxSmallLimit": () => "La facturación prevista supera el límite del régimen de pequeña empresa.",
} satisfies Dict;
