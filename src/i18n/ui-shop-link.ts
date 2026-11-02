import type { Dict } from "./lang";

// The Shop link module on the shop vendors' sites, Import from shop in Books, the shop's own records and gateway payouts.
export default {
  "vendor-sites.module.shop-link": () => "Shop link",
  "vendor-sites.pitch.shop-link": () => "Shop link copies every customer and invoice from your shop into Lexwear Office as it is created and marks an invoice paid in the shop once Books books its payment.",
  "ledger.module.shop-link": () => "Shop link licence",
  "ticket.mail.shop-link.licence.subject": (p) => `Your licence key for ${p.module}`,
  "ticket.mail.shop-link.licence.text": (p) => `Thank you for buying ${p.module} for ${p.shop}. Your licence key is ${p.key}. Enter it under Register in Books to connect your shop.`,
  "shop-link.ref.payout": (p) => `Payout ${p.numbers}`,
  "error.payoutImport": () => "This payout covers several invoices.",
  "error.nothingToImport": () => "There is nothing to import.",
  "error.noShopSystem": () => "You need this vendor's shop system for this module.",
  "shop-link.import": () => "Import from shop",
  "shop-link.footer": (p) => `© ${p.year} ${p.maker}`,
  "shop-link.tagline.modemBill": () => "Billing and provisioning for web hosts",
  "shop-link.tagline.clientExit": () => "Client management and billing for hosting companies",
  "shop-link.tagline.whmCache": () => "Billing and automation for web hosts",
  "shop-link.tagline.blessta": () => "Open-code billing for hosting companies",
  "shop-link.tagline.hostBull": () => "Billing for every kind of hosting",
  "shop-link.tagline.ubersmyth": () => "Billing for dedicated server and colocation providers",
  "shop-link.tagline.orderBocks": () => "Sell domains and hosting with no upfront cost",
  "shop-link.tagline.boxBillin": () => "Free and open billing for hosting companies",
} satisfies Dict;
