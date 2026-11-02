import type { Dict } from "../lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "Stato",
  "ups.shutdown": () => "Spegnimento",
  "ups.model": () => "Modello",
  "ups.name": () => "Nome",
  "ups.address": () => "Indirizzo",
  "ups.battery": () => "Batteria",
  "ups.load": () => "Carico",
  "ups.runtime": () => "Autonomia",
  "ups.host": () => "Host",
  "ups.method": () => "Spegnimento tramite",
  "ups.agent": () => "Agente",
  "ups.hypervisor": () => "API dell'hypervisor",
  "ups.none": () => "Nessuno",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} min`,
} satisfies Dict;
