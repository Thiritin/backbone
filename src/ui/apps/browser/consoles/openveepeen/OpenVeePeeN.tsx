import { t } from "../../../../../i18n/en";
import { useState } from "react";
import { LogOut } from "lucide-react";
import { Actions, erasFrom, eraAt, Facts, LoginForm, RowLines, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { Certificates } from "./Certificates";
import { useReadoutPages } from "../Readouts";
import { tenants } from "../services";
import { VpnReadout } from "../ServiceReadouts";
import "./openveepeen.css";

// docs/design/software.md, section 10: the orange and grey admin with a left menu until 2017, then dark with orange cards.
const ERAS = erasFrom(2005, 2017);

export function OpenVeePeeN(p: PanelProps) {
  const era = eraAt(ERAS, p.game), [tab, setTab] = usePanelTab(p.f), [certs, setCerts] = useState(false);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f), ts = tenants(p.game, p.c);
  const logo = <div className="ov-logo">OpenVeePeeN <span>Access Server</span></div>;
  if (!p.signedIn) return (
    <div className="cx ov ov-login" data-era={era}>
      <LoginForm className="ov-card" onLogin={p.login} button={t("browser-consoles-2.signIn")}>{logo}<div className="cx-host">{p.host}</div></LoginForm>
    </div>
  );
  const users = ts.reduce((n, t) => n + (t.running ? t.users : 0), 0);
  const nav: [string, Tab, string][] = [[t("browser-consoles-2.status"), "objects", t("browser-consoles-2.statusOverview")], [t("browser-consoles-2.configuration"), "software", t("browser-consoles-2.softwareUpdates")], ...pages.map((g) => [g.label, g.id, g.label] as [string, Tab, string])];
  const userOf = (id: string) => ts.find((t) => t.id === id);
  return (
    <div className="cx ov" data-era={era}>
      <header className="ov-top">{logo}<span className="cx-host">{p.host}</span><button className="ov-out" onClick={p.logout}><LogOut size={14} aria-hidden />{t("browser-consoles-2.logout")}</button></header>
      <div className="ov-body">
        <aside className="ov-side">
          {nav.map(([group, id, label]) => <div key={id}><h3>{group}</h3><button aria-pressed={tab === id && !certs} onClick={() => { setTab(id); setCerts(false); }}>{label}</button></div>)}
          <div><h3>{t("netsvc.userManagement")}</h3><button aria-pressed={certs} onClick={() => setCerts(true)}>{t("netsvc.userPermissions")}</button></div>
        </aside>
        <main className="ov-main">
          <h1>{certs ? t("netsvc.userPermissions") : nav.find(([, id]) => id === tab)?.[2]}</h1>
          {certs && <Certificates game={p.game} c={p.c} era={era} />}
          {!certs && tab === "objects" && (era === "early"
            ? <>
              <Facts facts={[{ label: t("browser-consoles-2.vpnServer"), value: rows.length ? t("browser-consoles-2.on") : t("browser-consoles-2.off") }, { label: t("browser-consoles-2.currentUsers"), value: String(users), num: true }]} />
              <table className="cx-table">
                <thead><tr><th>{t("browser-consoles-2.gateway")}</th><th>{t("browser-consoles-2.account")}</th><th>{t("browser-consoles-2.users")}</th><th>{t("browser-consoles-2.status")}</th><th /></tr></thead>
                <tbody>
                  {rows.length === 0 && <tr><td colSpan={5} className="cx-empty">{t("browser-consoles-2.nothingHere")}</td></tr>}
                  {rows.map((r) => (
                    <RowLines key={r.id} r={r} span={5}>
                      <td><b>{r.name}</b></td><td>{userOf(r.id)?.customer}</td><td className="num">{userOf(r.id)?.users}</td>
                      <td><span className={`cx-state ${r.tone}`}>{r.state}</span></td><td><Actions actions={r.actions} className="cx-acts" /></td>
                    </RowLines>
                  ))}
                </tbody>
              </table>
            </>
            : <div className="ov-cards">
              <section className="ov-card ov-sum"><b className="num">{users}</b><span>{t("browser-consoles-2.currentUsers")}</span></section>
              {rows.map((r) => (
                <section key={r.id} className="ov-card">
                  <h2>{r.name}<span className={`cx-state ${r.tone}`}>{r.state}</span></h2>
                  <p>{t("browser-consoles-2.customerUsers", { customer: userOf(r.id)?.customer ?? "", users: userOf(r.id)?.users ?? 0 })}</p>
                  <Actions actions={r.actions} className="cx-acts" />{r.panel}
                </section>
              ))}
            </div>)}
          {!certs && tab === "objects" && <VpnReadout game={p.game} c={p.c} />}
          {!certs && pages.filter((g) => g.id === tab).map((g) => <div key={g.id}>{g.body}</div>)}
          {!certs && tab === "software" && <><Facts facts={sw.facts} /><Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>{sw.panel}</>}
        </main>
      </div>
    </div>
  );
}
