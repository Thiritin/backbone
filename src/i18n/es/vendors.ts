import type { Dict } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} y ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} ${Number(n) === 1 ? "núcleo" : "núcleos"}`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${gb} GB`);

export default {
  "event.news.vendor.title": (p) => `Novedad de ${p.brand}`,
  "event.news.vendor.text": (p) => `Heize online informa de que ${p.brand} lanza ${list(p.names)}.`,
  "vendor.release.server": (p) => `${p.brand} lanza ${p.model}: un servidor de ${p.height} U con ${cores(p.cores)} y ${ram(p.ram)} de RAM.`,
  "vendor.release.chassis": (p) => `${p.brand} lanza ${p.model}: un chasis de ${p.height} U que alberga ${p.nodes} nodos de servidor.`,
  "vendor.release.switch": (p) => `${p.brand} lanza ${p.model}: un switch con ${p.ports} puertos de hasta ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `${p.brand} lanza ${p.model}: un cortafuegos que filtra ${speed(p.gbit)}.`,
  "vendor.release.gateway": (p) => `${p.brand} lanza ${p.model}: un router que enruta ${speed(p.gbit)}.`,
  "vendor.release.patch": (p) => `${p.brand} lanza ${p.model}: un panel de parcheo con ${p.jacks} conectores.`,
  "vendor.release.ups": (p) => `${p.brand} lanza ${p.model}: un SAI con ${p.wh} Wh de batería.`,
  "vendor.release.pdu": (p) => `${p.brand} lanza ${p.model}: una PDU conmutada con ${p.outlets} tomas.`,
} satisfies Dict;
