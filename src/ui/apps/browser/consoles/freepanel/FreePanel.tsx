import { ChevronRight, Folder, LogOut } from "lucide-react";
import { Actions, eraAt, looks, Facts, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { t } from "../../../../../i18n/en";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import { SystemInfo } from "./SystemInfo";
import "./freepanel.css";

// docs/design/software.md, section 10: one look per Webmin theme, ids as in UI_LOOKS.
const LOOKS = looks({ gray: 2005, authentic: 2014 });

export function FreePanel(p: PanelProps) {
  const era = eraAt(LOOKS, p), open = parseCreate("freepanel", p.path), [tab, setTab] = usePanelTab(p.f, open?.screen ?? "sysinfo");
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx fp fp-login" data-era={era}>
      <LoginForm className="fp-card" onLogin={p.login} button={t("browser-consoles-1.signIn")}>
        <div className="fp-logo">FreePanel</div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const fp = (id: string, key: string) => { const g = pages.find((x) => x.id === id); return g ? [[id as Tab, t(key)] as [Tab, string]] : []; };
  const tree: [string, [Tab, string][]][] = [
    [t("readouts.fp.dashboard"), [["sysinfo", t("readouts.fp.sysinfo")]]],
    [t("readouts.fp.virtualmin"), [["objects", t("readouts.fp.virtual")], ["create", t("pkg.fpCreate")], ["packages", t("pkg.fpPlans")]]],
    [t("browser-consoles-1.fpSystem"), [["software", t("browser-consoles-1.fpSoftwareUpdates")], ...fp("logs", "readouts.fp.logs"), ...fp("tasks", "readouts.fp.actions"), ...fp("licence", "readouts.fp.licence")]],
    ...(p.f.cluster ? [[t("browser-consoles-1.fpCluster"), [["nodes", t("browser-consoles-1.fpNodes")]]] as [string, [Tab, string][]]] : []),
  ];
  const title = tree.flatMap(([, items]) => items).find(([id]) => id === tab)?.[1];
  return (
    <div className="cx fp" data-era={era}>
      <aside className="fp-tree">
        <div className="fp-logo">FreePanel</div>
        <div className="fp-host">{p.host}</div>
        {tree.map(([cat, items]) => (
          <section key={cat}>
            <h3><Folder size={13} aria-hidden />{cat}</h3>
            {items.map(([id, label]) => <button key={id} aria-pressed={tab === id} onClick={() => setTab(id)}><ChevronRight size={12} aria-hidden />{label}</button>)}
          </section>
        ))}
        <button className="fp-out" onClick={p.logout}><LogOut size={13} aria-hidden />{t("browser-consoles-1.logout")}</button>
      </aside>
      <main className="fp-main">
        <h1>{title}</h1>
        {tab === "sysinfo" && <SystemInfo game={p.game} c={p.c} host={p.host} />}
        {tab === "objects" && <RowsTable rows={rows} name={t("browser-consoles-1.domain")} />}
        {tab === "create" && <ProvisionForm game={p.game} c={p.c} products={["webHosting"]} order={open?.screen === "create" ? open.order : undefined} />}
        {tab === "packages" && <PackagesScreen game={p.game} c={p.c} />}
        {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
        {pages.find((g) => g.id === tab)?.body}
        {tab === "software" && (
          <>
            <Facts facts={sw.facts} />
            <Actions actions={sw.actions}>{sw.note && <span className="cx-note">{sw.note}</span>}</Actions>
            {sw.panel}
          </>
        )}
      </main>
    </div>
  );
}
