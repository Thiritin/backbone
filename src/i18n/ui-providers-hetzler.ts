import type { Dict } from "./lang";

// Hetzler's site copy.

export default {
  "providers.hetzler.overview": () => "Overview",
  "providers.hetzler.robot": () => "Rowbot login",
  "providers.hetzler.colocation": () => "Colocation",
  "providers.hetzler.heroEarly": () => "Colocation in our own data centers",
  "providers.hetzler.textEarly": (p) => `Bring your own servers to ${p.cities}. Rack space with power and traffic starts at ${p.price} a month.`,
  "providers.hetzler.vat": () => "All prices are monthly and include VAT. Invoices are paid by direct debit on the first of the month.",
  "providers.hetzler.heroLate": () => "Your hardware in our data centers",
  "providers.hetzler.textLate": (p) => `Rack space in ${p.cities} with power, cooling and redundant connectivity.`,
  "providers.hetzler.from": (p) => `from ${p.price} a month`,
  "providers.hetzler.orderNow": () => "Order now",
  "providers.hetzler.footer": (p) => `© ${p.year} Hetzler Online GmbH, Gunzenhausen`,
} satisfies Dict;
