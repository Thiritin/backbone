// docs/design/software.md, 8.2: the site index at the browser's home, by game year. Pure; the browser draws it.
import { yearOf } from "../00-core/time";
import type { DeviceKind } from "../10-catalog/hardware";
import { SOFTWARE } from "../10-catalog/platforms";
import { registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { SERVER_OS } from "../10-catalog/server-os";
import { companyDomain } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { BOARD_TITLE, BOARD_URL, companyUrl, resolve, vendorHost, VENDORS, VIDEO_TITLE, VIDEO_URL } from "./browser";
import { consoleBookmarks } from "./consoles";

export interface IndexRow { title: string; url: string; desc: string; down: boolean }
export interface Category { title: string; rows: IndexRow[] }

const SOFTWARE_CATEGORIES: [string, string[]][] = [
  ["Virtualization", ["openveezee", "openstash", "vmwhere", "proxmocks", "hypervee"]],
  ["Hosting panels", ["cpanic", "pleskit", "directadmen", "freepanel"]],
  ["Game panels", ["tcadmen", "multikraft", "pterodaktyl"]],
  ["DNS", ["bound", "powerdnz", "knut"]],
  ["VPN", ["openveepeen", "anyconnekt", "wireguarded"]],
  ["Storage", ["vsftpeed", "ownclod", "minnio"]],
  ["Mail", ["postfixit", "mailpig"]],
];

const KIND_DESC: Record<DeviceKind, string> = {
  server: "Servers", chassis: "Chassis", switch: "Switches", firewall: "Firewalls", gateway: "Gateways", patch: "Patch panels", ups: "Power",
  pdu: "Power strips", part: "Parts", kvm: "KVM switches", console: "Rack consoles", oob: "Console servers",
};

const row = (title: string, url: string, desc: string, down = false): IndexRow => ({ title, url, desc, down });

export function siteIndex(s: GameState): Category[] {
  const year = yearOf(s.hour);
  const software = SOFTWARE_CATEGORIES.map(([title, ids]): Category => ({
    title,
    rows: ids.flatMap((id) => SOFTWARE.filter((x) => x.id === id && x.from <= year)).map((x) => row(x.name, `www.${x.site.host}/`, x.site.tagline)),
  }));
  // The company site once launched and one row per console the company runs, down when the host cannot be reached.
  const own = [
    ...(s.marketing.launched ? [row(s.company.name, companyUrl(s), companyDomain(s))] : []),
    ...consoleBookmarks(s).map((m) => row(m.title, m.url, m.url.split("/")[0])),
  ].map((r) => ({ ...r, down: resolve(s, r.url).load === "down" }));
  return [
    { title: "Operating systems", rows: SERVER_OS.map((o) => row(o.name, `www.${o.site.host}/`, o.site.tagline)) },
    ...software,
    { title: "Domain resellers", rows: REGISTRARS.filter((r) => r.from <= year).map((r) => row(r.name, `www.${registrarHost(r)}/`, "Domain registration and reseller contracts")) },
    { title: "Community", rows: [row(BOARD_TITLE, BOARD_URL, "Sponsorship offers from the hosting community")] },
    { title: "Hardware", rows: VENDORS.map((m) => row(m.name, `www.${vendorHost(m.id)}/`, m.kinds.map((k) => KIND_DESC[k]).join(", "))) },
    { title: s.company.name, rows: own },
    { title: "Video", rows: [row("YouTub", VIDEO_URL, VIDEO_TITLE)] },
  ].filter((c) => c.rows.length > 0);
}
