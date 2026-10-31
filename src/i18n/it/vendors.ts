import type { Dict } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} core`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${gb} GB`);

export default {
  "event.news.vendor.title": (p) => `Novità da ${p.brand}`,
  "event.news.vendor.text": (p) => `Heize online riporta che ${p.brand} lancia ${list(p.names)}.`,
  "vendor.release.server": (p) => `${p.brand} lancia ${p.model}: un server da ${p.height} U con ${cores(p.cores)} e ${ram(p.ram)} di RAM.`,
  "vendor.release.chassis": (p) => `${p.brand} lancia ${p.model}: uno chassis da ${p.height} U che ospita ${p.nodes} nodi server.`,
  "vendor.release.switch": (p) => `${p.brand} lancia ${p.model}: uno switch con ${p.ports} porte fino a ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `${p.brand} lancia ${p.model}: un firewall che filtra ${speed(p.gbit)}.`,
  "vendor.release.gateway": (p) => `${p.brand} lancia ${p.model}: un router che instrada ${speed(p.gbit)}.`,
  "vendor.release.patch": (p) => `${p.brand} lancia ${p.model}: un patch panel con ${p.jacks} prese.`,
  "vendor.release.ups": (p) => `${p.brand} lancia ${p.model}: un UPS con ${p.wh} Wh di batteria.`,
  "vendor.release.pdu": (p) => `${p.brand} lancia ${p.model}: una PDU commutata con ${p.outlets} prese.`,
} satisfies Dict;
