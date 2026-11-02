import type { Dict } from "./lang";

// Spree Colo's site copy.

export default {
  "providers.spree.navHome": () => "Start",
  "providers.spree.navSites": () => "Data center",
  "providers.spree.navOrder": () => "Prices and order",
  "providers.spree.navAccount": () => "Customer login",
  "providers.spree.tagline": (p) => `Colocation from ${p.city}`,
  "providers.spree.news": () => "News",
  "providers.spree.news1": () => "Our second UPS is installed and running.",
  "providers.spree.news2": () => "We now also rent single height units.",
  "providers.spree.heroEarly": () => "Welcome to Spree Colo",
  "providers.spree.textEarly": () => "We run a small data center by the river and rent rack space to companies, developers and anyone who needs a server online. You talk directly to the technicians who look after your rack.",
  "providers.spree.from": (p) => `Rack space from ${p.price} a month`,
  "providers.spree.heroLate": (p) => `Your rack in ${p.city}`,
  "providers.spree.textLate": () => "We are an independent colocation provider with our own data center, short distances and technicians you know by name.",
  "providers.spree.feat1": () => "Independent",
  "providers.spree.feat1Text": () => "We belong to no group, so decisions are made in the building where your server runs.",
  "providers.spree.feat2": () => "Personal",
  "providers.spree.feat2Text": () => "You call us and reach the technicians who installed your rack.",
  "providers.spree.feat3": () => "Fair prices",
  "providers.spree.feat3Text": () => "Every price is listed on the site, and you sign month to month.",
  "providers.spree.footer": (p) => `© ${p.year} Spree Colo GmbH`,
} satisfies Dict;
