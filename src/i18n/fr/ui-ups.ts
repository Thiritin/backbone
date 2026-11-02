import type { Dict } from "../lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "État",
  "ups.shutdown": () => "Arrêt",
  "ups.model": () => "Modèle",
  "ups.name": () => "Nom",
  "ups.address": () => "Adresse",
  "ups.battery": () => "Batterie",
  "ups.load": () => "Charge",
  "ups.runtime": () => "Autonomie",
  "ups.host": () => "Hôte",
  "ups.method": () => "Arrêt par",
  "ups.agent": () => "Agent",
  "ups.hypervisor": () => "API de l'hyperviseur",
  "ups.none": () => "Aucun",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} min`,
} satisfies Dict;
