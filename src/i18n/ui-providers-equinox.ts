import type { Dict } from "./lang";

// Equinox's site copy.

export default {
  "providers.equinox.navSites": () => "IBX data centers",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Customer Portal",
  "providers.equinox.ibx": () => "IBX centers",
  "providers.equinox.heroEarly": () => "Network-neutral data centers and Internet exchange services",
  "providers.equinox.heroLate": () => "The world's interconnection company",
  "providers.equinox.text": (p) => `${p.n} International Bandwidth Exchange centers in ${p.cities} cities, where carriers, content providers and enterprises meet under one roof.`,
  "providers.equinox.cta": () => "Find a data center",
  "providers.equinox.col1": () => "Certified and redundant",
  "providers.equinox.col1Text": () => "Every site runs on A and B feeds with generators and audited security.",
  "providers.equinox.col2": () => "Interconnection on site",
  "providers.equinox.col2Text": () => "Cross-connect to the exchange in the building and to every carrier in the meet-me room.",
  "providers.equinox.col3": () => "Remote hands around the clock",
  "providers.equinox.col3Text": () => "Technicians are on site day and night and bill by the hour with your rent.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. All rights reserved.`,
} satisfies Dict;
