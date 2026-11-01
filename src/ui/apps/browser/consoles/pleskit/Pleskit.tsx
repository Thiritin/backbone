import { t } from "../../../../../i18n/en";
import { Blocks, Globe, ListChecks, LogOut, Network, Package, ShieldBan, UserPlus, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, Backups, erasFrom, eraAt, Facts, LoginForm, Nodes, Tiles, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import { Advisor } from "./Advisor";
import { Fail2Ban } from "./Fail2Ban";
import { Toolkit } from "./Toolkit";
import { SubscriptionList } from "./SubscriptionList";
import { yearOf } from "../../../../../sim/00-core/time";
import { FAIL2BAN_FROM } from "../../../../../sim/60-infra/bans";
import "./pleskit.css";

// docs/design/software.md, section 10: the 8.x icon grids until 2015, then white with a dark sidebar and flat cards.
const ERAS = erasFrom(2005, 2015);

export function Pleskit(p: PanelProps) {
  const era = eraAt(ERAS, p.game), open = parseCreate("pleskit", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "objects");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx pk pk-login" data-era={era}>
      <LoginForm className="pk-card" onLogin={p.login} button={t("browser-consoles-2.logIn")}>
        <div className="pk-logo">pleskit</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nav: [Tab, string, LucideIcon][] = [
    ["objects", t("browser-consoles-2.websitesDomains"), Globe], ["create", t("pkg.pkAdd"), UserPlus], ["packages", t("pkg.pkPlans"), Package], ...(p.f.cluster ? [["nodes", t("browser-consoles-2.nodes"), Network] as [Tab, string, LucideIcon]] : []), ["software", t("browser-consoles-2.toolsSettings"), Wrench],
    ["toolkit", era === "late" ? t("web.tk.menu") : t("web.tk.apps"), Blocks] as [Tab, string, LucideIcon],
    ...(yearOf(p.game.hour) >= FAIL2BAN_FROM + 1 ? [["fail2ban", t("web.ban.menu"), ShieldBan] as [Tab, string, LucideIcon]] : []),
    ...pages.map((g) => [g.id, g.label, ListChecks] as [Tab, string, LucideIcon]),
  ];
  const card = (title: string, body: ReactNode) => <section className="pk-box"><h2>{title}</h2>{body}</section>;
  return (
    <div className="cx pk" data-era={era}>
      <header className="pk-top">
        <span className="pk-logo">pleskit</span>
        <span className="cx-host">{p.host}</span>
        <button className="pk-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-2.logOut")}</button>
      </header>
      <div className="pk-body">
        <aside className="pk-side">
          {era === "early" && <h3>{t("browser-consoles-2.general")}</h3>}
          {nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} aria-hidden />{label}</button>)}
        </aside>
        <main className="pk-main">
          <h1>{nav.find(([id]) => id === tab)?.[1]}</h1>
          {tab === "objects" && era === "late" && <Advisor game={p.game} c={p.c} onFix={() => setTab("software")} />}
          {tab === "objects" && card(t("web.sub.title"), <SubscriptionList game={p.game} c={p.c} rows={rows} late={era === "late"} />)}
          {tab === "create" && card(t("pkg.pkAdd"), <ProvisionForm game={p.game} c={p.c} products={["webHosting"]} order={open?.screen === "create" ? open.order : undefined} sections={{ order: t("pkg.order"), account: t("pkg.account"), plan: t("pkg.settings") }} />)}
          {tab === "packages" && card(t("pkg.pkPlans"), <PackagesScreen game={p.game} c={p.c} />)}
          {tab === "nodes" && card(t("browser-consoles-2.nodes"), <Nodes game={p.game} c={p.c} />)}
          {tab === "toolkit" && card(era === "late" ? t("web.tk.menu") : t("web.tk.apps"), <Toolkit game={p.game} c={p.c} late={era === "late"} />)}
          {tab === "fail2ban" && card(t("web.ban.menu"), <Fail2Ban game={p.game} c={p.c} />)}
          {pages.map((g) => tab === g.id && card(g.label, g.body))}
          {tab === "software" && (era === "early"
            ? <>{card(t("browser-consoles-2.tools"), <>{sw.note && <p className="cx-note">{sw.note}</p>}<Tiles actions={sw.actions} /></>)}{sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}{card(t("browser-consoles-2.serverInformation"), <Facts facts={sw.facts} />)}</>
            : <div className="pk-cards">
              {card(t("browser-consoles-2.serverInformation"), <Facts facts={sw.facts} />)}
              {card(t("browser-consoles-2.updatesManagement"), <><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}</>)}
            </div>)}
        </main>
      </div>
    </div>
  );
}
