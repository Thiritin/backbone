import type { Dict } from "../lang";

export default {
  "shop-orders.any": () => "Toutes",
  "shop-orders.number": () => "Commande n°",
  "shop-orders.payment": () => "Statut du paiement",
  "shop-orders.invoice": () => "Facture n°",
  "shop-orders.fraud": () => "Marquer comme fraude",
  "error.unknownOrder": () => "Cette commande n'existe pas.",
  "error.orderNotPending": () => "Cette commande n'est plus en attente.",
  "error.noShopModule": () => "La boutique n'a pas de module pour ce serveur.",
  "error.manualProduct": () => "Ce produit n'a pas de groupe de serveurs.",
  "error.orderInvoiced": () => "Cette commande est déjà configurée à la main dans le Support.",
} satisfies Dict;
