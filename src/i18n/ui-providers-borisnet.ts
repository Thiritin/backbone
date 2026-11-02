import type { Dict } from "./lang";

// Boris Network's site copy.

export default {
  "providers.borisnet.navHome": () => "Home",
  "providers.borisnet.navSites": () => "Data center",
  "providers.borisnet.navOrder": () => "Colocation",
  "providers.borisnet.navPortal": () => "Customer area",
  "providers.borisnet.claim": () => "IT infrastructure from Nuremberg",
  "providers.borisnet.here": () => "You are here:",
  "providers.borisnet.quick": () => "Quick links",
  "providers.borisnet.box": (p) => `${p.city}, ${p.carriers} carriers, ${p.exchange}.`,
  "providers.borisnet.heroEarly": () => "Housing and colocation in our own data center",
  "providers.borisnet.heroLate": () => "Your partner for secure IT infrastructure",
  "providers.borisnet.text": (p) => `We run ${p.name} in ${p.city} ourselves, with our own network and our own staff on site.`,
  "providers.borisnet.cta": () => "Request colocation",
  "providers.borisnet.services": () => "Our services",
  "providers.borisnet.tile1": () => "Housing",
  "providers.borisnet.tile1Text": () => "Rack units, full racks and cages with metered power.",
  "providers.borisnet.tile2": () => "Network",
  "providers.borisnet.tile2Text": () => "Redundant upstream links and direct access to the local exchange.",
  "providers.borisnet.tile3": () => "Operations",
  "providers.borisnet.tile3Text": () => "Our technicians install, replace and check your hardware on request.",
  "providers.borisnet.certs": () => "Certified to ISO 27001 and audited every year.",
  "providers.borisnet.footer": (p) => `© ${p.year} Boris Network AG`,
} satisfies Dict;
