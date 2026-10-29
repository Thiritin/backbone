import { ArrowLeft, ArrowRight, Download, Plus, RotateCw, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { adminUrl, companyUrl, defaultBookmarks, resolve, split, VIDEO_TITLE, VIDEO_URL, type Resolved } from "../../../sim/80-business/browser";
import { customerSite } from "../../../sim/80-business/website";
import { familyOf } from "../../../sim/60-infra/vulns";
import { consoleTitle } from "../../../sim/80-business/consoles";
import type { GameState } from "../../../sim/50-state";
import { MANUFACTURERS } from "../../../sim/10-catalog/hardware";
import { reduced } from "../../desktop/motion";
import { useSessionState } from "../../session";
import { useFocus, useStore } from "../../store";
import { Favicon } from "./Favicon";
import { ConsolePage } from "./consoles/ConsolePage";
import { bmcTitle, IpmiPage } from "./ipmi/IpmiPage";
import { AdminPage } from "./sites/AdminPage";
import { CompanySite } from "./sites/CompanySite";
import { CannotReach, CustomerSite, HostPage, NotFound, VendorSite, VideoPage } from "./sites/Pages";
import "./browser.css";

// Each navigation or reload bumps nav, which restarts the page load.
interface Tab { id: number; history: string[]; at: number; nav: number }
interface Mark { title: string; url: string }

const LOAD_MS = 2000;

function titleOf(game: GameState, r: Resolved): string {
  if (r.load === "down") return "Cannot reach";
  const p = r.page;
  switch (p.kind) {
    case "company": return game.company.name;
    case "admin": return "Admin";
    case "customer": return customerSite(game, p.serviceId)?.title ?? r.host;
    case "vendor": return MANUFACTURERS.find((m) => m.id === p.maker)?.name ?? r.host;
    case "host": return r.host;
    case "console": {
      const c = game.clusters.find((x) => x.id === p.clusterId), family = c && familyOf(c);
      return family ? `${consoleTitle(family)} ${c.name}` : r.host;
    }
    case "ipmi": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? `${bmcTitle(d.brand)} ${d.hostname ?? d.name}` : r.host;
    }
    case "video": return VIDEO_TITLE;
    default: return "Not found";
  }
}

// The page of one load; the key restarts it, so a slow host shows its progress bar again after every navigation.
function Viewport({ game, r, go }: { game: GameState; r: Resolved; go: (url: string) => void }) {
  const [waiting, setWaiting] = useState(r.load === "slow" && !reduced());
  useEffect(() => {
    if (!waiting) return;
    const id = setTimeout(() => setWaiting(false), LOAD_MS);
    return () => clearTimeout(id);
  }, [waiting]);
  const p = r.page, own = p.kind === "company" || p.kind === "admin";
  const admin = () => go(adminUrl(game));
  let body;
  if (waiting) body = null;
  else if (r.load === "down") body = <CannotReach host={r.host} onAdmin={own ? admin : undefined} />;
  else if (p.kind === "company") body = <CompanySite game={game} onAdmin={admin} />;
  else if (p.kind === "admin") body = <AdminPage onSite={() => go(companyUrl(game))} />;
  else if (p.kind === "customer") body = <CustomerSite game={game} serviceId={p.serviceId} />;
  else if (p.kind === "vendor") body = <VendorSite maker={p.maker} go={go} />;
  else if (p.kind === "video") body = <VideoPage />;
  else if (p.kind === "console") body = <ConsolePage game={game} hostname={p.hostname} host={r.host} cluster={game.clusters.find((x) => x.id === p.clusterId)} defaced={p.defaced} />;
  else if (p.kind === "ipmi") body = <IpmiPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "host") body = <HostPage host={r.host} />;
  else body = <NotFound host={r.host} />;
  const paper = !waiting && r.load !== "down" && ["company", "customer", "vendor"].includes(p.kind);
  return (
    <>
      {waiting && <div className="web-load" aria-hidden />}
      <div className={`web-view${paper ? " paper" : ""}`}>{body}</div>
    </>
  );
}

