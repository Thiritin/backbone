import type { Dict } from "../lang";

export default {
  "providers.data5.navHome": () => "Il gruppo",
  "providers.data5.navSites": () => "I nostri campus",
  "providers.data5.navOrder": () => "Colocation",
  "providers.data5.navAccount": () => "Area clienti",
  "providers.data5.quote": () => "Richiedi un preventivo",
  "providers.data5.heroEarly": () => "Campus di data center europei per la vostra infrastruttura critica",
  "providers.data5.heroLate": () => "Data center costruiti per durare, per i dati che muovono l'Europa",
  "providers.data5.text": (p) => `Progettiamo, costruiamo e gestiamo ${p.n} campus di data center a ${p.cities}, con energia e connettività dimensionate per decenni di crescita.`,
  "providers.data5.cta": () => "Scopri i nostri campus",
  "providers.data5.figSites": () => "Campus",
  "providers.data5.figCarriers": () => "Operatori in sede",
  "providers.data5.figCities": () => "Città",
  "providers.data5.campuses": () => "I nostri campus",
  "providers.data5.carriers": (p) => `${p.n} operatori`,
  "providers.data5.footer": (p) => `© ${p.year} Data5 Group`,
} satisfies Dict;
