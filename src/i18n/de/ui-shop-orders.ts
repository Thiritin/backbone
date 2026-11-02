import type { Dict } from "../lang";

export default {
  "shop-orders.any": () => "Alle",
  "shop-orders.status.pending": () => "Ausstehend",
  "shop-orders.status.active": () => "Aktiv",
  "shop-orders.status.fraud": () => "Betrug",
  "shop-orders.status.cancelled": () => "Storniert",
  "shop-orders.number": () => "Bestellnr.",
  "shop-orders.payment": () => "Zahlungsstatus",
  "shop-orders.invoice": () => "Rechnungsnr.",
  "shop-orders.fraud": () => "Als Betrug markieren",
  "error.unknownOrder": () => "Diese Bestellung gibt es nicht.",
  "error.orderNotPending": () => "Diese Bestellung ist nicht mehr ausstehend.",
  "error.noShopModule": () => "Der Shop hat kein Modul für diesen Server.",
  "error.manualProduct": () => "Dieses Produkt hat keine Servergruppe.",
  "error.orderInvoiced": () => "Diese Bestellung wird bereits im Support von Hand eingerichtet.",
} satisfies Dict;
