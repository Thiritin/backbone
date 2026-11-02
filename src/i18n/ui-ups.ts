import type { Dict } from "./lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "Status",
  "ups.shutdown": () => "Shutdown",
  "ups.model": () => "Model",
  "ups.name": () => "Name",
  "ups.address": () => "Address",
  "ups.battery": () => "Battery",
  "ups.load": () => "Load",
  "ups.runtime": () => "Runtime",
  "ups.host": () => "Host",
  "ups.method": () => "Shutdown by",
  "ups.agent": () => "Agent",
  "ups.hypervisor": () => "Hypervisor API",
  "ups.none": () => "None",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} min`,
} satisfies Dict;
