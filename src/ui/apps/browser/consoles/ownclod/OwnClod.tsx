import { t } from "../../../../../i18n/en";
import { useState } from "react";
import { Cloud, Folder, LogOut } from "lucide-react";
import { disk } from "../../../hw";
import { Actions, Bar, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import { Shares } from "./Shares";
import { Users } from "./Users";
import "./ownclod.css";

// docs/design/software.md, section 10: white with a blue top bar and a file list until 2016, then a dark blue bar and cards.
const ERAS = erasFrom(2010, 2016);

export function OwnClod(p: PanelProps) {
  const era = eraAt(ERAS, p), [panelTab, setTab] = usePanelTab(p.f), [view, setView] = useState<"shares" | "users" | null>(null), tab: Tab | "shares" | "users" = view ?? panelTab;
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  const logo = <span className="oc-logo"><Cloud size={22} aria-hidden />ownClod</span>;
  if (!p.signedIn) return (
    <div className="cx oc oc-login" data-era={era}>
      <LoginForm className="oc-card" onLogin={p.login} button={t("browser-consoles-2.logIn")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const nav: [Tab, string][] = [["objects", t("browser-consoles-2.files")], ["software", t("browser-consoles-2.admin")], ...pages.map((g) => [g.id, g.label] as [Tab, string])];
  return (
    <div className="cx oc" data-era={era}>
      <header className="oc-top">
        {logo}
        <nav>
          {nav.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => { setView(null); setTab(id); }}>{label}</button>)}
          <button aria-pressed={tab === "shares"} onClick={() => setView("shares")}>{t("netsvc.sharedByLink")}</button>
          <button aria-pressed={tab === "users"} onClick={() => setView("users")}>{t("netsvc.users")}</button>
        </nav>
        <span className="cx-host">{p.host}</span>
        <button className="oc-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-2.logOut")}</button>
      </header>
      <main className="oc-main">
        {tab === "objects" && (era === "early"
          ? <table className="cx-table oc-files">
            <thead><tr><th>{t("browser-consoles-2.name")}</th><th>{t("browser-consoles-2.size")}</th><th>{t("browser-consoles-2.status")}</th><th /></tr></thead>
            <tbody>
              {rows.length === 0 && <tr><td colSpan={4} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
              {rows.map((r) => (
                <RowLines key={r.id} r={r} span={4}>
                  <td><Folder size={16} aria-hidden className="oc-folder" /><b>{r.name}</b></td><td className="num">{disk(Math.round(r.disk[0]))}</td>
                  <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                </RowLines>
              ))}
            </tbody>
          </table>
          : <div className="oc-grid">
            {rows.length === 0 && <p className="cx-empty">{t("browser-consoles-2.nothingHere")}</p>}
            {rows.map((r) => (
              <section key={r.id} className="oc-tile">
                <Folder size={40} aria-hidden className="oc-folder" />
                <b>{r.name}</b>
                <span className={`cx-state ${r.tone}`}>{r.state}</span>
                <Bar use={r.disk} /><span className="cx-use num">{t("browser-consoles-2.of", { used: disk(Math.round(r.disk[0])), total: disk(r.disk[1]) })}</span>
                <Actions actions={r.actions} className="cx-acts" />{r.panel}
              </section>
            ))}
          </div>)}
        {tab === "shares" && <Shares game={p.game} c={p.c} />}
        {tab === "users" && <Users game={p.game} c={p.c} />}
        {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
        {tab === "software" && <section className="oc-admin"><h2>{t("browser-consoles-2.updates")}</h2><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</section>}
      </main>
    </div>
  );
}
