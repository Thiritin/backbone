import type { Dict } from "../lang";

export default {
  "providers.docklands.navSites": () => `La nostra struttura`,
  "providers.docklands.navColo": () => `Prezzi`,
  "providers.docklands.navPortal": () => `Area clienti`,
  "providers.docklands.call": (p) => `Chiamateci al ${p.phone}`,
  "providers.docklands.why": () => `Perché Docklands Data?`,
  "providers.docklands.why1": () => `Indipendente e gestita dai titolari`,
  "providers.docklands.why2": () => `Tecnici propri a East London`,
  "providers.docklands.why3": () => `Prezzi mensili chiari`,
  "providers.docklands.why4": () => `Spazio da poche unità a un rack intero`,
  "providers.docklands.heroEarly": () => `Colocation nei Docklands di Londra`,
  "providers.docklands.heroLate": () => `Colocation alla mano nel cuore di Londra`,
  "providers.docklands.text": (p) => `Spazio rack sicuro per piccole imprese vicino alla City, da ${p.price} al mese.`,
  "providers.docklands.quote": () => `Chiedi un preventivo`,
  "providers.docklands.quoteText": () => `Il team ha installato i nostri server di sabato e a pranzo eravamo di nuovo online.`,
  "providers.docklands.quoteBy": () => `Amministratore di uno studio di design a Shoreditch`,
  "providers.docklands.footer": (p) => `© ${p.year} Docklands Data Ltd. Registrata in Inghilterra e Galles.`,
} satisfies Dict;
