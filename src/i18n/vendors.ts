type Params = Record<string, string | number>;

// docs/design/software.md, 8.6: the release lines on manufacturer sites and their News app items; spread into en.
const list = (v: string | number) => { const a = String(v).split("|"); return a.length < 2 ? a[0] : `${a.slice(0, -1).join(", ")} and ${a[a.length - 1]}`; };
const speed = (gbit: string | number) => (Number(gbit) < 1 ? `${Math.round(Number(gbit) * 1000)} Mbit/s` : `${gbit} Gbit/s`);
const cores = (n: string | number) => `${n} ${Number(n) === 1 ? "core" : "cores"}`;
const ram = (gb: string | number) => (Number(gb) >= 1024 ? `${Number(gb) / 1024} TB` : `${gb} GB`);

export const VENDORS_EN: Record<string, (p: Params) => string> = {
  "event.news.vendor.title": (p) => `New from ${p.brand}`,
  "event.news.vendor.text": (p) => `Heize online reports that ${p.brand} ships the ${list(p.names)}.`,
  "vendor.release.server": (p) => `${p.brand} ships the ${p.model}, a ${p.height}U server with ${cores(p.cores)} and ${ram(p.ram)} of RAM.`,
  "vendor.release.chassis": (p) => `${p.brand} ships the ${p.model}, a ${p.height}U chassis that holds ${p.nodes} server nodes.`,
  "vendor.release.switch": (p) => `${p.brand} ships the ${p.model}, a switch with ${p.ports} ports at up to ${speed(p.gbit)}.`,
  "vendor.release.firewall": (p) => `${p.brand} ships the ${p.model}, a firewall that filters ${speed(p.gbit)}.`,
  "vendor.release.gateway": (p) => `${p.brand} ships the ${p.model}, a router that routes ${speed(p.gbit)}.`,
  "vendor.release.patch": (p) => `${p.brand} ships the ${p.model}, a patch panel with ${p.jacks} jacks.`,
  "vendor.release.ups": (p) => `${p.brand} ships the ${p.model}, a UPS with ${p.wh} Wh of battery.`,
  "vendor.release.pdu": (p) => `${p.brand} ships the ${p.model}, a switched PDU with ${p.outlets} outlets.`,
};
