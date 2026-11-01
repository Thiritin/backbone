import { t } from "../../../../../i18n/en";
import { Boxes, Folder, FolderOpen, Gamepad2, LogOut, Network, PlusCircle, Server, Settings, ScrollText, type LucideIcon } from "lucide-react";
import { useState } from "react";
import { Actions, Backups, eraAt, looks, Facts, LoginForm, Nodes, RowsTable, usePanelTab, useRows, useSoftware, type PanelProps, type Tab } from "../PanelBase";
import { parseCreate } from "../../../../../sim/80-business/consoles";
import { PackagesScreen, ProvisionForm } from "../PackageForms";
import { useReadoutPages } from "../Readouts";
import "./tcadmen.css";

// docs/design/software.md, section 10: one look per TCAdmen generation, ids as in UI_LOOKS.
const LOOKS = looks({ early: 2005, late: 2016, v3: 2022 });
const ICON: Partial<Record<Tab, LucideIcon>> = { objects: Server, nodes: Network, create: PlusCircle, packages: Boxes, software: Settings };

export function TCAdmen(p: PanelProps) {
  const era = eraAt(LOOKS, p), form = parseCreate("tcadmen", p.path), [tab, setTab] = usePanelTab(p.f, form?.screen ?? "objects"), [pick, setPick] = useState<string | null>(null);
  const rows = useRows(p.game, p.c, p.f), sw = useSoftware(p.game, p.c, p.f), pages = useReadoutPages(p.game, p.c, p.f);
  if (!p.signedIn) return (
    <div className="cx tc tc-login" data-era={era}>
      <LoginForm className="tc-card" onLogin={p.login} button={t("browser-consoles-2.login")}>
        <div className="tc-logo">TCAdmen<small>{t("browser-consoles-2.controlPanel")}</small></div>
        <div className="cx-host">{p.host}</div>
      </LoginForm>
    </div>
  );
  const menu: [Tab, string][] = [["objects", t("browser-consoles-2.gameServers")], ...(p.f.cluster ? [["nodes", t("browser-consoles-2.nodes")] as [Tab, string]] : []), ["create", t("pkg.tcAdd")], ["packages", t("pkg.tcGames")], ["software", t("browser-consoles-2.systemSettings")], ...pages.map((g) => [g.id, g.label] as [Tab, string])];
  const shown = rows.filter((r) => !pick || r.id === pick);
  const open = (id: string | null) => { setPick(id); setTab("objects"); };
  return (
    <div className="cx tc" data-era={era}>
      <header className="tc-top">
        <span className="tc-logo">TCAdmen<small>{t("browser-consoles-2.controlPanel")}</small></span>
        <span className="cx-host">{p.host}</span>
      </header>
      <nav className="tc-menu">
        {menu.map(([id, label]) => { const I = ICON[id] ?? ScrollText; return <button key={id} aria-pressed={tab === id} onClick={() => (id === "objects" ? open(null) : setTab(id))}>{era === "v3" && <I size={16} aria-hidden />}{label}</button>; })}
        <button onClick={p.logout}>{era === "v3" && <LogOut size={16} aria-hidden />}{t("browser-consoles-2.logout")}</button>
      </nav>
      <div className="tc-body">
        <aside className="tc-tree">
          <button aria-pressed={tab === "objects" && !pick} onClick={() => open(null)}>{tab === "objects" ? <FolderOpen size={14} aria-hidden /> : <Folder size={14} aria-hidden />}{t("browser-consoles-2.gameServers")}</button>
          <ul>{rows.map((r) => <li key={r.id}><button aria-pressed={pick === r.id} onClick={() => open(r.id)}><Gamepad2 size={13} aria-hidden />{r.name}</button></li>)}</ul>
        </aside>
        <main className="tc-main">
          {tab === "objects" && <RowsTable rows={shown} name={t("browser-consoles-2.gameServer")} />}
          {tab === "create" && <ProvisionForm game={p.game} c={p.c} products={["gameServer"]} order={form?.screen === "create" ? form.order : undefined} />}
          {tab === "packages" && <PackagesScreen game={p.game} c={p.c} />}
          {tab === "nodes" && <Nodes game={p.game} c={p.c} />}
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
    </div>
  );
}
