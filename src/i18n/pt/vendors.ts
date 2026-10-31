import type { Dict } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} e ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} ${Number(n) === 1 ? "núcleo" : "núcleos"}`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${gb} GB`);

export default {
  "event.news.vendor.title": (p) => `Novidade da ${p.brand}`,
  "event.news.vendor.text": (p) => `O Heize online noticia que a ${p.brand} lança ${list(p.names)}.`,
  "vendor.release.server": (p) => `A ${p.brand} lança ${p.model}: um servidor de ${p.height} U com ${cores(p.cores)} e ${ram(p.ram)} de RAM.`,
  "vendor.release.chassis": (p) => `A ${p.brand} lança ${p.model}: um chassis de ${p.height} U que aloja ${p.nodes} nós de servidor.`,
  "vendor.release.switch": (p) => `A ${p.brand} lança ${p.model}: um switch com ${p.ports} portas até ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `A ${p.brand} lança ${p.model}: uma firewall que filtra ${speed(p.gbit)}.`,
  "vendor.release.gateway": (p) => `A ${p.brand} lança ${p.model}: um roteador que encaminha ${speed(p.gbit)}.`,
  "vendor.release.patch": (p) => `A ${p.brand} lança ${p.model}: um patch panel com ${p.jacks} fichas.`,
  "vendor.release.ups": (p) => `A ${p.brand} lança ${p.model}: uma UPS com ${p.wh} Wh de bateria.`,
  "vendor.release.pdu": (p) => `A ${p.brand} lança ${p.model}: uma PDU comutada com ${p.outlets} tomadas.`,
} satisfies Dict;
