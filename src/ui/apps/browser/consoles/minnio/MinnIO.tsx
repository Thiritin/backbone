import { FileText } from "lucide-react";
import { Database, LogOut, Settings, type LucideIcon } from "lucide-react";
import { disk } from "../../../hw";
import { Actions, Bar, erasFrom, eraAt, Facts, LoginForm, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import { t } from "../../../../../i18n/en";
import { hash } from "../services";
import { BucketPage } from "./BucketPage";
import { Drives } from "./Drives";
import "./minnio.css";

// docs/design/software.md, section 10: dark with red and a bucket list until 2021, then white with red and bucket cards.
const ERAS = erasFrom(2016, 2021);

export function MinnIO(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  const logo = <span className="mn-logo">MINN<b>IO</b></span>;
  if (!p.signedIn) return (
    <div className="cx mn mn-login" data-era={era}>
      <LoginForm className="mn-card" onLogin={p.login} button={t("browser-consoles-1.login")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const nav: [Tab, string, LucideIcon][] = [["objects", t("browser-consoles-1.mnBuckets"), Database], ["software", t("browser-consoles-1.settings"), Settings], ...pages.map((g) => [g.id, g.label, FileText] as [Tab, string, LucideIcon])];
  return (
    <div className="cx mn" data-era={era}>
      <aside className="mn-side">
        {logo}
        <nav>{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><Icon size={16} aria-hidden />{label}</button>)}</nav>
        <button className="mn-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logout")}</button>
      </aside>
      <main className="mn-main">
        <div className="mn-head"><h1>{nav.find(([id]) => id === tab)?.[1]}</h1><span className="cx-host">{p.host}</span></div>
        {tab === "objects" && <div className={era === "early" ? "mn-list" : "mn-cards"}>
          {rows.length === 0 && <p className="cx-empty">{t("browser-consoles-1.nothingYet")}</p>}
          {rows.map((r) => (
            <section key={r.id} className="mn-bucket">
              <Database size={era === "early" ? 16 : 22} aria-hidden className="mn-icon" />
              <b>{r.name}</b>
              <span className="mn-meta num">{t("browser-consoles-1.mnObjects", { n: (hash(r.id) % 90_000) + 120 })}</span>
              <span className="mn-meta num">{disk(Math.round(r.disk[0]))}</span>
              {era === "late" && <Bar use={r.disk} />}
              <span className={`cx-state ${r.tone}`}>{r.state}</span>
              <Actions actions={r.actions} className="cx-acts" />
              {r.panel}
            </section>
          ))}
        </div>}
        {tab === "objects" && <BucketPage game={p.game} c={p.c} />}
        {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
        {tab === "software" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}<Drives game={p.game} c={p.c} /></>}
      </main>
    </div>
  );
}
