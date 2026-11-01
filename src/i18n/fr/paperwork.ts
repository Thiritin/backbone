import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE } from "../lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "entreprise individuelle", partnership: "société de personnes", limited: "SARL" };
const pay = (p: Params) => `Merci de virer ${euroCents(Number(p.amount))} avant le ${day(p.due)} sur ${p.iban ? `l'IBAN ${p.iban}` : `le compte ${p.account}, code banque ${p.code}`}, avec la référence ${p.number}.`;

export default {
  "doc.form.partnership": () => "Modification d'immatriculation GA-2.pdf",
  "doc.form.limited": () => "Statuts.pdf",
  "error.notRegistered": () => "L'entreprise n'est pas encore immatriculée.",
  "error.legalFormDown": () => "Une forme juridique ne peut passer qu'à une forme supérieure.",
  "error.changePending": () => "Un changement de forme juridique est déjà en cours.",
  "error.formSigned": () => "Ce formulaire est déjà signé.",
  "error.mailAddress": () => "Saisis une adresse e-mail valide.",
  "error.unknownLetter": () => "Cette lettre n'existe plus.",
  "ledger.tradeRegistration": () => "Frais d'immatriculation",
  "ledger.tradeChange": () => "Frais de modification d'immatriculation",
  "ledger.notary": () => "Frais de notaire, statuts",
  "ledger.registerEntry": () => "Frais d'inscription au registre du commerce",
  "ledger.chamber": (p) => `Cotisation de base à la chambre de commerce ${p.year}`,
  "sim.index.cat.government": () => "Administration",
  "sim.index.office": () => "Immatricule une entreprise ou change sa forme juridique.",
  "browser-sites-1.ix.title": () => "Annuaire Yahoy!",

  "letter.officeRegistered.subject": (p) => `Immatriculation n° GA ${p.reg}`,
  "letter.officeRegistered.body": (p) => `Nous confirmons l'immatriculation de ${p.name} sous le numéro GA ${p.reg}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Modification d'immatriculation",
  "letter.officeChange.body": (p) => `Nous confirmons que ${p.name} est immatriculée en tant que ${FORM[p.form] ?? p.form} à compter d'aujourd'hui. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Facture ${p.number}`,
  "letter.notaryInvoice.body": (p) => `Pour l'authentification des statuts de ${p.name} et leur dépôt au registre du commerce, nous facturons ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Inscription au registre du commerce",
  "letter.registerEntry.body": (p) => `${p.name} est inscrite au registre du commerce en tant que ${FORM[p.form] ?? p.form}. L'inscription prend effet aujourd'hui. Notre facture pour l'inscription suit séparément.`,
  "letter.registerInvoice.subject": (p) => `Facture ${p.number}`,
  "letter.registerInvoice.body": (p) => `Pour l'inscription de ${p.name} au registre du commerce, nous facturons ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Cotisation ${p.year}`,
  "letter.chamberFee.body": (p) => `En tant qu'entreprise immatriculée, ${p.name} est membre de la chambre de commerce. Avec ${p.staff} salariés, votre cotisation de base pour ${p.year} s'élève à ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Message non distribué renvoyé à l'expéditeur",
  "ticket.mail.bounce.text": (p) => `Votre message à ${p.to} n'a pas pu être distribué. L'adresse n'existe pas.`,
  "ticket.mail.noForm.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.noForm.text": () => "Merci pour votre message. Nous n'avons trouvé aucune demande en pièce jointe. Veuillez joindre le formulaire signé.",
  "ticket.mail.wrongDesk.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Merci pour votre message. Cette demande ne relève pas de notre service. Veuillez l'envoyer à l'adresse indiquée sur le formulaire.",
  "ticket.mail.unsigned.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Merci pour votre demande. Le formulaire n'est pas signé. Veuillez le signer et le renvoyer.",
  "ticket.mail.capital.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Merci pour les statuts signés. Une SARL a besoin d'un capital social de ${euro(Number(p.amount))} sur son compte avant que nous puissions la déposer. Veuillez renvoyer les statuts quand le capital est disponible.`,
  "ticket.mail.notaryFiled.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Merci pour les statuts signés de ${p.name}. Nous les déposerons au registre du commerce sous ${p.days} jours ouvrés. Le registre confirmera l'inscription par courrier.`,
  "ticket.mail.officeReceived.subject": (p) => `RE : ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `Nous avons reçu la modification d'immatriculation de ${p.name}. Vous recevrez notre confirmation par courrier sous ${p.days} jours ouvrés.`,
} satisfies Dict;
