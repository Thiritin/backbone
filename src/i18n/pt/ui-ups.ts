import type { Dict } from "../lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "Estado",
  "ups.shutdown": () => "Desligamento",
  "ups.model": () => "Modelo",
  "ups.name": () => "Nome",
  "ups.address": () => "Endereço",
  "ups.battery": () => "Bateria",
  "ups.load": () => "Carga",
  "ups.runtime": () => "Autonomia",
  "ups.host": () => "Host",
  "ups.method": () => "Desligamento por",
  "ups.agent": () => "Agente",
  "ups.hypervisor": () => "API do hipervisor",
  "ups.none": () => "Nenhum",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} min`,
} satisfies Dict;
