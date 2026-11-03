import { euroCents } from "../../sim/00-core/money";
import { LOCALE, type Dict, type Params } from "../lang";
const kwh = (p: Params) => Number(p.kwh).toLocaleString(LOCALE);
const ct = (p: Params) => Number(p.ct).toLocaleString(LOCALE, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

export default {
  "ledger.powerUse": (p) => `Électricité ${p.location} : ${kwh(p)} kWh à ${ct(p)} ct/kWh`,
  "ledger.dcPower": (p) => `Électricité au compteur ${p.location} : ${kwh(p)} kWh à ${ct(p)} ct/kWh`,
  "ticket.mail.cardPaid.subject": (p) => `Facture ${p.number}`,
  "ticket.mail.cardPaid.text": (p) => `Veuillez trouver ci-joint notre facture ${p.number} de ${euroCents(Number(p.amount))}. Nous avons débité le montant sur votre carte de crédit.`,
  "error.payMethod": () => 'Choisissez virement, carte de crédit ou prélèvement.',
  "error.debitAbroad": () => 'Le prélèvement est réservé aux fournisseurs allemands.',
  "error.payNoCard": () => "Le compte n'a pas de carte de crédit.",
  "accounts.myAccount": () => 'Mon compte',
  "accounts.portal": () => 'Espace client',
  "accounts.payMethod": () => 'Mode de paiement',
  "accounts.pay.transfer": () => 'Facture (virement)',
  "accounts.pay.card": () => 'Carte de crédit',
  "accounts.pay.debit": () => 'Prélèvement SEPA',
  "accounts.germanyOnly": () => 'Allemagne uniquement',
  "accounts.invoices": () => 'Factures',
  "accounts.issued": () => 'Date',
  "accounts.contract": () => 'Contrat',
  "accounts.customerNo": () => 'Numéro client',
  "accounts.customer": () => 'Client',
  "accounts.address": () => 'Adresse de livraison',
  "accounts.points": () => 'Points de livraison',
  "accounts.point": () => 'Point de livraison',
  "accounts.tariff": () => 'Tarif',
  "accounts.price": () => "Prix de l'énergie",
  "accounts.usage": () => 'Consommation',
  "accounts.period": () => 'Période',
  "accounts.thisMonth": () => 'Mois en cours',
  "accounts.noUsage": () => 'Aucune consommation',
  "accounts.eoff.power": () => 'Électricité',
  "accounts.eoff.hero": () => "L'électricité pour votre entreprise",
  "accounts.eoff.tariff": () => 'E.OFF Business Power',
} satisfies Dict;
