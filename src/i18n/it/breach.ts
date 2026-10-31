import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.breach.title": () => "Dati dei clienti rubati",
  "event.breach.text": (p) => `Degli attaccanti hanno copiato i dati dei clienti su ${p.host} e chiedono ${euro(Number(p.ransom))} entro ${p.hours} ore.`,
  "event.breachPress.title": () => "Violazione dei dati sulla stampa",
  "event.breachPress.text": (p) => `I siti tech riportano che i dati dei clienti di ${p.host} sono in vendita online. ${p.customers} ${Number(p.customers) === 1 ? "cliente è stato coinvolto" : "clienti sono stati coinvolti"}.`,
  "event.breachFine.title": () => "Multa per la protezione dei dati",
  "event.breachFine.text": (p) => `L'autorità per la protezione dei dati ha multato l'azienda di ${euro(Number(p.amount))} per la violazione su ${p.host}.`,
  "ticket.extortion.data.subject": () => "I dati dei tuoi clienti sono in vendita",
  "ticket.extortion.data.text": (p) =>
    `Abbiamo i dati dei clienti di ${p.host} e li abbiamo messi in vendita online. Invia ${euro(Number(p.ransom))} entro 72 ore e togliamo l'annuncio. Dopo, il miglior offerente prende tutto.`,
  "ledger.ransom": (p) => `Riscatto per ${p.host}`,
  "ledger.fine": (p) => `Multa per la protezione dei dati per ${p.host}`,
  "outcome.ransomPaid": () => "Riscatto pagato",
  "outcome.ransomRefused": () => "Riscatto rifiutato",
} satisfies Dict;
