import type { Dict } from "./lang";

// Green.chz's site copy.

export default {
  "providers.greenchz.navHome": () => "Home",
  "providers.greenchz.navSites": () => "Data centres",
  "providers.greenchz.navOrder": () => "Colocation",
  "providers.greenchz.navAccount": () => "Customer centre",
  "providers.greenchz.heroEarly": () => "Housing and colocation in Switzerland",
  "providers.greenchz.heroLate": () => "Swiss data centres for data that stays in Switzerland.",
  "providers.greenchz.text": (p) => `Our data centre near ${p.city} stores your data under Swiss law, on certified infrastructure powered by renewable energy.`,
  "providers.greenchz.cta": () => "Request an offer",
  "providers.greenchz.point1": () => "Swiss quality",
  "providers.greenchz.point1Text": () => "We build and run every site ourselves and keep your data in the country.",
  "providers.greenchz.point2": () => "Certified security",
  "providers.greenchz.point2Text": () => "Access control, redundant power and audits follow recognised standards.",
  "providers.greenchz.point3": () => "Renewable power",
  "providers.greenchz.point3Text": () => "Our data centres run on electricity from Swiss hydropower.",
  "providers.greenchz.footer": (p) => `© ${p.year} green.chz AG`,
} satisfies Dict;
