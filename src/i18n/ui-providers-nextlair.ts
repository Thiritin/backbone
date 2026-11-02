import type { Dict } from "./lang";

// Next Lair's site copy.

export default {
  "providers.nextlair.navHome": () => "Home",
  "providers.nextlair.navSites": () => "Data center",
  "providers.nextlair.navOrder": () => "Housing",
  "providers.nextlair.navAccount": () => "Customer portal",
  "providers.nextlair.tagline": () => "Internet · Data · Vienna",
  "providers.nextlair.news": () => "News",
  "providers.nextlair.news1": () => "Our data center now peers directly at the Vienna Internet exchange.",
  "providers.nextlair.news2": () => "New racks with A and B feeds are ready to move into.",
  "providers.nextlair.hotline": () => "Hotline",
  "providers.nextlair.hotlineText": () => "Our network operations center answers around the clock on +43 1 890 40 00.",
  "providers.nextlair.heroEarly": () => "Server housing and connectivity from Vienna",
  "providers.nextlair.heroLate": (p) => `Your infrastructure in ${p.city}, on our network`,
  "providers.nextlair.text": (p) => `Next Lair runs its own data center and backbone in ${p.city}, so your servers sit one hop from Austria's carriers.`,
  "providers.nextlair.svc1": () => "Housing",
  "providers.nextlair.svc1Text": () => "Single units, shared racks and private suites for your hardware.",
  "providers.nextlair.svc2": () => "Connectivity",
  "providers.nextlair.svc2Text": () => "Transit and peering run over our own fibre ring through the city.",
  "providers.nextlair.svc3": () => "Service",
  "providers.nextlair.svc3Text": () => "Our technicians in Vienna handle remote hands at short notice.",
  "providers.nextlair.cta": () => "Request housing",
  "providers.nextlair.footer": (p) => `© ${p.year} Next Lair Telecom Service GmbH`,
} satisfies Dict;
