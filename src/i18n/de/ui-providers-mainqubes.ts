import type { Dict } from "../lang";

export default {
  "providers.mainqubes.navHome": () => `Startseite`,
  "providers.mainqubes.navSites": () => `Rechenzentrum`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Kundenlogin`,
  "providers.mainqubes.heroEarly": (p) => `Ihr Rechenzentrum in ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `Rackfläche von wenigen Höheneinheiten bis zur eigenen Suite ab ${p.price} im Monat, mit ${p.carriers} Carriern im Haus und eigenen Technikern vor Ort.`,
  "providers.mainqubes.heroLate": () => `Secure Colocation`,
  "providers.mainqubes.textLate": (p) => `Hochsichere Rechenzentrumsfläche in ${p.cities}, zertifiziert, carrierneutral und an ${p.carriers} Carrier angebunden.`,
  "providers.mainqubes.cta": () => `Angebot anfordern`,
  "providers.mainqubes.more": () => `Details`,
  "providers.mainqubes.from": (p) => `ab ${p.price} / Monat`,
  "providers.mainqubes.certified": () => `Zertifiziert`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
