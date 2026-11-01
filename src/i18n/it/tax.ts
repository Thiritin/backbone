import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { day, period } from "../tax";

type Params = Record<string, string | number>;
const pay = (p: Params) => `Vi preghiamo di bonificare ${euroCents(Number(p.amount))} entro il ${day(p.due)} su ${p.iban ? `IBAN ${p.iban}` : `conto ${p.account}, codice banca ${p.code}`}, indicando il riferimento ${p.number}.`;
const PERIOD: Record<string, string> = {"month": "presenta la liquidazione IVA ogni mese, entro il 10 del mese successivo", "quarter": "presenta la liquidazione IVA ogni trimestre, entro il 10 del mese dopo il trimestre", "year": "non presenta liquidazioni periodiche e regola l'IVA con la dichiarazione annuale", "none": "non applica l'IVA e non presenta liquidazioni periodiche"};

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
  "letter.taxSurcharge.subject": () => "Sanzione per ritardata presentazione",
  "letter.taxSurcharge.body": (p) => `Codice fiscale ${p.taxNo}. La liquidazione IVA per ${period(p)} era dovuta il ${day(p.deadline)} e non ci è pervenuta. Applichiamo una sanzione per ritardata presentazione di ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `Stima dell'IVA per ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Codice fiscale ${p.taxNo}. La liquidazione IVA per ${period(p)} non è ancora stata presentata, perciò abbiamo stimato l'IVA in ${euroCents(Number(p.amount))}. La presentazione della liquidazione sostituisce questa stima. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "Fine del regime delle piccole imprese",
  "letter.taxSmallEnd.body": (p) => `Il fatturato di ${p.name} lo scorso anno è stato di ${euro(Number(p.revenue))}, oltre il limite di ${euro(Number(p.limit))}. Dal 1° gennaio ${p.year} l'impresa applica l'IVA e presenta le liquidazioni periodiche.`,
  "letter.taxPeriod.subject": (p) => `Periodo IVA ${p.year}`,
  "letter.taxPeriod.body": (p) => `Dal 1° gennaio ${p.year}, ${p.name} ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Liquidazione IVA ${period(p)}`,
  "ledger.vatEstimate": (p) => `Stima IVA ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Sanzione per ritardo ${period(p)}`,
  "error.taxNumber": () => "L'impresa non ha ancora un codice fiscale.",
  "error.taxReturn": () => "Questa dichiarazione non esiste.",
  "error.taxNotSmall": () => "L'impresa non usa il regime delle piccole imprese.",
  "error.taxReturnFiled": () => "Questa dichiarazione è già stata presentata.",
} satisfies Dict;
