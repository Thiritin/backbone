import type { Dict } from "../lang";

export default {
  "providers.mainqubes.navHome": () => `Home`,
  "providers.mainqubes.navSites": () => `Data center`,
  "providers.mainqubes.navColo": () => `Colocation`,
  "providers.mainqubes.navPortal": () => `Area clienti`,
  "providers.mainqubes.heroEarly": (p) => `Il vostro data center a ${p.cities}`,
  "providers.mainqubes.textEarly": (p) => `Spazio rack da poche unità a una suite privata, da ${p.price} al mese, con ${p.carriers} operatori nell'edificio e tecnici propri in sede.`,
  "providers.mainqubes.heroLate": () => `Colocation sicura`,
  "providers.mainqubes.textLate": (p) => `Spazi ad alta sicurezza a ${p.cities}, certificati, carrier-neutral e collegati a ${p.carriers} operatori.`,
  "providers.mainqubes.cta": () => `Richiedi un'offerta`,
  "providers.mainqubes.more": () => `Dettagli`,
  "providers.mainqubes.from": (p) => `da ${p.price} / mese`,
  "providers.mainqubes.certified": () => `Certificato`,
  "providers.mainqubes.footer": (p) => `© ${p.year} mainqubes GmbH`,
} satisfies Dict;
