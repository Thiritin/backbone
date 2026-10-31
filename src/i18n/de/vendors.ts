import type { Dict } from "../lang";

const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} und ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} ${Number(n) === 1 ? "Kern" : "Kerne"}`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${gb} GB`);

export default {
  "event.news.vendor.title": (p) => `Neu von ${p.brand}`,
  "event.news.vendor.text": (p) => `Heize online meldet, dass ${p.brand} ${list(p.names)} auf den Markt bringt.`,
  "vendor.release.server": (p) => `${p.brand} bringt ${p.model} auf den Markt: ein Server mit ${p.height} HE, ${cores(p.cores)} und ${ram(p.ram)} RAM.`,
  "vendor.release.chassis": (p) => `${p.brand} bringt ${p.model} auf den Markt: ein Gehäuse mit ${p.height} HE für ${p.nodes} Server-Nodes.`,
  "vendor.release.switch": (p) => `${p.brand} bringt ${p.model} auf den Markt: ein Switch mit ${p.ports} Ports bis ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `${p.brand} bringt ${p.model} auf den Markt: eine Firewall, die ${speed(p.gbit)} filtert.`,
  "vendor.release.gateway": (p) => `${p.brand} bringt ${p.model} auf den Markt: ein Router, der ${speed(p.gbit)} routet.`,
  "vendor.release.patch": (p) => `${p.brand} bringt ${p.model} auf den Markt: ein Patchpanel mit ${p.jacks} Buchsen.`,
  "vendor.release.ups": (p) => `${p.brand} bringt ${p.model} auf den Markt: eine USV mit ${p.wh} Wh Akku.`,
  "vendor.release.pdu": (p) => `${p.brand} bringt ${p.model} auf den Markt: eine schaltbare PDU mit ${p.outlets} Steckdosen.`,
} satisfies Dict;
