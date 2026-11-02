import { t } from "../../../../../i18n/en";
import { Blocks, Boxes, Cog, Globe, RefreshCw, ListChecks, LogOut, Network, Package, ShieldBan, UserPlus, Wrench, type LucideIcon } from "lucide-react";
import type { ReactNode } from "react";
import { Actions, eraAt, looks, Facts, LoginForm, Nodes, Tiles, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import { Advisor } from "./Advisor";
import { hasUpdates, UpdatesPage } from "../UpdatesPage";
import { ServicesPage } from "../ServicesPage";
import { ComponentsPage } from "../ComponentsPage";
import { Fail2Ban } from "./Fail2Ban";
import { Toolkit } from "./Toolkit";
import { SubscriptionList } from "./SubscriptionList";
import { yearOf } from "../../../../../sim/00-core/time";
import { FAIL2BAN_FROM } from "../../../../../sim/60-infra/bans";
import "./pleskit.css";

// docs/design/software.md, section 10: one look per Plesk UI generation, ids as in UI_LOOKS.
const LOOKS = looks({ reload: 2005, parallax: 2010, twelve: 2014, onyx: 2016, obsidian: 2019 });

export function Pleskit(p: PanelProps) {
  const era = eraAt(LOOKS, p), late = era === "onyx" || era === "obsidian", open = parseCreate("pleskit", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "objects");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  const logo = <div className="pk-logo">{era === "parallax" && <small>Parallax</small>}pleskit{era === "parallax" && <small>Panel</small>}</div>;
  if (!p.signedIn) return (
    <div className="cx pk pk-login" data-era={era}>
      <LoginForm className="pk-card" onLogin={p.login} button={t("browser-consoles-2.logIn")}>
        {logo}
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nav: [Tab, string, LucideIcon][] = [
    ["objects", t("browser-consoles-2.websitesDomains"), Globe], ["create", t("pkg.pkAdd"), UserPlus], ["packages", t("pkg.pkPlans"), Package], ...(p.f.cluster ? [["nodes", t("browser-consoles-2.nodes"), Network] as [Tab, string, LucideIcon]] : []), ["software", t("browser-consoles-2.toolsSettings"), Wrench],
    ...(hasUpdates(p.game, p.c) ? [["updates", t("panel-updates.updates"), RefreshCw] as [Tab, string, LucideIcon]] : []),
    ["toolkit", late ? t("web.tk.menu") : t("web.tk.apps"), Blocks] as [Tab, string, LucideIcon],
    ["services", t("panel-services.pkServices"), Cog], ["components", t("panel-services.pkMenu"), Boxes],
    ...(yearOf(p.game.hour) >= FAIL2BAN_FROM + 1 ? [["fail2ban", t("web.ban.menu"), ShieldBan] as [Tab, string, LucideIcon]] : []),
    ...pages.map((g) => [g.id, g.label, ListChecks] as [Tab, string, LucideIcon]),
  ];
  const card = (title: string, body: ReactNode) => <section className="pk-box"><h2>{title}</h2>{body}</section>;
  return (
    <div className="cx pk" data-era={era}>
      <header className="pk-top">
        {logo}
        <span className="cx-host">{p.host}</span>
        <button className="pk-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-2.logOut")}</button>
      </header>
      <div className="pk-body">
        <aside className="pk-side">
          {era === "reload" && <h3>{t("browser-consoles-2.general")}</h3>}
          {nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} aria-hidden />{label}</button>)}
        </aside>
        <main className="pk-main">
          <h1>{nav.find(([id]) => id === tab)?.[1]}</h1>
          {tab === "objects" && late && <Advisor game={p.game} c={p.c} onFix={() => setTab("software")} />}
          {tab === "objects" && card(t("web.sub.title"), <SubscriptionList game={p.game} c={p.c} rows={rows} late={late} />)}
          {tab === "create" && card(t("pkg.pkAdd"), <ProvisionForm game={p.game} c={p.c} products={["webHosting"]} order={open?.screen === "create" ? open.order : undefined} sections={{ order: t("pkg.order"), account: t("pkg.account"), plan: t("pkg.settings") }} />)}
          {tab === "packages" && card(t("pkg.pkPlans"), <PackagesScreen game={p.game} c={p.c} />)}
          {tab === "nodes" && card(t("browser-consoles-2.nodes"), <Nodes game={p.game} c={p.c} />)}
          {tab === "toolkit" && card(late ? t("web.tk.menu") : t("web.tk.apps"), <Toolkit game={p.game} c={p.c} late={late} />)}
          {tab === "fail2ban" && card(t("web.ban.menu"), <Fail2Ban game={p.game} c={p.c} />)}
          {pages.map((g) => tab === g.id && card(g.label, g.body))}
          {tab === "services" && card(t("panel-services.pkServices"), <ServicesPage game={p.game} c={p.c} />)}
          {tab === "components" && card(t("panel-services.pkMenu"), <ComponentsPage game={p.game} c={p.c} />)}
          {tab === "updates" && card(t("panel-updates.updates"), <UpdatesPage game={p.game} c={p.c} />)}
          {tab === "software" && (!late
            ? <>{card(t("browser-consoles-2.tools"), <>{sw.note && <p className="cx-note">{sw.note}</p>}<Tiles actions={sw.actions} /></>)}{sw.panel}{card(t("browser-consoles-2.serverInformation"), <Facts facts={sw.facts} />)}</>
            : <div className="pk-cards">
              {card(t("browser-consoles-2.serverInformation"), <Facts facts={sw.facts} />)}
              {card(t("browser-consoles-2.updatesManagement"), <><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>)}
            </div>)}
        </main>
      </div>
    </div>
  );
}
