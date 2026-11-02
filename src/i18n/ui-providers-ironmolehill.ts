import type { Dict } from "./lang";

// Iron Molehill's site copy.

export default {
  "providers.ironmolehill.navHome": () => `Overview`,
  "providers.ironmolehill.navSites": () => `Data centers`,
  "providers.ironmolehill.navColo": () => `Colocation`,
  "providers.ironmolehill.navPortal": () => `Account center`,
  "providers.ironmolehill.heroEarly": () => `Protect your servers with the company that protects your records`,
  "providers.ironmolehill.heroLate": () => `Data centers built for compliance`,
  "providers.ironmolehill.text": (p) => `Secure data centers in ${p.cities}, with guards, cameras and audited access around the clock.`,
  "providers.ironmolehill.cta": () => `Explore data centers`,
  "providers.ironmolehill.pillar1": () => `Secure`,
  "providers.ironmolehill.pillar1Text": () => `Layered physical security and a chain of custody for every visit.`,
  "providers.ironmolehill.pillar2": () => `Compliant`,
  "providers.ironmolehill.pillar2Text": () => `Audited every year against the standards your auditors ask for.`,
  "providers.ironmolehill.pillar3": () => `Connected`,
  "providers.ironmolehill.pillar3Text": () => `Carriers in the building and cross-connects ready within days.`,
  "providers.ironmolehill.trusted": () => `Audited for`,
  "providers.ironmolehill.footer": (p) => `© ${p.year} Iron Molehill Inc. All rights reserved.`,
} satisfies Dict;
