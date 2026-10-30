import { Gamepad2, Globe, HardDrive, LogOut, ShieldCheck } from "lucide-react";
import { useState, type ComponentType, type ReactNode } from "react";
import { yearOf } from "../../../../sim/00-core/time";
import { softwareById } from "../../../../sim/10-catalog/platforms";
import type { GameState } from "../../../../sim/50-state";
import { workloadsOn, type Cluster } from "../../../../sim/60-infra/cluster";
import { familyOf } from "../../../../sim/60-infra/vulns";
import { consoleFeatures, consoleTitle, type ConsoleLook } from "../../../../sim/80-business/consoles";
import { useSessionState } from "../../../session";
import { Mark } from "../../products/parts";
import { Nodes, Objects, objectsLabel, Software, type Tab } from "./ConsoleBody";
import { CPanic } from "./cpanic/CPanic";
import { DirectAdmen } from "./directadmen/DirectAdmen";
import { FreePanel } from "./freepanel/FreePanel";
import { MultiKraft } from "./multikraft/MultiKraft";
import type { PanelProps } from "./PanelBase";
import { Pleskit } from "./pleskit/Pleskit";
import { Pterodaktyl } from "./pterodaktyl/Pterodaktyl";
import { TCAdmen } from "./tcadmen/TCAdmen";
import "./consoles.css";

// The products that draw their own console by era; any other software still wears one of the shared frames below.
export const CONSOLES: Record<string, ComponentType<PanelProps>> = {
  cpanic: CPanic, pleskit: Pleskit, directadmen: DirectAdmen, freepanel: FreePanel, tcadmen: TCAdmen, multikraft: MultiKraft, pterodaktyl: Pterodaktyl,
};

// The four page structures the eleven products share; the look supplies colours, type and shapes.
type Frame = "top" | "side" | "tree" | "list";
const FRAME: Record<ConsoleLook, Frame> = {
  cpanic: "top", directadmen: "top", freepanel: "top", openveezee: "top", mail: "top",
  pleskit: "side", horizont: "side", game: "side", vsphear: "tree", proxmocks: "tree", hypervee: "list",
};
const LOGIN: Record<ConsoleLook, string> = {
  cpanic: "Log in", pleskit: "Log in", directadmen: "Login", freepanel: "Submit", horizont: "Connect", vsphear: "Log in",
  proxmocks: "Login", hypervee: "Connect", openveezee: "Log in", mail: "Sign in", game: "Sign in",
};

// The mark of a service console: a gamepad for game panels, otherwise the kind's own.
function ServiceIcon({ kind, size }: { kind: string; size: number }) {
  return kind === "dns" ? <Globe size={size} /> : kind === "vpn" ? <ShieldCheck size={size} /> : kind === "storage" ? <HardDrive size={size} /> : <Gamepad2 size={size} />;
}

function Brand({ look, family, size = 26 }: { look: ConsoleLook; family: string; size?: number }) {
  return (
    <span className="cx-brand">
      {look === "game" ? <span className="prd-mark" style={{ width: size, height: size, background: "oklch(0.62 0.17 150)" }}><ServiceIcon kind={softwareById(family).kind} size={Math.round(size * 0.62)} /></span> : <Mark id={family} size={size} />}
      <b>{consoleTitle(family)}</b>
    </span>
  );
}

function Login({ look, family, host, onLogin }: { look: ConsoleLook; family: string; host: string; onLogin: () => void }) {
  return (
    <div className="cx cx-login" data-look={look}>
      <form className="cx-card" onSubmit={(e) => { e.preventDefault(); onLogin(); }}>
        <Brand look={look} family={family} size={34} />
        <div className="cx-host">{host}</div>
        <label className="cx-field">Username<input defaultValue="admin" autoComplete="off" /></label>
        <label className="cx-field">Password<input type="password" defaultValue="correcthorse" autoComplete="off" /></label>
        <button className="cx-btn primary" type="submit">{LOGIN[look]}</button>
      </form>
    </div>
  );
}

function Defaced() {
  return (
    <div className="cx-defaced">
      <h1>Hacked by xX_Pwn3r_Xx</h1>
      <p>Greetings to everyone with a weak password.</p>
    </div>
  );
}

interface ShellProps {
  look: ConsoleLook; family: string; host: string; tabs: [Tab, string][]; tab: Tab; setTab: (t: Tab) => void; logout: () => void;
  tree: ReactNode; children: ReactNode;
}

