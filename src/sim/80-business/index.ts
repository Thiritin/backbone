// docs/design/software.md, 8.2: the site index at the browser's home, by game year. Pure; the browser draws it.
import { HOSTTOAST, HOSTTOAST_HOST } from "../10-catalog/hosttoast";
import { t } from "../../i18n/en";
import { monthIndexOf, yearOf } from "../00-core/time";
import { SOFTWARE } from "../10-catalog/platforms";
import { banksOpen } from "../10-catalog/banks";
import { registrarHost, REGISTRARS } from "../10-catalog/registrars";
import { SERVER_OS } from "../10-catalog/server-os";
import { CHANNELS, marketUrl } from "../10-catalog/used";
import { companyDomain, fqdn } from "../30-customers/domains";
import type { GameState } from "../50-state";
import { BOARD_TITLE, BOARD_URL, companyUrl, providerUrl, WIKI_TITLE, WIKI_URL, displayHost, resolve, vendorHost, vendorLive, VENDORS, VIDEO_TITLE, VIDEO_URL } from "./browser";
import { machineAddress } from "../60-infra/addresses";
import { familyOf } from "../60-infra/vulns";
import { consoleHost, consoleSuffix, consoleTitle } from "./consoles";
import { OFFICE_HOST } from "./office";
import { DOHLE_URL } from "./tax";
import { vendorsIn } from "../10-catalog/bookkeeping";
import { DATACENTERS, PROVIDERS } from "../20-world/datacenters";
import { booksHost } from "./bookkeeping";
import { SHOPS } from "../10-catalog/shops";
import { shopVendorUrl } from "./shoplink";
import { shopActive } from "./shop";

export interface IndexRow { title: string; url: string; desc: string; down: boolean }
export interface Category { title: string; rows: IndexRow[] }

const SOFTWARE_CATEGORIES: [string, string[]][] = [
  ["virtualization", ["openveezee", "openstash", "vmwhere", "proxmocks", "hypervee"]],
  ["panels", ["cpanic", "pleskit", "directadmen", "freepanel"]],
  ["gamePanels", ["tcadmen", "multikraft", "pterodaktyl"]],
  ["dns", ["bound", "powerdnz", "knut"]],
  ["vpn", ["openveepeen", "anyconnekt", "wireguarded"]],
  ["storage", ["vsftpeed", "ownclod", "minnio"]],
  ["mail", ["postfixit", "mailpig", "squirrelmeal", "postfixitadmin"]],
  ["backup", ["backula", "veeham", "proxmocksBackup"]],
];

const row = (title: string, url: string, desc: string, down = false): IndexRow => ({ title, url, desc, down });

// One row per console with the directory category it falls under, named by its machine's hostname: at the fqdn once
// the company has a domain, at the machine's private address before.
function consoleRows(s: GameState): [string, IndexRow][] {
  return s.clusters.flatMap((c): [string, IndexRow][] => {
    const family = familyOf(c), host = family && consoleHost(s, c), at = consoleSuffix(s, c);
    if (!family || !host || at === null) return [];
    const id = (s.devices.find((d) => d.hostname === host) ?? s.workloads.find((w) => w.hostname === host))?.id;
    const url = s.company.domain ? fqdn(s, host) : id && machineAddress(s, id);
    const cat = SOFTWARE_CATEGORIES.find(([, ids]) => ids.includes(family))?.[0] ?? "gamePanels";
    return url ? [[cat, row(`${consoleTitle(family)} ${host}${at}`, url + at, url + at)]] : [];
  });
}

