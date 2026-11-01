import { euro, euroCents } from "../sim/00-core/money";
import { dateOf } from "../sim/00-core/time";
import { LOCALE } from "./lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "sole trader", partnership: "partnership", limited: "limited company" };
const pay = (p: Params) => `Please transfer ${euroCents(Number(p.amount))} by ${day(p.due)} to ${p.iban ? `IBAN ${p.iban}` : `account ${p.account}, bank code ${p.code}`}, quoting reference ${p.number}.`;

// Company paperwork the sim writes: application forms, letters, the answers to the player's emails, fees and errors.
export const PAPERWORK_EN: Record<string, (p: Params) => string> = {
  "doc.form.partnership": () => "Change of registration GA-2.pdf",
  "doc.form.limited": () => "Articles of association.pdf",
  "error.notRegistered": () => "The company is not registered yet.",
  "error.legalFormDown": () => "A legal form can only be changed to a higher one.",
  "error.changePending": () => "A change of legal form is already in progress.",
  "error.formSigned": () => "This form is already signed.",
  "error.mailAddress": () => "Enter a valid email address.",
  "error.unknownLetter": () => "This letter no longer exists.",
  "ledger.tradeRegistration": () => "Trade registration fee",
  "ledger.tradeChange": () => "Change of trade registration fee",
  "ledger.notary": () => "Notary fee, articles of association",
  "ledger.registerEntry": () => "Commercial register entry fee",
  "ledger.chamber": (p) => `Chamber of commerce basic fee ${p.year}`,
  "sim.index.cat.government": () => "Government",
  "sim.index.office": () => "Register a business or change its legal form.",
  "browser-sites-1.ix.title": () => "Yahoy! Directory",

  "letter.officeRegistered.subject": (p) => `Trade registration no. GA ${p.reg}`,
  "letter.officeRegistered.body": (p) => `We confirm the registration of ${p.name} under number GA ${p.reg}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Change of trade registration",
  "letter.officeChange.body": (p) => `We confirm that ${p.name} is registered as a ${FORM[p.form] ?? p.form} from today. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Invoice ${p.number}`,
  "letter.notaryInvoice.body": (p) => `For notarising the articles of association of ${p.name} and filing them with the commercial register we charge ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Entry in the commercial register",
  "letter.registerEntry.body": (p) => `${p.name} has been entered in the commercial register as a ${FORM[p.form] ?? p.form}. The entry takes effect today. Our invoice for the entry follows separately.`,
  "letter.registerInvoice.subject": (p) => `Invoice ${p.number}`,
  "letter.registerInvoice.body": (p) => `For the entry of ${p.name} in the commercial register we charge ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Membership fee ${p.year}`,
  "letter.chamberFee.body": (p) => `As a registered business, ${p.name} is a member of the chamber of commerce. With ${p.staff} employees, your basic fee for ${p.year} is ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Undelivered mail returned to sender",
  "ticket.mail.bounce.text": (p) => `Your message to ${p.to} could not be delivered. The address does not exist.`,
  "ticket.mail.noForm.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.noForm.text": () => "Thank you for your message. We could not find an application in the attachment. Please attach the signed form.",
  "ticket.mail.wrongDesk.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Thank you for your message. We do not handle this application. Please send it to the address given on the form.",
  "ticket.mail.unsigned.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Thank you for your application. The form is not signed. Please sign it and send it again.",
  "ticket.mail.capital.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Thank you for the signed articles of association. A limited company needs a share capital of ${euro(Number(p.amount))} in its account before we can file it. Please send the articles again once the capital is in place.`,
  "ticket.mail.notaryFiled.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Thank you for the signed articles of association of ${p.name}. We will file them with the commercial register within ${p.days} working days. The register confirms the entry by letter.`,
  "ticket.mail.officeReceived.subject": (p) => `Re: ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `We have received the change of registration for ${p.name}. You will receive our confirmation by letter within ${p.days} working days.`,
};
