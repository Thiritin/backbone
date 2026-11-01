import type { Dict } from "../lang";

// economy.md, UPS: the web interface of a managed UPS.
export default {
  "ups.status": () => "Status",
  "ups.shutdown": () => "Herunterfahren",
  "ups.model": () => "Modell",
  "ups.name": () => "Name",
  "ups.address": () => "Adresse",
  "ups.battery": () => "Batterie",
  "ups.load": () => "Last",
  "ups.runtime": () => "Laufzeit",
  "ups.host": () => "Host",
  "ups.method": () => "Herunterfahren über",
  "ups.agent": () => "Agent",
  "ups.hypervisor": () => "Hypervisor-API",
  "ups.none": () => "Keins",
  "ups.wh": (p) => `${p.n} Wh`,
  "ups.watts": (p) => `${p.n} W`,
  "ups.minutes": (p) => `${p.n} Min.`,
} satisfies Dict;
