import { LogOut, Search } from "lucide-react";
import { useState } from "react";
import { Backups, erasFrom, eraAt, Facts, LoginForm, Nodes, RowsTable, Tiles, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { AUTOSSL_FROM } from "../../../../../sim/60-infra/webpanel";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import { useSessionState } from "../../../../session";
import { Customer } from "./Customer";
import { AutoSsl } from "./AutoSsl";
import { PhpProfiles } from "./EasyApache";
import { ServiceManager } from "./ServiceManager";
import "./cpanic.css";

// docs/design/software.md, section 10: the x3 manager until 2014, then the flat one with grouped sections.
const ERAS = erasFrom(2005, 2014);

export function CPanic(p: PanelProps) {
  const era = eraAt(ERAS, p.game), open = parseCreate("cpanic", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "objects"), [q, setQ] = useState(""), [as, setAs] = useSessionState<string | null>(`browser.cpanic.as.${p.c.id}`, null);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx cp cp-login" data-era={era}>
      <LoginForm className="cp-card" onLogin={p.login} button={t("browser-consoles-1.logIn")}>
        <div className="cp-logo">cPanic<small>WebHost Manager</small></div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  if (as) return (
    <div className="cx cp" data-era={era}>
      <header className="cp-top">
        <span className="cp-logo">cPanic</span>
        <span className="cx-host">{p.host}</span>
        <button className="cp-out" onClick={() => setAs(null)}>{t("readouts.cp.backToWhm")}</button>
      </header>
      <Customer game={p.game} c={p.c} workloadId={as} />
    </div>
  );
  const menu: [string, [Tab, string][]][] = [
    [t("browser-consoles-1.cpAccountInfo"), [["objects", t("browser-consoles-1.cpListAccounts")]]],
    ...(p.f.cluster ? [[t("browser-consoles-1.cpClusters"), [["nodes", t("browser-consoles-1.cpClusterStatus")]]] as [string, [Tab, string][]]] : []),
    [t("pkg.accountFunctions"), [["create", t("pkg.cpCreate")]]],
    [t("pkg.packages"), [["packages", t("pkg.addPackage")]]],
    ...(yearOf(p.game.hour) >= AUTOSSL_FROM ? [[t("web.ssl.group"), [["autossl", t("web.ssl.menu")]]] as [string, [Tab, string][]]] : []),
    [t("browser-consoles-1.cpServerConfig"), [["software", t("browser-consoles-1.cpSoftwareUpdates")], ["easyapache", era === "early" ? t("web.ea.menu3") : t("web.ea.menu4")]]],
    ...(pages.length ? [[t("readouts.serverStatus"), [["services", t("readouts.services")] as [Tab, string], ...pages.map((g) => [g.id, g.label] as [Tab, string])]] as [string, [Tab, string][]]] : []),
  ];
  const title = menu.flatMap(([, items]) => items).find(([id]) => id === tab)?.[1];
  return (
    <div className="cx cp" data-era={era}>
      <header className="cp-top">
        <span className="cp-logo">cPanic<small>WebHost Manager</small></span>
        <span className="cx-host">{p.host}</span>
        <button className="cp-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logOut")}</button>
      </header>
      <div className="cp-body">
        <aside className="cp-menu">
          <label className="cp-find"><Search size={13} aria-hidden /><input placeholder={t("browser-consoles-1.find")} value={q} onChange={(e) => setQ(e.target.value)} /></label>
          {menu.map(([group, items]) => {
            const shown = items.filter(([, label]) => label.toLowerCase().includes(q.toLowerCase()));
            return shown.length > 0 && (
              <section key={group}>
                <h3>{group}</h3>
                {shown.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}
              </section>
            );
          })}
        </aside>
        <main className="cp-main">
          <h1>{title}</h1>
          {tab === "objects" && <RowsTable rows={rows} name={t("browser-consoles-1.domain")} cols={["user", "pkg"]} extra={(r) => <button className="cx-btn" onClick={() => setAs(r.id)}>{t("readouts.cp.loginAs")}</button>} />}
          {tab === "create" && (
            <ProvisionForm game={p.game} c={p.c} products={["webHosting"]} order={open?.screen === "create" ? open.order : undefined} className="cx-form cp-form"
              sections={{ order: t("pkg.order"), account: t("pkg.cpDomainInfo"), plan: t("pkg.cpSettings") }} />
          )}
          {tab === "packages" && <PackagesScreen game={p.game} c={p.c} />}
          {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
          {tab === "autossl" && <AutoSsl game={p.game} c={p.c} />}
          {tab === "easyapache" && <PhpProfiles game={p.game} c={p.c} x3={era === "early"} />}
          {tab === "services" && <ServiceManager game={p.game} c={p.c} />}
          {pages.find((g) => g.id === tab)?.body}
          {tab === "software" && (
            <>
              <h2>{t("browser-consoles-1.cpServerInfo")}</h2>
              <Facts facts={sw.facts} />
              <h2>{t("browser-consoles-1.software")}</h2>
              {sw.note && <p className="cx-note">{sw.note}</p>}
              <Tiles actions={sw.actions} />
              {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
            </>
          )}
        </main>
      </div>
    </div>
  );
}
