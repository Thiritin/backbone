import { t } from "../../../../../i18n/en";
import { createElement, type ReactNode } from "react";
import { displayHost, WIKI_HOST } from "../../../../../sim/80-business/browser";
import { licensingAt, serverOsById, type LicenseEra } from "../../../../../sim/10-catalog/server-os";
import { SOFTWARE, type Software } from "../../../../../sim/10-catalog/platforms";
import { BASEMENT, MOMS_DSL, RACK_MODELS } from "../../../../../sim/20-world/datacenters";
import { COMPONENTS } from "../../../../../sim/10-catalog/hardware";
import { RECONNECT_HOUR, REP, STATIC_LINE_ADDRESSES, DELIST_HOURS, providerV4 } from "../../../../../sim/10-catalog/addresses";
import { REGISTRIES } from "../../../../../sim/30-customers/registry";
import { euroPrice } from "../../../../../sim/00-core/money";

export type Go = (url: string) => void;
export const CATEGORIES = ["Help", "Hardware", "Networking", "Software", "Business"] as const;
export type Category = (typeof CATEGORIES)[number];
export interface Article { slug: string; title: string; category: Category; body: (go: Go, year: number) => ReactNode }

export const wikiUrl = (slug: string) => `www.${WIKI_HOST}/wiki/${slug}`;
export const articleBySlug = (slug: string): Article | undefined => ARTICLES.find((a) => a.slug.toLowerCase() === slug.toLowerCase());

export const A = ({ to, go, children, className }: { to: string; go: Go; children: ReactNode; className?: string }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(to); }}>{children}</a>
);
// Links to pages that do not exist yet show red, like on any wiki.
export const W = ({ slug, go, children }: { slug: string; go: Go; children: ReactNode }) =>
  <A to={wikiUrl(slug)} go={go} className={slug.startsWith("Category:") || articleBySlug(slug) ? undefined : "new"}>{children}</A>;

const TOKEN = /\[\[(=?)([^|\]]+)\|([^\]]+)\]\]|<(b|kbd|code)>(.*?)<\/\4>/g;
// Renders a translated string where [[Slug|text]] is a wiki link, [[=url|text]] a plain link and <b>, <kbd>, <code> mark up text.
export function rich(s: string, go: Go): ReactNode {
  const out: ReactNode[] = [];
  let last = 0;
  for (const m of s.matchAll(TOKEN)) {
    out.push(s.slice(last, m.index));
    if (m[4]) out.push(createElement(m[4], { key: out.length }, m[5]));
    else if (m[1]) out.push(<A key={out.length} to={m[2]} go={go}>{m[3]}</A>);
    else out.push(<W key={out.length} slug={m[2]} go={go}>{m[3]}</W>);
    last = m.index! + m[0].length;
  }
  out.push(s.slice(last));
  return out;
}
const R = (go: Go, key: string, params?: Record<string, string | number>) => rich(t(key, params), go);

const Infobox = ({ title, rows }: { title: string; rows: [string, ReactNode][] }) => (
  <table className="wk-info"><caption>{title}</caption><tbody>{rows.map(([k, v]) => <tr key={k}><th>{k}</th><td>{v}</td></tr>)}</tbody></table>
);

const os = serverOsById("lunix");
const osUrl = `${displayHost(os.site.host)}/`;
const reconnect = `${String(RECONNECT_HOUR).padStart(2, "0")}:00`;
const hdd = COMPONENTS.hdd, psu = COMPONENTS.psu;
const pct = (v: number) => `${Math.round(v * 1000) / 10} %`;

const licence = ({ kind, fee }: LicenseEra): string =>
  kind === "free" ? t("browser-sites-2.wikiLicFree") :
  kind === "once" ? t("browser-sites-2.wikiLicOnce", { fee: euroPrice(fee) }) :
  t(`browser-sites-2.wikiLic_${kind}`, { fee: euroPrice(fee) });

