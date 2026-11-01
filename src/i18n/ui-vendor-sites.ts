import type { Dict } from "./lang";

// Lexwear's site, its licence and newsletter emails, the Register dialog in Books and the bookkeeper's new tasks.
export default {
  "support.kind.mail": () => "Email",
  "ledger.module.helpdesk-link": () => "Lexwear Helpdesk link licence",
  "ledger.module.monthly-run": () => "Lexwear Monthly run licence",
  "ledger.module.match-by-reference": () => "Lexwear Match by reference licence",
  "ledger.module.hbci": () => "Lexwear HBCI online banking licence",
  "error.licenceKey": () => "This licence key is not valid.",
  "error.noTrial": () => "No trial is available for this software on this machine.",
  "error.moduleBought": () => "You have already bought this module.",
  "error.moduleRegistered": () => "This module is already registered.",
  "vendor-sites.taskInvoices": () => "Sending invoices",
  "vendor-sites.taskTransfers": () => "Matching payments",
  "vendor-sites.tagline": () => "Business software for small firms",
  "vendor-sites.navSupport": () => "Support",
  "vendor-sites.price": () => "Price",
  "vendor-sites.licence": () => "One-time licence",
  "vendor-sites.buy": () => "Buy",
  "vendor-sites.bought": () => "Bought",
  "vendor-sites.registered": () => "Registered",
  "vendor-sites.support": () => "Write to support@lexwear.de for help with your licence.",
  "vendor-sites.footer": (p) => `© ${p.year} Lexwear GmbH, Freiburg`,
  "vendor-sites.register": () => "Register",
  "vendor-sites.licenceKey": () => "Licence key",
  "vendor-sites.registeredAs": (p) => `${p.module} registered`,
  "vendor-sites.viewModule": () => "View module",
} satisfies Dict;