const Tabs = ({ tabs, tab, setTab }: Pick<ShellProps, "tabs" | "tab" | "setTab">) => (
  <>{tabs.map(([id, label]) => <button key={id} className="cx-tab" aria-pressed={tab === id} onClick={() => setTab(id)}>{label}</button>)}</>
);
const Logout = ({ logout }: { logout: () => void }) => <button className="cx-btn ghost" onClick={logout}><LogOut aria-hidden />Log out</button>;

function TopFrame(p: ShellProps) {
  return (
    <div className="cx" data-look={p.look} data-frame="top">
      <header className="cx-head"><Brand look={p.look} family={p.family} /><span className="cx-host">{p.host}</span><Logout logout={p.logout} /></header>
      <nav className="cx-tabs"><Tabs {...p} /></nav>
      <main className="cx-main">{p.children}</main>
    </div>
  );
}

function SideFrame(p: ShellProps) {
  return (
    <div className="cx" data-look={p.look} data-frame="side">
      <aside className="cx-side">
        <Brand look={p.look} family={p.family} />
        <nav><Tabs {...p} /></nav>
        <Logout logout={p.logout} />
      </aside>
      <main className="cx-main"><div className="cx-host">{p.host}</div>{p.children}</main>
    </div>
  );
}

function TreeFrame(p: ShellProps) {
  return (
    <div className="cx" data-look={p.look} data-frame="tree">
      <header className="cx-head"><Brand look={p.look} family={p.family} size={22} /><span className="cx-host">{p.host}</span><Logout logout={p.logout} /></header>
      <div className="cx-split">
        <aside className="cx-tree">{p.tree}</aside>
        <div className="cx-pane">
          <nav className="cx-tabs"><Tabs {...p} /></nav>
          <main className="cx-main">{p.children}</main>
        </div>
      </div>
    </div>
  );
}

function ListFrame(p: ShellProps) {
  return (
    <div className="cx" data-look={p.look} data-frame="list">
      <header className="cx-head"><Brand look={p.look} family={p.family} size={18} /><span className="cx-host">{p.host}</span><Logout logout={p.logout} /></header>
      <nav className="cx-tabs"><Tabs {...p} /></nav>
      <main className="cx-main">{p.children}</main>
    </div>
  );
}

const FRAMES = { top: TopFrame, side: SideFrame, tree: TreeFrame, list: ListFrame };

export function ConsolePage({ game, hostname, host, cluster, defaced }: { game: GameState; hostname: string; host: string; cluster: Cluster | undefined; defaced: boolean }) {
  const [logins, setLogins] = useSessionState<string[]>("browser.logins", []);
  const [tab, setTab] = useState<Tab>("objects"), [node, setNode] = useState<string | null>(null);
  const family = cluster && familyOf(cluster);
  if (!cluster || !family) return null;
  if (defaced) return <Defaced />;
  const f = consoleFeatures(family, yearOf(game.hour)), look = f.look;
  const Panel = CONSOLES[family], logout = () => setLogins(logins.filter((x) => x !== hostname));
  if (Panel) return <Panel game={game} c={cluster} f={f} host={host} signedIn={logins.includes(hostname)} login={() => setLogins([...logins, hostname])} logout={logout} />;
  if (!logins.includes(hostname)) return <Login look={look} family={family} host={host} onLogin={() => setLogins([...logins, hostname])} />;

  const tabs: [Tab, string][] = [["objects", objectsLabel(f, cluster)], ...(f.cluster ? [["nodes", "Nodes"] as [Tab, string]] : []), ["software", "Software"]];
  const shown = tabs.some(([id]) => id === tab) ? tab : "objects";
  const nodes = cluster.nodes.map((n) => game.devices.find((d) => d.id === n.deviceId)!).filter(Boolean);
  const tree = (
    <ul>
      <li><button aria-pressed={node === null} onClick={() => { setNode(null); setTab("objects"); }}>{cluster.name}</button>
        <ul>
          {nodes.map((d) => (
            <li key={d.id}>
              <button aria-pressed={node === d.id} onClick={() => { setNode(d.id); setTab("objects"); }}>{d.hostname ?? d.name}</button>
              <ul>{workloadsOn(game, d.id).filter((w) => w.clusterId === cluster.id).map((w) => <li key={w.id}><span>{w.hostname ?? w.id}</span></li>)}</ul>
            </li>
          ))}
        </ul>
      </li>
    </ul>
  );
  const Shell = FRAMES[FRAME[look]];
  return (
    <Shell look={look} family={family} host={host} tabs={tabs} tab={shown} setTab={setTab} tree={tree} logout={logout}>
      {shown === "objects" && <Objects game={game} c={cluster} f={f} node={node} />}
      {shown === "nodes" && <Nodes game={game} c={cluster} />}
      {shown === "software" && <Software game={game} c={cluster} f={f} />}
    </Shell>
  );
}
