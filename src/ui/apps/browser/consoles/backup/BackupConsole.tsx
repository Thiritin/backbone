import { FileText } from "lucide-react";
import { useState } from "react";
import { Archive, CalendarDays, HardDrive, LogOut, Settings, type LucideIcon } from "lucide-react";
import { softwareById } from "../../../../../sim/10-catalog/platforms";
import { backupPool } from "../../../../../sim/85-products/products";
import { disk } from "../../../hw";
import { Actions, Bar, Facts, LoginForm, useSoftware, type PanelProps } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import { t } from "../../../../../i18n/en";
import { Calendar, JobsPanel, skinOf } from "./Jobs";
import "./backup.css";

// One console for Backula, Veeham and Proxmocks Backup Server: the jobs that write here, the repository and the software.
export function BackupConsole(p: PanelProps) {
  const [tab, setTab] = useState<string>("objects"), skin = skinOf(p.c.panel), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f), name = softwareById(p.c.panel!).console;
  const logo = <span className="bk-logo"><Archive size={18} aria-hidden />{name}</span>;
  if (!p.signedIn) return (
    <div className="cx bk bk-login">
      <LoginForm className="bk-card" onLogin={p.login} button={t("browser-consoles-1.logIn")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const pool = backupPool(p.game, p.c.id);
  const nav: [string, string, LucideIcon][] = [["objects", t("browser-consoles-1.bkJobs"), Archive], ["points", t("bk.points"), CalendarDays], ["nodes", t("browser-consoles-1.bkRepository"), HardDrive], ["software", t("browser-consoles-1.settings"), Settings], ...pages.map((g) => [g.id, g.label, FileText] as [string, string, LucideIcon])];
  return (
    <div className="cx bk" data-skin={skin}>
      <header className="bk-top">{logo}<span className="cx-host">{p.host}</span><button className="cx-btn" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logOut")}</button></header>
      <nav className="bk-nav">{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={15} aria-hidden />{label}</button>)}</nav>
      <main className="bk-main">
        {tab === "objects" && <JobsPanel game={p.game} target={p.c} skin={skin} />}
        {tab === "points" && <Calendar game={p.game} target={p.c} />}
        {tab === "nodes" && (
          <table className="cx-table">
            <tbody>
              <tr><td>{t("browser-consoles-1.bkNeeded")}</td><td className="num">{disk(Math.round(pool.need))}</td></tr>
              <tr><td>{t("browser-consoles-1.free")}</td><td className="num">{disk(Math.round(Math.max(0, pool.room)))}</td></tr>
              <tr><td>{t("browser-consoles-1.use")}</td><td><Bar use={[pool.need, Math.max(pool.room, 1)]} /></td></tr>
            </tbody>
          </table>
        )}
        {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
        {tab === "software" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
      </main>
    </div>
  );
}
