import type { Dict } from "../lang";

export default {
  "shop-orders.any": () => "Tutti",
  "shop-orders.number": () => "Ordine n.",
  "shop-orders.payment": () => "Stato pagamento",
  "shop-orders.invoice": () => "Fattura n.",
  "shop-orders.fraud": () => "Segna come frode",
  "error.unknownOrder": () => "Questo ordine non esiste.",
  "error.orderNotPending": () => "Questo ordine non è più in attesa.",
  "error.noShopModule": () => "Il negozio non ha un modulo per questo server.",
  "error.manualProduct": () => "Questo prodotto non ha un gruppo di server.",
  "error.orderInvoiced": () => "Questo ordine è già in configurazione manuale nell'Assistenza.",
} satisfies Dict;
