// docs/design/software.md, 8.2: the site index at the browser's home, by game year. Pure; the browser draws it.
import { t } from "../../i18n/en";
import { monthIndexOf, yearOf } from "../00-core/time";
import { SOFTWARE } from "../10-catalog/platforms";
import { banksOpen } from "../10-catalog/banks";
import { registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { SERVER_OS } from "../10-catalog/server-os";
import { companyDomain, fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { BOARD_TITLE, BOARD_URL, companyUrl, WIKI_TITLE, WIKI_URL, displayHost, resolve, vendorHost, vendorLive, VENDORS, VIDEO_TITLE, VIDEO_URL } from "./browser";
import { privateIp } from "../60-infra/addresses";
import { familyOf } from "../60-infra/vulns";
import { consoleHost, consoleSuffix, consoleTitle } from "./consoles";

export interface IndexRow { title: string; url: string; desc: string; down: boolean }
export interface Category { title: string; rows: IndexRow[] }

const SOFTWARE_CATEGORIES: [string, string[]][] = [
  ["virtualization", ["openveezee", "openstash", "vmwhere", "proxmocks", "hypervee"]],
  ["panels", ["cpanic", "pleskit", "directadmen", "freepanel"]],
  ["gamePanels", ["tcadmen", "multikraft", "pterodaktyl"]],
  ["dns", ["bound", "powerdnz", "knut"]],
  ["vpn", ["openveepeen", "anyconnekt", "wireguarded"]],
  ["storage", ["vsftpeed", "ownclod", "minnio"]],
  ["mail", ["postfixit", "mailpig"]],
  ["backup", ["backula", "veeham", "proxmocksBackup"]],
];

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
    title: t(`sim.index.cat.${title}`),
    rows: ids.flatMap((id) => SOFTWARE.filter((x) => x.id === id && x.from <= year)).map((x) => row(x.name, `${displayHost(x.site.host)}/`, x.site.tagline)),
  }));
  // The company site once launched and one row per console the company runs, down when the host cannot be reached.
  const own = [
    ...(s.marketing.launched ? [row(s.company.name, companyUrl(s), companyDomain(s))] : []),
    ...consoleRows(s),
  ].map((r) => ({ ...r, down: resolve(s, r.url).load === "down" }));
  return [
    { title: t("sim.index.cat.banks"), rows: banksOpen(year).map((b) => row(b.name, `${displayHost(b.host)}/`, t("sim.index.bank"))) },
    { title: t("sim.index.cat.os"), rows: SERVER_OS.map((o) => row(o.name, `${displayHost(o.site.host)}/`, o.site.tagline)) },
    ...software,
    { title: t("sim.index.cat.resellers"), rows: REGISTRARS.filter((r) => r.from <= year).map((r) => row(r.name, `${displayHost(registrarHost(r))}/`, t("sim.index.resellers"))) },
    { title: t("sim.index.cat.community"), rows: [row(BOARD_TITLE, BOARD_URL, t("sim.index.board")), row(WIKI_TITLE, WIKI_URL, t("sim.index.wiki"))] },
    { title: t("sim.index.cat.hardware"), rows: VENDORS.filter((m) => vendorLive(m, monthIndexOf(s.hour))).map((m) => row(m.name, `${displayHost(vendorHost(m.id))}/`, m.kinds.map((k) => t(`sim.index.kind.${k}`)).join(", "))) },
    { title: s.company.name, rows: own },
    { title: t("sim.index.cat.video"), rows: [row("YouTub", VIDEO_URL, VIDEO_TITLE)] },
  ].filter((c) => c.rows.length > 0);
}
