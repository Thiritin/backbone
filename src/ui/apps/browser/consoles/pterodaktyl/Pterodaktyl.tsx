import { FileText } from "lucide-react";
import { t } from "../../../../../i18n/en";
import { LogOut, Server, Settings, type LucideIcon } from "lucide-react";
import { Actions, Backups, Bar, cpuText, erasFrom, eraAt, Facts, LoginForm, ramText, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import "./pterodaktyl.css";

// docs/design/software.md, section 10: dark blue server cards with meters under a top bar, flatter with a sidebar from 2021.
const ERAS = erasFrom(2016, 2021);

export function Pterodaktyl(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx pt pt-login" data-era={era}>
      <LoginForm className="pt-card" onLogin={p.login} button={t("browser-consoles-2.login")}>
        <div className="pt-logo">Pterodaktyl</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const nav: [Tab, string, LucideIcon][] = [["objects", t("browser-consoles-2.servers"), Server], ["software", t("browser-consoles-2.settings"), Settings], ...pages.map((g) => [g.id, g.label, FileText] as [Tab, string, LucideIcon])];
  return (
    <div className="cx pt" data-era={era}>
      <header className="pt-nav">
        <span className="pt-logo">Pterodaktyl</span>
        <nav>{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={15} aria-hidden />{label}</button>)}</nav>
        <span className="cx-host">{p.host}</span>
        <button onClick={p.logout}><LogOut size={15} aria-hidden />{t("browser-consoles-2.logout")}</button>
      </header>
      <main className="pt-main">
        {tab !== "software" && rows.length === 0 && <p className="cx-empty">{t("browser-consoles-2.nothingHere")}</p>}
        {tab !== "software" && rows.map((r) => (
          <article key={r.id} className="pt-server">
            <span className={`pt-led ${r.tone}`} />
            <div className="pt-name"><b>{r.name}</b><span className="cx-sub">{r.node}</span></div>
            <div className="pt-meter"><span className="cx-use">{t("browser-consoles-2.cpu")}</span><Bar use={r.cpu} /><span className="cx-use num">{cpuText(r)}</span></div>
            <div className="pt-meter"><span className="cx-use">{t("browser-consoles-2.memory")}</span><Bar use={r.ram} /><span className="cx-use num">{ramText(r)}</span></div>
            <span className={`cx-state ${r.tone}`}>{r.state}</span>
            <Actions actions={r.actions} className="cx-acts" />
            {r.panel && <div className="pt-open">{r.panel}</div>}
          </article>
        ))}
        {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
        {tab === "software" && (
          <section className="pt-box">
            <Facts facts={sw.facts} />
            <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
            {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
          </section>
        )}
      </main>
    </div>
  );
}
