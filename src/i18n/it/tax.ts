import type { Dict } from "../lang";
import { euro } from "../../sim/00-core/money";

export default {
  "letter.taxQuestionnaire.subject": () => "Questionario di registrazione fiscale",
  "letter.taxQuestionnaire.body": (p) => `L'ufficio del commercio ci ha comunicato che ${p.name} ha avviato un'attività. Compili il questionario di registrazione fiscale su DOHLE all'indirizzo www.dohle.de/erfassung/. Un'impresa il cui fatturato resta sotto ${euro(Number(p.limit))} l'anno può usare il regime delle piccole imprese e non applica l'IVA.`,
  "letter.taxNumber.subject": (p) => `Il suo codice fiscale ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} è registrata presso di noi con il codice fiscale ${p.number}. Lo indichi in ogni dichiarazione e lettera. ${p.period === "none" ? "Come piccola impresa non applica l'IVA e non presenta liquidazioni periodiche." : "Presenti la liquidazione IVA di ogni mese entro il 10 del mese successivo."}`,
  "sim.index.dohle": () => "Presentare le dichiarazioni fiscali online.",
  "error.taxNoQuestionnaire": () => "Il questionario dell'ufficio delle imposte non è ancora arrivato.",
  "error.taxAnswered": () => "Il questionario è già stato inviato.",
  "error.taxRevenue": () => "Inserisca il fatturato previsto.",
  "error.taxSmallLimit": () => "Il fatturato previsto supera il limite del regime delle piccole imprese.",
} satisfies Dict;