export function BrowserApp() {
  const game = useStore((s) => s.game);
  const home = companyUrl(game);
  const [tabs, setTabs] = useSessionState<Tab[]>("browser.tabs", [{ id: 1, history: [home], at: 0, nav: 0 }]);
  const [active, setActive] = useSessionState<number>("browser.active", tabs[0]?.id ?? 1);
  const [marks, setMarks] = useSessionState<Mark[]>("browser.marks", []);
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];
  const url = tab.history[tab.at];
  const r = resolve(game, url);
  const [addr, setAddr] = useState(url);
  useEffect(() => setAddr(url), [url, tab.id]);

  const patch = (id: number, f: (t: Tab) => Tab) => setTabs(tabs.map((x) => (x.id === id ? f(x) : x)));
  const go = (to: string) => {
    const { host, path } = split(to), next = `${host}${path}`;
    patch(tab.id, (x) => ({ ...x, history: [...x.history.slice(0, x.at + 1), next], at: x.at + 1, nav: x.nav + 1 }));
  };
  const step = (d: number) => patch(tab.id, (x) => ({ ...x, at: x.at + d, nav: x.nav + 1 }));
  const reload = () => patch(tab.id, (x) => ({ ...x, nav: x.nav + 1 }));
  const open = (to: string) => {
    const id = Math.max(...tabs.map((x) => x.id)) + 1;
    setTabs([...tabs, { id, history: [to], at: 0, nav: 0 }]);
    setActive(id);
  };
  const close = (id: number) => {
    if (tabs.length < 2) return;
    const rest = tabs.filter((x) => x.id !== id);
    setTabs(rest);
    if (id === active) setActive(rest[Math.max(0, tabs.findIndex((x) => x.id === id) - 1)].id);
  };

  // Another app asked for an address: show the tab that already has it, else a new one.
  useFocus("Browser", (f) => {
    if (f.kind !== "url") return;
    const have = tabs.find((x) => x.history[x.at] === f.id);
    if (have) setActive(have.id);
    else open(f.id);
  });

  const bookmarks = [...defaultBookmarks(game), ...marks];
  const marked = bookmarks.some((m) => m.url === url);
  const isDefault = defaultBookmarks(game).some((m) => m.url === url);
  const toggleMark = () => setMarks(marked ? marks.filter((m) => m.url !== url) : [...marks, { title: titleOf(game, r), url }]);

  return (
    <div className="br">
      <div className="br-tabs" role="tablist">
        {tabs.map((x) => {
          const rx = resolve(game, x.history[x.at]);
          return (
            <div key={x.id} role="tab" aria-selected={x.id === tab.id} className="br-tab" tabIndex={0} onClick={() => setActive(x.id)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(x.id)}>
              <Favicon game={game} r={rx} />
              <span className="br-tab-title">{titleOf(game, rx)}</span>
              {tabs.length > 1 && <button className="br-tab-x" aria-label="Close tab" onClick={(e) => { e.stopPropagation(); close(x.id); }}><X aria-hidden /></button>}
            </div>
          );
        })}
        <button className="br-new" aria-label="New tab" onClick={() => open(home)}><Plus aria-hidden /></button>
      </div>
      <div className="br-bar">
        <button className="btn icon ghost" aria-label="Back" disabled={tab.at === 0} onClick={() => step(-1)}><ArrowLeft aria-hidden /></button>
        <button className="btn icon ghost" aria-label="Forward" disabled={tab.at >= tab.history.length - 1} onClick={() => step(1)}><ArrowRight aria-hidden /></button>
        <button className="btn icon ghost" aria-label="Reload" onClick={reload}><RotateCw aria-hidden /></button>
        <form className="br-addr" onSubmit={(e) => { e.preventDefault(); if (addr.trim()) go(addr); }}>
          <Favicon game={game} r={r} />
          <input aria-label="Address" value={addr} spellCheck={false} autoCapitalize="off" onChange={(e) => setAddr(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="br-star" aria-label="Bookmark" aria-pressed={marked} disabled={isDefault} onClick={toggleMark}><Star aria-hidden /></button>
        </form>
        <button className="btn" onClick={() => go(VIDEO_URL)}><Download aria-hidden /> Downloads</button>
      </div>
      <div className="br-marks">
        {bookmarks.map((m) => (
          <button key={m.url} className="br-mark" onClick={() => go(m.url)}>
            <Favicon game={game} r={resolve(game, m.url)} />
            <span>{m.title}</span>
          </button>
        ))}
      </div>
      <Viewport key={`${tab.id}:${tab.nav}`} game={game} r={r} go={go} />
    </div>
  );
}
