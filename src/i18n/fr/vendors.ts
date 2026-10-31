import type { Dict } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} et ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} ${Number(n) < 2 ? "cœur" : "cœurs"}`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} To` : `${gb} Go`);

export default {
  "event.news.vendor.title": (p) => `Nouveauté chez ${p.brand}`,
  "event.news.vendor.text": (p) => `Heize online rapporte que ${p.brand} lance ${list(p.names)}.`,
  "vendor.release.server": (p) => `${p.brand} lance ${p.model} : un serveur de ${p.height} U avec ${cores(p.cores)} et ${ram(p.ram)} de RAM.`,
  "vendor.release.chassis": (p) => `${p.brand} lance ${p.model} : un châssis de ${p.height} U qui accueille ${p.nodes} nœuds serveur.`,
  "vendor.release.switch": (p) => `${p.brand} lance ${p.model} : un switch de ${p.ports} ports jusqu'à ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `${p.brand} lance ${p.model} : un pare-feu qui filtre ${speed(p.gbit)}.`,
  "vendor.release.gateway": (p) => `${p.brand} lance ${p.model} : un routeur qui route ${speed(p.gbit)}.`,
  "vendor.release.patch": (p) => `${p.brand} lance ${p.model} : un panneau de brassage de ${p.jacks} prises.`,
  "vendor.release.ups": (p) => `${p.brand} lance ${p.model} : un onduleur avec ${p.wh} Wh de batterie.`,
  "vendor.release.pdu": (p) => `${p.brand} lance ${p.model} : une PDU commutable de ${p.outlets} prises.`,
} satisfies Dict;
