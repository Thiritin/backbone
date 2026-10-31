import { Actions, Backups, Bar, cpuText, erasFrom, eraAt, Facts, LoginForm, ramText, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Row, type Tab } from "../PanelBase";
import { useReadoutPages } from "../Readouts";
import { t } from "../../../../../i18n/en";
import "./multikraft.css";

// docs/design/software.md, section 10: dark grey under a brown header with status dot tables until 2018, then white, green and cards.
const ERAS = erasFrom(2010, 2018);

const Dot = ({ r }: { r: Row }) => <span className="mk-status"><i className={`mk-dot ${r.tone}`} />{r.state}</span>;

export function MultiKraft(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx mk mk-login" data-era={era}>
      <LoginForm className="mk-card" onLogin={p.login} button={t("browser-consoles-1.login")}>
        <div className="mk-logo">MultiKraft</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const menu: [Tab, string][] = [["objects", t("browser-consoles-1.mkServers")], ["software", t("browser-consoles-1.settings")], ...pages.map((g) => [g.id, g.label] as [Tab, string])];
  return (
    <div className="cx mk" data-era={era}>
      <header className="mk-top">
        <span className="mk-logo">MultiKraft</span>
        <nav>{menu.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</nav>
        <span className="cx-host">{p.host}</span>
        <button onClick={p.logout}>{t("browser-consoles-1.logout")}</button>
      </header>
      <main className="mk-main">
        {tab !== "software" && rows.length === 0 && <p className="cx-empty">{t("browser-consoles-1.nothingYet")}</p>}
        {tab !== "software" && rows.length > 0 && (era === "early"
          ? (
            <table className="cx-table">
              <thead><tr><th>{t("browser-consoles-1.mkServer")}</th><th>{t("browser-consoles-1.status")}</th><th>{t("browser-consoles-1.memory")}</th><th>{t("browser-consoles-1.cpu")}</th><th /></tr></thead>
              <tbody>
                {rows.map((r) => (
                  <RowLines key={r.id} r={r} span={5}>
                    <td><b>{r.name}</b></td>
                    <td><Dot r={r} /></td>
                    <td><Bar use={r.ram} /><span className="cx-use num">{ramText(r)}</span></td>
                    <td className="cx-use num">{cpuText(r)}</td>
                    <td><Actions actions={r.actions} className="cx-acts" /></td>
                  </RowLines>
                ))}
              </tbody>
            </table>
          )
          : (
            <div className="mk-cards">
              {rows.map((r) => (
                <article key={r.id} className="mk-server">
                  <header><b>{r.name}</b><Dot r={r} /></header>
                  <div><span className="cx-use">{t("browser-consoles-1.memory")}</span><Bar use={r.ram} /><span className="cx-use num">{ramText(r)}</span></div>
                  <div><span className="cx-use">{t("browser-consoles-1.cpu")}</span><Bar use={r.cpu} /><span className="cx-use num">{cpuText(r)}</span></div>
                  <Actions actions={r.actions} className="cx-acts" />
                  {r.panel}
                </article>
              ))}
            </div>
          ))}
        {pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
        {tab === "software" && (
          <>
            <Facts facts={sw.facts} />
            <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
            {sw.panel}{p.f.backups && <Backups game={p.game} c={p.c} />}
          </>
        )}
      </main>
    </div>
  );
}
