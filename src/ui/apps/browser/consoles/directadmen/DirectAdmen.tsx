import { Search } from "lucide-react";
import { useState } from "react";
import { Backups, erasFrom, eraAt, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps } from "../PanelBase";
import { t } from "../../../../../i18n/en";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import "./directadmen.css";

// docs/design/software.md, section 10: the enhanced skin's three link columns until 2018, then a dark bar, cards and a search.
const ERAS = erasFrom(2005, 2018);

// The software tab is the home page: server manager links, tools and server facts side by side.
export function DirectAdmen(p: PanelProps) {
  const era = eraAt(ERAS, p.game), open = parseCreate("directadmen", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "software"), [q, setQ] = useState("");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx da da-login" data-era={era}>
      <LoginForm className="da-card" onLogin={p.login} button={t("browser-consoles-2.login")}>
        <div className="da-logo">DirectAdmen</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const shown = rows.filter((r) => r.name.toLowerCase().includes(q.toLowerCase()));
  const crumb = tab === "objects" ? t("browser-consoles-2.webSpaces") : tab === "nodes" ? t("browser-consoles-2.nodes") : tab === "create" ? t("pkg.daCreate") : tab === "packages" ? t("pkg.daPackages") : pages.find((g) => g.id === tab)?.label ?? null;
  return (
    <div className="cx da" data-era={era}>
      <header className="da-top">
        <span className="da-logo">DirectAdmen</span>
        <span className="da-level">{t("browser-consoles-2.adminLevel")}</span>
        {era === "late" && (
          <label className="da-search"><Search size={14} aria-hidden />
            <input placeholder={t("browser-consoles-2.search")} value={q} onChange={(e) => { setQ(e.target.value); setTab("objects"); }} />
          </label>
        )}
        <span className="cx-host">{p.host}</span>
        <button className="da-link" onClick={p.logout}>{t("browser-consoles-2.logout")}</button>
      </header>
      <main className="da-main">
        <nav className="da-crumb"><button className="da-link" onClick={() => setTab("software")}>{t("browser-consoles-2.home")}</button>{crumb && <> » {crumb}</>}</nav>
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
                {p.f.cluster && <button className="da-link" onClick={() => setTab("nodes")}>{t("browser-consoles-2.nodes")}</button>}
                {pages.map((g) => <button key={g.id} className="da-link" onClick={() => setTab(g.id)}>{g.label}</button>)}
              </section>
              <section>
                <h2>{t("browser-consoles-2.serverTools")}</h2>
                {sw.note && <span className="cx-note">{sw.note}</span>}
                {sw.actions.map((a) => <button key={a.id} className={`da-link ${a.tone ?? ""}`} onClick={a.run}>{a.label}</button>)}
              </section>
              <section>
                <h2>{t("browser-consoles-2.serverInfo")}</h2>
                <dl>{sw.facts.map((x) => <div key={x.label}><dt>{x.label}</dt><dd className={x.num ? "num" : undefined}>{x.value}</dd></div>)}</dl>
              </section>
            </div>
            {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
          </>
        )}
      </main>
    </div>
  );
}
