import type { Dict } from "../lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "Estado",
  "ups.shutdown": () => "Apagado",
  "ups.model": () => "Modelo",
  "ups.name": () => "Nombre",
  "ups.address": () => "Dirección",
  "ups.battery": () => "Batería",
  "ups.load": () => "Carga",
  "ups.runtime": () => "Autonomía",
  "ups.host": () => "Host",
  "ups.method": () => "Apagado mediante",
  "ups.agent": () => "Agente",
  "ups.hypervisor": () => "API del hipervisor",
  "ups.none": () => "Ninguno",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} min`,
} satisfies Dict;
