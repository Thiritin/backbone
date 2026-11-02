import type { Dict } from "../lang";

export default {
  "providers.myloch.navHome": () => "Home",
  "providers.myloch.navSites": () => "Data center",
  "providers.myloch.navOrder": () => "Colocation",
  "providers.myloch.navPortal": () => "Centro clienti",
  "providers.myloch.claim": () => "Hosting da Düsseldorf",
  "providers.myloch.heroEarly": () => "Colocation a prezzi onesti",
  "providers.myloch.heroLate": () => "I vostri server nel nostro data center di Düsseldorf",
  "providers.myloch.text": (p) => `Ospitate il vostro hardware in ${p.name} a ${p.city}, con energia, rete e supporto inclusi.`,
  "providers.myloch.from": (p) => `Da ${p.price} al mese`,
  "providers.myloch.units": (p) => `${p.n} unità rack`,
  "providers.myloch.power": (p) => `${p.kw} kW di potenza`,
  "providers.myloch.hands": (p) => `Remote hands entro ${p.hours} ore`,
  "providers.myloch.perMonth": (p) => `${p.price} / mese`,
  "providers.myloch.order": () => "Ordina ora",
  "providers.myloch.vat": () => "Tutti i prezzi sono mensili e IVA esclusa.",
  "providers.myloch.footer": (p) => `© ${p.year} myLoch managed IT AG`,
} satisfies Dict;
