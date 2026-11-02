import type { Dict } from "../lang";

export default {
  "providers.equinox.navSites": () => "Data center IBX",
  "providers.equinox.navColo": () => "Colocation",
  "providers.equinox.navPortal": () => "Portale clienti",
  "providers.equinox.ibx": () => "Centri IBX",
  "providers.equinox.heroEarly": () => "Data center neutrali e servizi di Internet exchange",
  "providers.equinox.heroLate": () => "L'azienda mondiale dell'interconnessione",
  "providers.equinox.text": (p) => `${p.n} centri International Bandwidth Exchange in ${p.cities} città, dove carrier, fornitori di contenuti e aziende si incontrano sotto lo stesso tetto.`,
  "providers.equinox.cta": () => "Trova un data center",
  "providers.equinox.col1": () => "Certificato e ridondante",
  "providers.equinox.col1Text": () => "Ogni sito ha alimentazione A e B, generatori e sicurezza certificata.",
  "providers.equinox.col2": () => "Interconnessione in sede",
  "providers.equinox.col2Text": () => "Cross-connect verso l'exchange nell'edificio e verso ogni carrier della meet-me room.",
  "providers.equinox.col3": () => "Remote hands 24 ore su 24",
  "providers.equinox.col3Text": () => "I tecnici sono in sede giorno e notte e fatturano a ore insieme all'affitto.",
  "providers.equinox.footer": (p) => `© ${p.year} Equinox, Inc. Tutti i diritti riservati.`,
} satisfies Dict;
