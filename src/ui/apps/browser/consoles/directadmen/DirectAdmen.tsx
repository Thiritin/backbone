import { Search } from "lucide-react";
import { useState } from "react";
import { eraAt, looks, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps } from "../PanelBase";
import { t } from "../../../../../i18n/en";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import { CustomBuild } from "./CustomBuild";
import { ServicesPage } from "../ServicesPage";
import { ComponentsPage } from "../ComponentsPage";
import { BackupManager } from "../BackupManager";
import { hasUpdates, UpdatesPage } from "../UpdatesPage";
import { Messages } from "./Messages";
import { ManageResellers } from "./ManageResellers";
import { ResellerLevel } from "./ResellerLevel";
import { UserLevel } from "./UserLevel";
import { resellersOn } from "../../../../../sim/30-customers/resellers";
import "./directadmen.css";

// docs/design/software.md, section 10: one look per DirectAdmin skin, ids as in UI_LOOKS.
const LOOKS = looks({ classic: 2005, enhanced: 2008, evolution: 2019 });

// The software tab is the home page: server manager links, tools and server facts side by side.
export function DirectAdmen(p: PanelProps) {
  const era = eraAt(LOOKS, p), late = era === "evolution", open = parseCreate("directadmen", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "software"), [q, setQ] = useState(""), [level, setLevel] = useState<"admin" | "reseller" | "user">("admin");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx da da-login" data-era={era}>
      <LoginForm className="da-card" onLogin={p.login} button={t("browser-consoles-2.login")}>
        <div className="da-logo">DirectAdmen</div>
        <div className="cx-host">{p.host}</div>
        <label className="cx-field">{t("web.da.level")}
          <select value={level} onChange={(e) => setLevel(e.target.value as "admin" | "reseller" | "user")}>
            <option value="admin">{t("web.da.admin")}</option>
            {resellersOn(p.game, p.c.id).length > 0 && <option value="reseller">{t("web.rs.level")}</option>}
            <option value="user">{t("web.da.user")}</option>
          </select>
        </label>
      </LoginForm>
    </div>
  );
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const crumb = tab === "objects" ? t("browser-consoles-2.webSpaces") : tab === "nodes" ? t("browser-consoles-2.nodes") : tab === "create" ? t("pkg.daCreate") : tab === "packages" ? t("pkg.daPackages") : tab === "custombuild" ? t("web.da.customBuild") : tab === "messages" ? t("web.msg.menu") : tab === "updates" ? t("panel-updates.updates") : tab === "services" ? t("panel-services.daServices") : tab === "backup" ? t("panel-backup.tab.directadmen") : pages.find((g) => g.id === tab)?.label ?? null;
  return (
    <div className="cx da" data-era={era}>
      <header className="da-top">
        <span className="da-logo">DirectAdmen</span>
        <span className="da-level">{level === "user" ? t("web.da.userLevel") : level === "reseller" ? t("web.rs.level") : t("browser-consoles-2.adminLevel")}</span>
        {late && (
          <label className="da-search"><Search size={14} aria-hidden />
            <input placeholder={t("browser-consoles-2.search")} value={q} onChange={(e) => { setQ(e.target.value); setTab("objects"); }} />
          </label>
        )}
        <span className="cx-host">{p.host}</span>
        <button className="da-link" onClick={p.logout}>{t("browser-consoles-2.logout")}</button>
      </header>
      <main className="da-main">
        <nav className="da-crumb"><button className="da-link" onClick={() => setTab("software")}>{t("browser-consoles-2.home")}</button>{crumb && <> » {crumb}</>}</nav>
        {level === "user" ? <UserLevel game={p.game} c={p.c} rows={rows} /> : level === "reseller" ? <ResellerLevel game={p.game} c={p.c} /> : <>
        {tab === "custombuild" && <><CustomBuild game={p.game} c={p.c} late={late} /><ComponentsPage game={p.game} c={p.c} /></>}
        {tab === "services" && <ServicesPage game={p.game} c={p.c} />}
        {tab === "backup" && <BackupManager game={p.game} c={p.c} />}
        {tab === "resellers" && <ManageResellers game={p.game} c={p.c} />}
        {tab === "updates" && <UpdatesPage game={p.game} c={p.c} />}
        {tab === "messages" && <Messages game={p.game} c={p.c} late={late} />}
        {tab === "objects" && <RowsTable rows={shown} name={t("browser-consoles-2.domain")} />}
        {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
        {tab === "create" && <ProvisionForm game={p.game} c={p.c} products={["webHosting"]} order={open?.screen === "create" ? open.order : undefined} className="cx-form da-form" />}
        {tab === "packages" && <PackagesScreen game={p.game} c={p.c} />}
        {pages.find((g) => g.id === tab)?.body}
        {tab === "software" && (
          <>
            <div className="da-cols">
              <section>
                <h2>{t("browser-consoles-2.serverManager")}</h2>
                <button className="da-link" onClick={() => setTab("objects")}>{t("browser-consoles-2.showAllWebSpaces")}</button>
                <button className="da-link" onClick={() => setTab("create")}>{t("pkg.daCreate")}</button>
                <button className="da-link" onClick={() => setTab("packages")}>{t("pkg.daPackages")}</button>
                <button className="da-link" onClick={() => setTab("custombuild")}>{t("web.da.customBuild")}</button>
                <button className="da-link" onClick={() => setTab("messages")}>{t("web.msg.menu")}</button>
                <button className="da-link" onClick={() => setTab("resellers")}>{t("web.rs.manage")}</button>
                {hasUpdates(p.game, p.c) && <button className="da-link" onClick={() => setTab("updates")}>{t("panel-updates.updates")}</button>}
                {p.f.cluster && <button className="da-link" onClick={() => setTab("nodes")}>{t("browser-consoles-2.nodes")}</button>}
                {pages.map((g) => <button key={g.id} className="da-link" onClick={() => setTab(g.id)}>{g.label}</button>)}
              </section>
              <section>
                <h2>{t("browser-consoles-2.serverTools")}</h2>
                <button className="da-link" onClick={() => setTab("services")}>{t("panel-services.daServices")}</button>
                {p.f.backups && <button className="da-link" onClick={() => setTab("backup")}>{t("panel-backup.tab.directadmen")}</button>}
                {sw.note && <span className="cx-note">{sw.note}</span>}
                {sw.actions.map((a) => <button key={a.id} className={`da-link ${a.tone ?? ""}`} onClick={a.run}>{a.label}</button>)}
              </section>
              <section>
                <h2>{t("browser-consoles-2.serverInfo")}</h2>
                <dl>{sw.facts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd className={x.num ? "num" : undefined}>{x.value}</dd></div>)}</dl>
              </section>
            </div>
            {sw.panel}
          </>
        )}
        </>}
      </main>
    </div>
  );
}