// Software of a kind that exists by the given year, with a link to its website.
function SoftwareTable({ kind, year, go }: { kind: Software["kind"]; year: number; go: Go }) {
  const rows = SOFTWARE.filter((x) => x.kind === kind && x.from <= year);
  return (
    <table className="wk-table">
      <thead><tr><th>{t("browser-sites-2.wikiName")}</th><th>{t("browser-sites-2.released")}</th><th>{t("browser-sites-2.wikiLicence")}</th><th>{t("browser-sites-2.wikiWebsite")}</th></tr></thead>
      <tbody>{rows.map((x) => (
        <tr key={x.id}>
          <td>{x.name}</td><td>{x.from}</td><td>{licence(licensingAt(x, year))}</td>
          <td><A to={`${displayHost(x.site.host)}/`} go={go}>{displayHost(x.site.host)}</A></td>
        </tr>
      ))}</tbody>
    </table>
  );
}

export const ARTICLES: Article[] = [
  {
    slug: "Help:Starting_a_hosting_company",
    title: t("browser-sites-2.wikiHelpStartingAHostingCompanyTitle"),
    category: "Help",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany1")}</p>
      <h2>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany2")}</h2>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany3")}</p>
      <h2>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany4")}</h2>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany5")}</p>
      <h2>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany6")}</h2>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany7")}</p>
      <h2>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany8")}</h2>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany9")}</p>
      <h2>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany10")}</h2>
      <p>{R(go, "browser-sites-2.wikiHelpStartingAHostingCompany11")}</p>
    </>,
  },
  {
    slug: "Server_installation",
    title: t("browser-sites-2.wikiServerInstallationTitle"),
    category: "Hardware",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiServerInstallation1")}</p>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation2")}</h2>
      <p>{R(go, "browser-sites-2.wikiServerInstallation3")}</p>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation4")}</h2>
      <p>{R(go, "browser-sites-2.wikiServerInstallation5")}</p>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation6")}</h2>
      <p>{R(go, "browser-sites-2.wikiServerInstallation7", { os: os.name, osUrl, osHost: displayHost(os.site.host) })}</p>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation8")}</h2>
      <ol>
        <li>{R(go, "browser-sites-2.wikiServerInstallation9")}</li>
        <li>{R(go, "browser-sites-2.wikiServerInstallation10")}</li>
        <li>{R(go, "browser-sites-2.wikiServerInstallation11")}</li>
        <li>{R(go, "browser-sites-2.wikiServerInstallation12")}</li>
      </ol>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation13")}</h2>
      <p>{R(go, "browser-sites-2.wikiServerInstallation14")}</p>
      <h2>{R(go, "browser-sites-2.wikiServerInstallation15")}</h2>
      <p>{R(go, "browser-sites-2.wikiServerInstallation16", { os: os.name })}</p>
      <p>{R(go, "browser-sites-2.wikiServerInstallation17")}</p>
    </>,
  },
  {
    slug: "Rack_unit",
    title: t("browser-sites-2.wikiRackUnitTitle"),
    category: "Hardware",
    body: (go) => <>
      <Infobox title={t("browser-sites-2.wikiRackUnit1")} rows={[[t("browser-sites-2.wikiRackUnit2"), "U"], [t("browser-sites-2.wikiRackUnit3"), "44.45 mm (1.75 in)"], [t("browser-sites-2.wikiRackUnit4"), "19 in"]]} />
      <p>{R(go, "browser-sites-2.wikiRackUnit5")}</p>
      <h2>{R(go, "browser-sites-2.wikiRackUnit6")}</h2>
      <p>{R(go, "browser-sites-2.wikiRackUnit7", { sizes: RACK_MODELS.map((r) => `${r.units}U`).join(", "), maxUnits: BASEMENT.maxUnits })}</p>
      <h2>{R(go, "browser-sites-2.wikiRackUnit8")}</h2>
      <p>{R(go, "browser-sites-2.wikiRackUnit9")}</p>
      <h2>{R(go, "browser-sites-2.wikiRackUnit10")}</h2>
      <p>{R(go, "browser-sites-2.wikiRackUnit11")}</p>
    </>,
  },
  {
    slug: "Power_supply",
    title: t("browser-sites-2.wikiPowerSupplyTitle"),
    category: "Hardware",
    body: (go) => <>
      <Infobox title={t("browser-sites-2.wikiPowerSupply1")} rows={[[t("browser-sites-2.wikiPowerSupply2"), "PSU"], [t("browser-sites-2.wikiPowerSupply3"), t("browser-sites-2.wikiPowerSupply4", { psuLife: psu.life })], [t("browser-sites-2.wikiPowerSupply5"), t("browser-sites-2.wikiPowerSupply6")]]} />
      <p>{R(go, "browser-sites-2.wikiPowerSupply7")}</p>
      <h2>{R(go, "browser-sites-2.wikiPowerSupply8")}</h2>
      <p>{R(go, "browser-sites-2.wikiPowerSupply9")}</p>
      <h2>{R(go, "browser-sites-2.wikiPowerSupply10")}</h2>
      <p>{R(go, "browser-sites-2.wikiPowerSupply11", { psuLife: psu.life, pctPsuBefore: pct(psu.before), pctPsuAfter: pct(psu.after) })}</p>
      <h2>{R(go, "browser-sites-2.wikiPowerSupply12")}</h2>
      <p>{R(go, "browser-sites-2.wikiPowerSupply13", { kw: BASEMENT.kw })}</p>
      <h2>{R(go, "browser-sites-2.wikiPowerSupply14")}</h2>
      <p>{R(go, "browser-sites-2.wikiPowerSupply15")}</p>
    </>,
  },
  {
    slug: "RAID",
    title: t("browser-sites-2.wikiRAIDTitle"),
    category: "Hardware",
    body: (go) => <>
      <Infobox title={t("browser-sites-2.wikiRAID1")} rows={[[t("browser-sites-2.wikiRAID2"), t("browser-sites-2.wikiRAID3")], [t("browser-sites-2.wikiRAID4"), "1987"]]} />
      <p>{R(go, "browser-sites-2.wikiRAID5")}</p>
      <h2>{R(go, "browser-sites-2.wikiRAID6")}</h2>
      <table className="wk-table">
        <thead><tr><th>{R(go, "browser-sites-2.wikiRAID7")}</th><th>{R(go, "browser-sites-2.wikiRAID8")}</th><th>{R(go, "browser-sites-2.wikiRAID9")}</th><th>{R(go, "browser-sites-2.wikiRAID10")}</th></tr></thead>
        <tbody>
          <tr><td>{R(go, "browser-sites-2.wikiRAID11")}</td><td>1</td><td>0</td><td>{R(go, "browser-sites-2.wikiRAID12")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiRAID13")}</td><td>2</td><td>1</td><td>{R(go, "browser-sites-2.wikiRAID14")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiRAID15")}</td><td>3</td><td>1</td><td>{R(go, "browser-sites-2.wikiRAID16")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiRAID17")}</td><td>4</td><td>2</td><td>{R(go, "browser-sites-2.wikiRAID18")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiRAID19")}</td><td>{R(go, "browser-sites-2.wikiRAID20")}</td><td>{R(go, "browser-sites-2.wikiRAID21")}</td><td>{R(go, "browser-sites-2.wikiRAID22")}</td></tr>
        </tbody>
      </table>
      <h2>{R(go, "browser-sites-2.wikiRAID23")}</h2>
      <p>{R(go, "browser-sites-2.wikiRAID24", { pctHddBefore: pct(hdd.before), hddLife: hdd.life, pctHddAfter: pct(hdd.after) })}</p>
      <h2>{R(go, "browser-sites-2.wikiRAID25")}</h2>
      <p>{R(go, "browser-sites-2.wikiRAID26")}</p>
    </>,
  },
  {
    slug: "Uplink",
    title: t("browser-sites-2.wikiUplinkTitle"),
    category: "Networking",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiUplink1")}</p>
      <p>{R(go, "browser-sites-2.wikiUplink2")}</p>
      <p>{R(go, "browser-sites-2.wikiUplink3")}</p>
      <h2>{R(go, "browser-sites-2.wikiUplink4")}</h2>
      <ul>
        <li>{R(go, "browser-sites-2.wikiUplink5")}</li>
        <li>{R(go, "browser-sites-2.wikiUplink6")}</li>
        <li>{R(go, "browser-sites-2.wikiUplink7")}</li>
      </ul>
    </>,
  },
  {
    slug: "Digital_subscriber_line",
    title: t("browser-sites-2.wikiDigitalSubscriberLineTitle"),
    category: "Networking",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiDigitalSubscriberLine1")}</p>
      <h2>{R(go, "browser-sites-2.wikiDigitalSubscriberLine2")}</h2>
      <p>{R(go, "browser-sites-2.wikiDigitalSubscriberLine3", { down: MOMS_DSL.down, up: MOMS_DSL.up })}</p>
      <h2>{R(go, "browser-sites-2.wikiDigitalSubscriberLine4")}</h2>
      <p>{R(go, "browser-sites-2.wikiDigitalSubscriberLine5", { reconnect })}</p>
      <p>{R(go, "browser-sites-2.wikiDigitalSubscriberLine6", { addresses: STATIC_LINE_ADDRESSES })}</p>
      <h2>{R(go, "browser-sites-2.wikiDigitalSubscriberLine7")}</h2>
      <p>{R(go, "browser-sites-2.wikiDigitalSubscriberLine8")}</p>
      <h2>{R(go, "browser-sites-2.wikiDigitalSubscriberLine9")}</h2>
      <ul><li><W slug="Uplink" go={go}>{t("browser-sites-2.wikiUplinkTitle")}</W></li></ul>
    </>,
  },
  {
    slug: "IP_address",
    title: t("browser-sites-2.wikiIPAddressTitle"),
    category: "Networking",
    body: (go, year) => <>
      <Infobox title={t("browser-sites-2.wikiIPAddress1")} rows={[[t("browser-sites-2.wikiIPAddress2"), t("browser-sites-2.wikiIPAddress3")], [t("browser-sites-2.wikiIPAddress4"), "203.0.113.7"], [t("browser-sites-2.wikiIPAddress5"), "1981"]]} />
      <p>{R(go, "browser-sites-2.wikiIPAddress6")}</p>
      <h2>{R(go, "browser-sites-2.wikiIPAddress7")}</h2>
      <p>{R(go, "browser-sites-2.wikiIPAddress8")}</p>
      <h2>{R(go, "browser-sites-2.wikiIPAddress9")}</h2>
      <p>{R(go, "browser-sites-2.wikiIPAddress10", { price: euroPrice(providerV4(year, 1)) })}</p>
      <p>{R(go, "browser-sites-2.wikiIPAddress11")}</p>
    </>,
  },
  {
    slug: "Domain_name",
    title: t("browser-sites-2.wikiDomainNameTitle"),
    category: "Networking",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiDomainName1")}</p>
      <h2>{R(go, "browser-sites-2.wikiDomainName2")}</h2>
      <p>{R(go, "browser-sites-2.wikiDomainName3")}</p>
      <table className="wk-table">
        <thead><tr><th>{R(go, "browser-sites-2.wikiDomainName4")}</th><th>{R(go, "browser-sites-2.wikiDomainName5")}</th></tr></thead>
        <tbody>{Object.entries(REGISTRIES).map(([tld, r]) => <tr key={tld}><td>.{tld}</td><td>{r.name}</td></tr>)}</tbody>
      </table>
      <h2>{R(go, "browser-sites-2.wikiDomainName8")}</h2>
      <p>{R(go, "browser-sites-2.wikiDomainName9")}</p>
    </>,
  },
  {
    slug: "Operating_system",
    title: t("browser-sites-2.wikiOperatingSystemTitle"),
    category: "Software",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiOperatingSystem1", { osUrl, os: os.name })}</p>
      <p>{R(go, "browser-sites-2.wikiOperatingSystem2")}</p>
    </>,
  },
  {
    slug: "Web_hosting_control_panel",
    title: t("browser-sites-2.wikiWebHostingControlPanelTitle"),
    category: "Software",
    body: (go, year) => <>
      <p>{R(go, "browser-sites-2.wikiWebHostingControlPanel1")}</p>
      <p>{R(go, "browser-sites-2.wikiWebHostingControlPanel2")}</p>
      <h2>{R(go, "browser-sites-2.wikiWebHostingControlPanel3")}</h2>
      <SoftwareTable kind="panel" year={year} go={go} />
      <h2>{R(go, "browser-sites-2.wikiWebHostingControlPanel4")}</h2>
      <p>{R(go, "browser-sites-2.wikiWebHostingControlPanel5")}</p>
    </>,
  },
  {
    slug: "Hypervisor",
    title: t("browser-sites-2.wikiHypervisorTitle"),
    category: "Software",
    body: (go, year) => <>
      <p>{R(go, "browser-sites-2.wikiHypervisor1")}</p>
      <h2>{R(go, "browser-sites-2.wikiHypervisor2")}</h2>
      <SoftwareTable kind="cloud" year={year} go={go} />
      <h2>{R(go, "browser-sites-2.wikiHypervisor3")}</h2>
      <p>{R(go, "browser-sites-2.wikiHypervisor4")}</p>
      <h2>{R(go, "browser-sites-2.wikiHypervisor5")}</h2>
      <ul><li><W slug="Web_hosting_control_panel" go={go}>{t("browser-sites-2.wikiWebHostingControlPanelTitle")}</W></li></ul>
    </>,
  },
  {
    slug: "Email_blacklist",
    title: t("browser-sites-2.wikiEmailBlacklistTitle"),
    category: "Networking",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiEmailBlacklist1")}</p>
      <h2>{R(go, "browser-sites-2.wikiEmailBlacklist2")}</h2>
      <p>{R(go, "browser-sites-2.wikiEmailBlacklist3")}</p>
      <p>{R(go, "browser-sites-2.wikiEmailBlacklist4")}</p>
      <h2>{R(go, "browser-sites-2.wikiEmailBlacklist5")}</h2>
      <p>{R(go, "browser-sites-2.wikiEmailBlacklist6", { rEPFresh: REP.fresh, rEPStaticLine: REP.staticLine, rEPPerThousand: REP.perThousand, rEPRecover: REP.recover, rEPListAt: REP.listAt, rEPClearAt: REP.clearAt })}</p>
      <h2>{R(go, "browser-sites-2.wikiEmailBlacklist7")}</h2>
      <p>{R(go, "browser-sites-2.wikiEmailBlacklist8", { delistHours: DELIST_HOURS, rEPDelist: REP.delist })}</p>
    </>,
  },
  {
    slug: "Web_hosting",
    title: t("browser-sites-2.wikiWebHostingTitle"),
    category: "Business",
    body: (go) => <>
      <p>{R(go, "browser-sites-2.wikiWebHosting1")}</p>
      <h2>{R(go, "browser-sites-2.wikiWebHosting2")}</h2>
      <table className="wk-table">
        <thead><tr><th>{R(go, "browser-sites-2.wikiWebHosting3")}</th><th>{R(go, "browser-sites-2.wikiWebHosting4")}</th></tr></thead>
        <tbody>
          <tr><td>{R(go, "browser-sites-2.wikiWebHosting5")}</td><td>{R(go, "browser-sites-2.wikiWebHosting6")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiWebHosting7")}</td><td>{R(go, "browser-sites-2.wikiWebHosting8")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiWebHosting9")}</td><td>{R(go, "browser-sites-2.wikiWebHosting10")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiWebHosting11")}</td><td>{R(go, "browser-sites-2.wikiWebHosting12")}</td></tr>
          <tr><td>{R(go, "browser-sites-2.wikiWebHosting13")}</td><td>{R(go, "browser-sites-2.wikiWebHosting14")}</td></tr>
        </tbody>
      </table>
      <h2>{R(go, "browser-sites-2.wikiWebHosting15")}</h2>
      <p>{R(go, "browser-sites-2.wikiWebHosting16")}</p>
      <h2>{R(go, "browser-sites-2.wikiWebHosting17")}</h2>
      <p>{R(go, "browser-sites-2.wikiWebHosting18")}</p>
    </>,
  },
];
