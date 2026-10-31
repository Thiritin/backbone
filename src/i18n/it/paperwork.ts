import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE } from "../lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "ditta individuale", partnership: "società di persone", limited: "SRL" };
const pay = (p: Params) => `Ti preghiamo di bonificare ${euroCents(Number(p.amount))} entro il ${day(p.due)} su ${p.iban ? `IBAN ${p.iban}` : `conto ${p.account}, codice banca ${p.code}`}, indicando il riferimento ${p.number}.`;

export default {
  "doc.form.partnership": () => "Variazione di iscrizione GA-2.pdf",
  "doc.form.limited": () => "Atto costitutivo.pdf",
  "error.notRegistered": () => "L'azienda non è ancora iscritta.",
  "error.legalFormDown": () => "Una forma giuridica può passare solo a una superiore.",
  "error.changePending": () => "Un cambio di forma giuridica è già in corso.",
  "error.formSigned": () => "Questo modulo è già firmato.",
  "error.mailAddress": () => "Inserisci un indirizzo email valido.",
  "error.unknownLetter": () => "Questa lettera non esiste più.",
  "ledger.tradeRegistration": () => "Diritti di iscrizione dell'attività",
  "ledger.tradeChange": () => "Diritti di variazione dell'attività",
  "ledger.notary": () => "Onorario notarile, atto costitutivo",
  "ledger.registerEntry": () => "Diritti di iscrizione nel registro delle imprese",
  "ledger.chamber": (p) => `Diritto annuale camera di commercio ${p.year}`,
  "sim.index.cat.government": () => "Pubblica amministrazione",
  "sim.index.office": () => "Iscrivi un'attività o cambia la sua forma giuridica.",
  "browser-sites-1.ix.title": () => "Directory Yahoy!",

  "letter.officeRegistered.subject": (p) => `Iscrizione attività n. GA ${p.number}`,
  "letter.officeRegistered.body": (p) => `Confermiamo l'iscrizione di ${p.name} con il numero GA ${p.number}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Variazione dell'iscrizione",
  "letter.officeChange.body": (p) => `Confermiamo che ${p.name} è iscritta come ${FORM[p.form] ?? p.form} da oggi. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Fattura ${p.number}`,
  "letter.notaryInvoice.body": (p) => `Per l'atto notarile dello statuto di ${p.name} e il deposito al registro delle imprese addebitiamo ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Iscrizione nel registro delle imprese",
  "letter.registerEntry.body": (p) => `${p.name} è stata iscritta nel registro delle imprese come ${FORM[p.form] ?? p.form}. L'iscrizione ha effetto da oggi. La nostra fattura per l'iscrizione segue a parte.`,
  "letter.registerInvoice.subject": (p) => `Fattura ${p.number}`,
  "letter.registerInvoice.body": (p) => `Per l'iscrizione di ${p.name} nel registro delle imprese addebitiamo ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Quota associativa ${p.year}`,
  "letter.chamberFee.body": (p) => `Come attività iscritta, ${p.name} è membro della camera di commercio. Con ${p.staff} dipendenti, il tuo diritto annuale per il ${p.year} è di ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Messaggio non recapitato restituito al mittente",
  "ticket.mail.bounce.text": (p) => `Il tuo messaggio a ${p.to} non è stato recapitato. L'indirizzo non esiste.`,
  "ticket.mail.noForm.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.noForm.text": () => "Grazie per il messaggio. Nell'allegato non abbiamo trovato alcuna domanda. Allega il modulo firmato.",
  "ticket.mail.wrongDesk.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Grazie per il messaggio. Questa domanda non è di nostra competenza. Inviala all'indirizzo indicato sul modulo.",
  "ticket.mail.unsigned.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Grazie per la domanda. Il modulo non è firmato. Firmalo e invialo di nuovo.",
  "ticket.mail.capital.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Grazie per l'atto costitutivo firmato. Una SRL ha bisogno di un capitale sociale di ${euro(Number(p.amount))} sul suo conto prima che possiamo depositarla. Invia di nuovo l'atto quando il capitale è disponibile.`,
  "ticket.mail.notaryFiled.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Grazie per l'atto costitutivo firmato di ${p.name}. Lo depositeremo al registro delle imprese entro ${p.days} giorni lavorativi. Il registro confermerà l'iscrizione per lettera.`,
  "ticket.mail.officeReceived.subject": (p) => `R: ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `Abbiamo ricevuto la variazione di iscrizione di ${p.name}. Riceverai la nostra conferma per lettera entro ${p.days} giorni lavorativi.`,
} satisfies Dict;
