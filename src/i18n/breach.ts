import { euro } from "../sim/00-core/money";

type Params = Record<string, string | number>;

// Breaches, ransom and fines (economy.md, Security advisories, Breaches and ransom).
export const BREACH_EN: Record<string, (p: Params) => string> = {
  "event.breach.title": () => "Customer data stolen",
  "event.breach.text": (p) => `Attackers copied the customer data on ${p.host} and demand ${euro(Number(p.ransom))} within ${p.hours} hours.`,
  "event.breachPress.title": () => "Data breach in the press",
  "event.breachPress.text": (p) => `Tech sites report that customer data from ${p.host} is for sale online. ${p.customers} ${Number(p.customers) === 1 ? "customer was" : "customers were"} affected.`,
  "event.breachFine.title": () => "Data protection fine",
  "event.breachFine.text": (p) => `The data protection authority fined the company ${euro(Number(p.amount))} for the breach on ${p.host}.`,
  "ticket.extortion.data.subject": () => "Your customer data is for sale",
  "ticket.extortion.data.text": (p) =>
    `We hold the customer data from ${p.host} and have listed it for sale online. Send ${euro(Number(p.ransom))} within 72 hours and we take the listing down. After that the highest bidder gets everything.`,
  "ledger.ransom": (p) => `Ransom for ${p.host}`,
  "ledger.fine": (p) => `Data protection fine for ${p.host}`,
  "outcome.ransomPaid": () => "Ransom paid",
  "outcome.ransomRefused": () => "Ransom refused",
};
