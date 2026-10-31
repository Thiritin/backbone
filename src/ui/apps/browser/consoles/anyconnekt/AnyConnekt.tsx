import { Home, KeyRound, LogOut, Settings, type LucideIcon } from "lucide-react";
import { useState, type ReactNode } from "react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { t } from "../../../../../i18n/en";
import { IdentityCerts } from "./IdentityCerts";
import { tenants } from "../services";
import "./anyconnekt.css";

// docs/design/software.md, section 10: the blue device-manager tabs until 2016, then flat white and teal.
const ERAS = erasFrom(2005, 2016);

export function AnyConnekt(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f), [certs, setCerts] = useState(false);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), ts = tenants(p.game, p.c);
  const logo = <span className="sy-logo"><i aria-hidden>{"|||.|||."}</i>SYSKO <b>AnyConnekt</b></span>;
  if (!p.signedIn) return (
    <div className="cx sy sy-login" data-era={era}>
      <LoginForm className="sy-card" onLogin={p.login} button={t("browser-consoles-1.login")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const sessions = ts.reduce((n, x) => n + (x.running ? x.users : 0), 0);
  const nav: [Tab, string, LucideIcon][] = [["objects", t("browser-consoles-1.acHome"), Home], ["software", t("browser-consoles-1.acConfiguration"), Settings]];
  const box = (title: string, body: ReactNode) => <section className="sy-box"><h2>{title}</h2>{body}</section>;
  return (
    <div className="cx sy" data-era={era}>
      <header className="sy-top">
        {logo}
        <nav>{nav.map(([id, label, Icon]) => <button key={id} aria-pressed={tab === id && !certs} onClick={() => { setTab(id); setCerts(false); }}><Icon size={era === "early" ? 22 : 15} aria-hidden />{label}</button>)}
          <button aria-pressed={certs} onClick={() => setCerts(true)}><KeyRound size={era === "early" ? 22 : 15} aria-hidden />{t("netsvc.certificates")}</button></nav>
        <span className="cx-host">{p.host}</span>
        <button className="sy-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-1.logout")}</button>
      </header>
      <main className="sy-main">
        {certs && <IdentityCerts game={p.game} c={p.c} era={era} />}
        {!certs && tab === "objects" && <>
          {box(t("browser-consoles-1.acDeviceInfo"), <Facts facts={[{ label: t("browser-consoles-1.software"), value: `AnyConnekt ${p.c.version}`, num: true }, { label: t("browser-consoles-1.acVpnSessions"), value: String(sessions), num: true }, { label: t("browser-consoles-1.acGateways"), value: String(rows.length), num: true }]} />)}
          {box(t("browser-consoles-1.acVpnGateways"), (
            <table className="cx-table">
              <thead><tr><th>{t("browser-consoles-1.acGateway")}</th><th>{t("browser-consoles-1.account")}</th><th>{t("browser-consoles-1.acLicensedUsers")}</th><th>{t("browser-consoles-1.status")}</th><th /></tr></thead>
              <tbody>
                {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-1.nothingYet")}</td></tr>}
                {rows.map((r) => {
                  const tn = ts.find((x) => x.id === r.id);
                  return (
                    <RowLines key={r.id} r={r} span={5}>
                      <td><b>{r.name}</b></td><td>{tn?.customer}</td><td className="num">{tn?.users}</td>
                      <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                    </RowLines>
                  );
                })}
              </tbody>
            </table>
          ))}
        </>}
        {!certs && tab === "software" && box(t("browser-consoles-1.softwareUpdates"), <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>)}
      </main>
    </div>
  );
}