export function siteIndex(s: GameState): Category[] {
  const year = yearOf(s.hour);
  const software = SOFTWARE_CATEGORIES.map(([title, ids]): Category => ({
    title: t(`sim.index.cat.${title}`),
    rows: ids.flatMap((id) => SOFTWARE.filter((x) => x.id === id && x.from <= year)).map((x) => row(x.name, `${displayHost(x.site.host)}/`, x.site.tagline)),
  }));
  return [
    { title: t("sim.index.cat.docs"), rows: [row(WIKI_TITLE, WIKI_URL, t("sim.index.wiki"))] },
    { title: t("sim.index.cat.banks"), rows: banksOpen(year).map((b) => row(b.name, `${displayHost(b.host)}/`, t("sim.index.bank"))) },
    { title: t("sim.index.cat.os"), rows: SERVER_OS.map((o) => row(o.name, `${displayHost(o.site.host)}/`, o.site.tagline)) },
    ...software,
    { title: t("sim.index.cat.shops"), rows: SHOPS.filter((v) => v.from <= year).map((v) => row(v.name, shopVendorUrl(v.id), t("sim.index.shop"))) },
    { title: t("sim.index.cat.resellers"), rows: REGISTRARS.filter((r) => r.from <= year).map((r) => row(r.name, `${displayHost(registrarHost(r))}/`, t("sim.index.resellers"))) },
    { title: t("sim.index.cat.government"), rows: [row(t("browser-sites-1.of.title"), `www.${OFFICE_HOST}/`, t("sim.index.office")), row("DOHLE", DOHLE_URL, t("sim.index.dohle"))] },
    { title: t("sim.index.cat.bookkeeping"), rows: vendorsIn(year).map((v) => row(v.program, `${displayHost(booksHost(v))}/`, t(`books-vendors.about.${v.id}`))) },
    { title: t("sim.index.cat.community"), rows: [row(BOARD_TITLE, BOARD_URL, t("sim.index.board")), row(HOSTTOAST, `www.${HOSTTOAST_HOST}/`, t("sim.index.hosttoast"))] },
    { title: t("sim.index.cat.hardware"), rows: VENDORS.filter((m) => vendorLive(m, monthIndexOf(s.hour))).map((m) => row(m.name, `${displayHost(vendorHost(m.id))}/`, m.kinds.map((k) => t(`sim.index.kind.${k}`)).join(", "))) },
    { title: t("sim.index.cat.colocation"), rows: PROVIDERS.map((p) => row(p.name, providerUrl(p.id), [...new Set(DATACENTERS.filter((d) => d.provider === p.id).map((d) => d.city))].join(", "))) },
    { title: t("sim.index.cat.used"), rows: CHANNELS.map((c) => row(c.name, marketUrl(c.id), t(`sim.index.market.${c.id}`))) },
    { title: t("sim.index.cat.video"), rows: [row("YouTub", VIDEO_URL, VIDEO_TITLE)] },
  ].filter((c) => c.rows.length > 0);
}

export interface Folder { title: string; rows: IndexRow[]; groups: Category[] }
const FOLDER_FLAT_MAX = 20;

// The company's own sites for the bookmark folder: flat up to 20, past that the consoles go into one subfolder per
// directory category. A row is down when its host cannot be reached.
export function companyFolder(s: GameState): Folder {
  const live = (r: IndexRow) => ({ ...r, down: resolve(s, r.url).load === "down" });
  const sites = [
    ...(s.marketing.launched ? [row(s.company.name, companyUrl(s), companyDomain(s))] : []),
    ...(shopActive(s) && s.shop.install ? [row(t("sim.index.portal"), `portal.${companyDomain(s)}/`, `portal.${companyDomain(s)}`)] : []),
  ].map(live);
  const consoles = consoleRows(s).map(([cat, r]): [string, IndexRow] => [cat, live(r)]);
  if (sites.length + consoles.length <= FOLDER_FLAT_MAX) return { title: s.company.name, rows: [...sites, ...consoles.map(([, r]) => r)], groups: [] };
  const cats = [...new Set(consoles.map(([cat]) => cat))];
  return { title: s.company.name, rows: sites, groups: cats.map((cat) => ({ title: t(`sim.index.cat.${cat}`), rows: consoles.filter(([c]) => c === cat).map(([, r]) => r) })) };
}

export interface SearchHit { row: IndexRow; ad: boolean }
const NO_ADS = ["docs", "government", "community", "video"];

// The directory's rows that match the query, with sponsored rows from the companies that sell to hosters: two on top,
// then one after every third result. Which sellers advertise turns over with the query and the week.
export function searchIndex(s: GameState, query: string): SearchHit[] {
  const needle = query.trim().toLowerCase();
  if (!needle) return [];
  const cats = siteIndex(s), noAds = NO_ADS.map((k) => t(`sim.index.cat.${k}`));
  const hits = [...new Map(cats.flatMap((c) => c.rows.filter((r) => `${c.title} ${r.title} ${r.desc}`.toLowerCase().includes(needle)).map((r) => [r.url, r] as const))).values()];
  const seed = `${needle}|${Math.floor(s.hour / (24 * 7))}`;
  const pool = cats.filter((c) => !noAds.includes(c.title)).flatMap((c) => c.rows).filter((r) => !hits.some((h) => h.url === r.url))
    .sort((a, b) => hash(seed + a.url) - hash(seed + b.url));
  const ads = pool.slice(0, 2 + Math.floor(hits.length / 3));
  const out: SearchHit[] = ads.slice(0, 2).map((r) => ({ row: r, ad: true }));
  hits.forEach((r, i) => {
    out.push({ row: r, ad: false });
    const ad = ads[2 + Math.floor(i / 3)];
    if (i % 3 === 2 && ad) out.push({ row: ad, ad: true });
  });
  return out;
}

function hash(text: string): number {
  let h = 0;
  for (const ch of text) h = (Math.imul(h, 31) + ch.charCodeAt(0)) | 0;
  return h;
}
