import type { Dict } from "./lang";

// NTD's site copy.

export default {
  "providers.ntd.navSites": () => "Data centers",
  "providers.ntd.navOrder": () => "Colocation",
  "providers.ntd.navAccount": () => "Customer portal",
  "providers.ntd.global": () => "Global site",
  "providers.ntd.sitemap": () => "Sitemap",
  "providers.ntd.division": () => "Global Data Centers",
  "providers.ntd.heroEarly": () => "Reliable data center services from the NTD group",
  "providers.ntd.heroLate": () => "Data centers for a connected future",
  "providers.ntd.text": (p) => `${p.n} data centers in ${p.cities} cities, run to the standards of one of the world's largest telecommunications groups.`,
  "providers.ntd.cta": () => "Find a data center",
  "providers.ntd.news": () => "What's new",
  "providers.ntd.news1": () => "Additional power capacity is now available in our Berlin data center.",
  "providers.ntd.news2": () => "NTD renews its ISO 27001 certification for all German sites.",
  "providers.ntd.news3": () => "Cross-connects to the local Internet exchange can now be ordered online.",
  "providers.ntd.services": () => "Services",
  "providers.ntd.svc1": () => "Colocation",
  "providers.ntd.svc1Text": () => "Rack space, cages and suites with A and B power feeds.",
  "providers.ntd.svc2": () => "Connectivity",
  "providers.ntd.svc2Text": () => "Carrier-neutral meet-me rooms connect you to every carrier on site.",
  "providers.ntd.svc3": () => "Managed services",
  "providers.ntd.svc3Text": () => "Remote hands and monitoring are provided by our on-site staff.",
  "providers.ntd.explore": () => "Explore the campus",
  "providers.ntd.footer": (p) => `© ${p.year} NTD Corporation`,
} satisfies Dict;
