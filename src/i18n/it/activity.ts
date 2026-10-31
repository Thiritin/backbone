import { euroCents } from "../../sim/00-core/money";
import type { Dict, Params } from "../lang";

const KIND: Record<string, string> = {
  howTo: "ticket informativo", billing: "ticket di fatturazione", outage: "ticket di disservizio", upgrade: "ticket di upgrade", cancellation: "ticket di disdetta", abuse: "ticket di abuso",
  appeal: "ticket di ricorso", notice: "ticket di avviso", legal: "ticket legale", refund: "ticket di rimborso", order: "ticket d'ordine",
};
const RESOLVED: Record<string, string> = {
  credit: "Accreditato il 10% della fattura mensile", "retain.half": "Offerto il 50% di sconto sul mese successivo", "retain.free": "Offerto un mese gratis",
  "retain.d3": "Offerto il 20% di sconto per 3 mesi", "retain.d6": "Offerto il 20% di sconto per 6 mesi", "retain.d12": "Offerto il 20% di sconto per 12 mesi",
  "retain.upgrade": "Offerto un upgrade gratuito", "retain.fix": "Promessa una soluzione", "retain.move": "Offerto il trasferimento su un server migliore", cancel: "Disdetta elaborata",
  unsuspend: "Servizi riattivati con una proroga di pagamento", keep: "Servizi lasciati sospesi", forward: "Segnalazione di abuso inoltrata",
  takedown: "Contenuto rimosso", reject: "Richiesta respinta", comply: "Richiesta accolta", object: "Opposizione alla richiesta",
  refund: "Pagamento rimborsato", accept: "Ordine accettato", quote: "Preventivo inviato", account: "Account cliente creato",
  invoice: "Ordine confermato e fattura inviata", domain: "Dominio registrato", provision: "Servizio configurato",
};
const ticket = (p: Params) => KIND[p.kind] ?? "ticket";

export default {
  "activity.reply": (p) => `Risposto al ${ticket(p)}`,
  "activity.escalate": (p) => `Escalation del ${ticket(p)}`,
  "activity.resolve": (p) => RESOLVED[p.arg] ?? `Risolto il ${ticket(p)}`,
  "activity.checkInvoice": (p) => `Controllata la fattura ${p.invoice}`,
  "activity.reminder": (p) => `Inviato un promemoria di pagamento per la fattura ${p.invoice}`,
  "activity.sendInvoice": (p) => `Inviata la fattura ${p.invoice} in PDF`,
  "activity.dunning": (p) => `Inviato un sollecito per la fattura ${p.invoice}`,
  "activity.final": (p) => `Inviato l'ultimo sollecito per la fattura ${p.invoice}`,
  "activity.collections": (p) => `Fattura ${p.invoice} passata al recupero crediti`,
  "activity.suspend": (p) => `Servizi sospesi per la fattura ${p.invoice}`,
  "activity.unsuspend": (p) => `Servizi riattivati per la fattura ${p.invoice}`,
  "activity.writeOff": (p) => `Fattura ${p.invoice} stornata`,
  "activity.price": (p) => `Prezzo cambiato a ${euroCents(Number(p.price))} al mese`,
} satisfies Dict;
