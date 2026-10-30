// docs/design/software.md, 8.2: the site index at the browser's home, by game year. Pure; the browser draws it.
import { yearOf } from "../00-core/time";
import type { DeviceKind } from "../10-catalog/hardware";
import { SOFTWARE } from "../10-catalog/platforms";
import { registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { SERVER_OS } from "../10-catalog/server-os";
import { companyDomain, fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { BOARD_TITLE, BOARD_URL, companyUrl, displayHost, resolve, vendorHost, VENDORS, VIDEO_TITLE, VIDEO_URL } from "./browser";
import { privateIp } from "../60-infra/addresses";
import { familyOf } from "../60-infra/vulns";
import { consoleHost, consoleSuffix, consoleTitle } from "./consoles";

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

// One row per console, named by its machine's hostname: at the fqdn once the company has a domain, at the machine's
// private address before.
function consoleRows(s: GameState): IndexRow[] {
  return s.clusters.flatMap((c) => {
    const family = familyOf(c), host = family && consoleHost(s, c), at = consoleSuffix(s, c);
    if (!family || !host || at === null) return [];
    const id = (s.devices.find((d) => d.hostname === host) ?? s.workloads.find((w) => w.hostname === host))?.id;
    const url = s.company.domain ? fqdn(s, host) : id && privateIp(s, id);
    return url ? [row(`${consoleTitle(family)} ${host}${at}`, url + at, url + at)] : [];
  });
}

export function siteIndex(s: GameState): Category[] {
  const year = yearOf(s.hour);
  const software = SOFTWARE_CATEGORIES.map(([title, ids]): Category => ({
    title,
    rows: ids.flatMap((id) => SOFTWARE.filter((x) => x.id === id && x.from <= year)).map((x) => row(x.name, `${displayHost(x.site.host)}/`, x.site.tagline)),
  }));
  // The company site once launched and one row per console the company runs, down when the host cannot be reached.
  const own = [
    ...(s.marketing.launched ? [row(s.company.name, companyUrl(s), companyDomain(s))] : []),
    ...consoleRows(s),
  ].map((r) => ({ ...r, down: resolve(s, r.url).load === "down" }));
  return [
    { title: "Operating systems", rows: SERVER_OS.map((o) => row(o.name, `${displayHost(o.site.host)}/`, o.site.tagline)) },
    ...software,
    { title: "Domain resellers", rows: REGISTRARS.filter((r) => r.from <= year).map((r) => row(r.name, `${displayHost(registrarHost(r))}/`, "Domain registration and reseller contracts")) },
    { title: "Community", rows: [row(BOARD_TITLE, BOARD_URL, "Sponsorship offers from the hosting community")] },
    { title: "Hardware", rows: VENDORS.map((m) => row(m.name, `${displayHost(vendorHost(m.id))}/`, m.kinds.map((k) => KIND_DESC[k]).join(", "))) },
    { title: s.company.name, rows: own },
    { title: "Video", rows: [row("YouTub", VIDEO_URL, VIDEO_TITLE)] },
  ].filter((c) => c.rows.length > 0);
}
