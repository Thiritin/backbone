import type { Dict } from "../lang";

export default {
  "vendor-sites.module.shop-link": () => "Liaison boutique",
  "vendor-sites.pitch.shop-link": () => "La liaison boutique copie chaque client et chaque facture de votre boutique dans Lexwear Office dès leur création et marque une facture payée dans la boutique dès que Books comptabilise son paiement.",
  "ledger.module.shop-link": () => "Licence Liaison boutique",
  "ticket.mail.shop-link.licence.subject": (p) => `Votre clé de licence pour ${p.module}`,
  "ticket.mail.shop-link.licence.text": (p) => `Merci d'avoir acheté ${p.module} pour ${p.shop}. Votre clé de licence est ${p.key}. Saisissez-la sous Enregistrer dans Books pour relier votre boutique.`,
  "shop-link.ref.payout": (p) => `Versement ${p.numbers}`,
  "error.payoutImport": () => "Ce versement couvre plusieurs factures.",
  "error.nothingToImport": () => "Il n'y a rien à importer.",
  "error.noShopSystem": () => "Ce module demande le système de boutique de cet éditeur.",
  "shop-link.import": () => "Importer depuis la boutique",
  "shop-link.footer": (p) => `© ${p.year} ${p.maker}`,
  "shop-link.tagline.modemBill": () => "Facturation et provisionnement pour hébergeurs web",
  "shop-link.tagline.clientExit": () => "Gestion des clients et facturation pour hébergeurs",
  "shop-link.tagline.whmCache": () => "Facturation et automatisation pour hébergeurs web",
  "shop-link.tagline.blessta": () => "Facturation à code ouvert pour hébergeurs",
  "shop-link.tagline.hostBull": () => "Facturation pour tout type d'hébergement",
  "shop-link.tagline.ubersmyth": () => "Facturation pour fournisseurs de serveurs dédiés et de colocation",
  "shop-link.tagline.orderBocks": () => "Vendez domaines et hébergement sans frais initiaux",
  "shop-link.tagline.boxBillin": () => "Facturation libre et ouverte pour hébergeurs",
} satisfies Dict;
