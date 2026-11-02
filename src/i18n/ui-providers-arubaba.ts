import type { Dict } from "./lang";

// Arubaba's site copy.

export default {
  "providers.arubaba.navHome": () => "Home",
  "providers.arubaba.navSites": () => "Data center",
  "providers.arubaba.navOrder": () => "Colocation",
  "providers.arubaba.clientArea": () => "Customer area",
  "providers.arubaba.heroEarly": () => "Colocation in our Italian data center",
  "providers.arubaba.heroLate": () => "Your servers in the Arubaba data center",
  "providers.arubaba.text": (p) => `Bring your servers to ${p.name} in ${p.city}: a certified data center with redundant power, fire suppression and staff on site day and night.`,
  "providers.arubaba.discover": () => "Discover the data center",
  "providers.arubaba.from": (p) => `from ${p.price}`,
  "providers.arubaba.perMonth": () => "per month + VAT",
  "providers.arubaba.buy": () => "Buy",
  "providers.arubaba.vat": () => "Prices exclude VAT.",
  "providers.arubaba.footer": (p) => `© ${p.year} Arubaba S.p.A.`,
} satisfies Dict;
