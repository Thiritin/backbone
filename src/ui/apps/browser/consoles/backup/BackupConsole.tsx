import { Archive, HardDrive, LogOut, Settings, type LucideIcon } from "lucide-react";
import { softwareById } from "../../../../../sim/10-catalog/platforms";
import { backupPool } from "../../../../../sim/85-products/products";
import { disk } from "../../../hw";
import { Actions, Bar, Facts, LoginForm, usePanelTab, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import "./backup.css";

// One console for Backula, Veeham and Proxmocks Backup Server: the jobs that write here, the repository and the software.
export function BackupConsole(p: PanelProps) {
  const [tab, setTab] = usePanelTab(p.f), sw = useSoftware(p.game, p.c, p.f), name = softwareById(p.c.panel!).console;
  const logo = <span className="bk-logo"><Archive size={18} aria-hidden />{name}</span>;
  if (!p.signedIn) return (
    <div className="cx bk bk-login">
      <LoginForm className="bk-card" onLogin={p.login} button="Log in">{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const jobs = p.game.clusters.filter((c) => c.backup.targetId === p.c.id);
  const pool = backupPool(p.game, p.c.id);
  const nav: [Tab, string, LucideIcon][] = [["objects", "Jobs", Archive], ["nodes", "Repository", HardDrive], ["software", "Settings", Settings]];
  return (
    <div className="cx bk">
      <header className="bk-top">{logo}<span className="cx-host">{p.host}</span><button className="cx-btn" onClick={p.logout}><LogOut size={14} aria-hidden />Log out</button></header>
      <nav className="bk-nav">{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={15} aria-hidden />{label}</button>)}</nav>
      <main className="bk-main">
        {tab === "objects" && (jobs.length === 0 ? <p className="cx-empty">No jobs</p> : (
          <table className="cx-table">
            <thead><tr><th>Job</th><th>Source</th><th>Schedule</th><th>Last run</th><th>Size</th></tr></thead>
            <tbody>
              {jobs.map((c) => {
                const ws = p.game.workloads.filter((w) => w.clusterId === c.id), last = Math.max(-1, ...ws.map((w) => w.backupAt ?? -1));
                return (
                  <tr key={c.id}>
                    <td><b>{c.name}</b></td>
                    <td>{softwareById(c.panel ?? c.platform!).name}</td>
                    <td className="cx-cap">{c.backup.every}</td>
                    <td className="num">{last < 0 ? "Never" : `${p.game.hour - last} h ago`}</td>
                    <td className="num">{disk(Math.round(ws.reduce((n, w) => n + w.diskGb, 0)))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ))}
        {tab === "nodes" && (
          <table className="cx-table">
            <tbody>
              <tr><td>Needed</td><td className="num">{disk(Math.round(pool.need))}</td></tr>
              <tr><td>Free</td><td className="num">{disk(Math.round(Math.max(0, pool.room)))}</td></tr>
              <tr><td>Use</td><td><Bar use={[pool.need, Math.max(pool.room, 1)]} /></td></tr>
            </tbody>
          </table>
        )}
        {tab === "software" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
      </main>
    </div>
  );
}
