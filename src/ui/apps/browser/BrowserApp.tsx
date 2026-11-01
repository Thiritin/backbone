import { ArrowLeft, ArrowRight, CircleArrowDown, House, Plus, RotateCw, Star, X } from "lucide-react";
import { useEffect, useState } from "react";
import { BOARD_TITLE, defaultBookmarks, HOME_URL, resolve, split, VIDEO_TITLE, WIKI_TITLE, type Resolved } from "../../../sim/80-business/browser";
import { customerSite } from "../../../sim/80-business/website";
import { familyOf } from "../../../sim/60-infra/vulns";
import { consoleTitle } from "../../../sim/80-business/consoles";
import type { GameState } from "../../../sim/50-state";
import { MANUFACTURERS } from "../../../sim/10-catalog/hardware";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { serverOsById } from "../../../sim/10-catalog/server-os";
import { registrarById } from "../../../sim/10-catalog/registrars";
import { reduced } from "../../desktop/motion";
import { menuOn } from "../../desktop/ContextMenu";
import { nowHours } from "../../../sim/00-core/time";
import { isoFile } from "./sites/software/SoftwareSite";
import { useDownloads } from "../../downloads";
import type { OsImage } from "../../../sim/10-catalog/server-os";
import { useSessionState } from "../../session";
import { t } from "../../../i18n/en";
import { useFocus, useStore } from "../../store";
import { Favicon } from "./Favicon";
import { ConsolePage } from "./consoles/ConsolePage";
import { bmcTitle, IpmiPage } from "./ipmi/IpmiPage";
import { FritzOz } from "./mgmt/FritzOz";
import { KvmPage, kvmTitle } from "./ipmi/KvmPage";
import { SwitchPage, switchTitle } from "./mgmt/Switch";
import { CompanySite } from "./sites/CompanySite";
import { SponsorBoard } from "./sites/SponsorBoard";
import { IndexSite } from "./sites/index/IndexSite";
import { OfficeSite } from "./sites/office/OfficeSite";
import { LexwearSite } from "./sites/lexwear/LexwearSite";
import { ShopVendorSite } from "./sites/shopvendors/registry";
import { shopById } from "../../../sim/10-catalog/shops";
import { WikiSite } from "./sites/wiki/WikiSite";
import { LEXWEAR } from "../../../sim/80-business/lexwear";
import { SoftwarePage } from "./sites/software/registry";
import { RegistrarSite } from "./sites/registrars";
import { SupplierSite } from "./sites/bank/SupplierSite";
import { BankSite } from "./sites/bank/BankSite";
import { bankById } from "../../../sim/10-catalog/banks";
import { CannotReach, CustomerSite, HostPage, NotFound, PhishingPage, VideoPage } from "./sites/Pages";
import { senderById } from "../../../sim/40-support/notices";
import { VendorSite } from "./sites/vendors/registry";
import "./browser.css";

// Each navigation or reload bumps nav, which restarts the page load.
interface Tab { id: number; history: string[]; at: number; nav: number }
interface Mark { title: string; url: string }

const LOAD_MS = 2000;

function titleOf(game: GameState, r: Resolved): string {
  if (r.load === "down") return t("misc1.browser.cannotReach");
  const p = r.page;
  switch (p.kind) {
    case "company": return game.company.name;
    case "customer": return customerSite(game, p.serviceId)?.title ?? r.host;
    case "vendor": return MANUFACTURERS.find((m) => m.id === p.maker)?.name ?? r.host;
    case "registrar": return registrarById(p.id)?.name ?? r.host;
    case "bank": return t("misc1.browser.onlineBanking", { name: bankById(p.id)!.name });
    case "supplier": return p.name;
    case "host": return r.host;
    case "console": {
      const c = game.clusters.find((x) => x.id === p.clusterId), family = c && familyOf(c);
      return family ? `${consoleTitle(family)} ${c.name}` : r.host;
    }
    case "ipmi": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? `${bmcTitle(d.brand)} ${d.hostname ?? d.name}` : r.host;
    }
    case "kvm": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? kvmTitle(d) : r.host;
    }
    case "router": return "Fritz!OZ";
    case "switch": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? switchTitle(d) : r.host;
    }
    case "video": return VIDEO_TITLE;
    case "phishing": return t("misc1.browser.onlineBanking", { name: senderById(p.sender).name });
    case "sponsorboard": return BOARD_TITLE;
    case "index": return t("browser-sites-1.ix.title");
    case "office": return t("browser-sites-1.of.title");
    case "lexwear": return LEXWEAR;
    case "shopVendor": return shopById(p.id).name;
    case "wiki": return WIKI_TITLE;
    case "software": return softwareById(p.id).name;
    case "os": return serverOsById(p.id).name;
    default: return t("misc1.browser.notFound");
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
  const p = r.page;
  let body;
  if (waiting) body = null;
  else if (r.load === "down") body = <CannotReach host={r.host} />;
  else if (p.kind === "company") body = <CompanySite game={game} path={r.path} go={go} />;
  else if (p.kind === "customer") body = <CustomerSite game={game} serviceId={p.serviceId} />;
  else if (p.kind === "vendor") body = <VendorSite game={game} maker={p.maker} path={r.path} go={go} />;
  else if (p.kind === "registrar") body = <RegistrarSite game={game} id={p.id} path={r.path} />;
  else if (p.kind === "supplier") body = <SupplierSite game={game} name={p.name} />;
  else if (p.kind === "bank") body = <BankSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "video") body = <VideoPage />;
  else if (p.kind === "phishing") body = <PhishingPage sender={p.sender} />;
  else if (p.kind === "sponsorboard") body = <SponsorBoard game={game} />;
  else if (p.kind === "office") body = <OfficeSite game={game} path={r.path} go={go} />;
  else if (p.kind === "lexwear") body = <LexwearSite game={game} path={r.path} go={go} />;
  else if (p.kind === "shopVendor") body = <ShopVendorSite game={game} id={p.id} />;
  else if (p.kind === "wiki") body = <WikiSite game={game} path={r.path} go={go} />;
  else if (p.kind === "index") body = <IndexSite game={game} path={r.path} go={go} />;
  else if (p.kind === "software" || p.kind === "os") body = <SoftwarePage game={game} kind={p.kind} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "console") body = <ConsolePage game={game} hostname={p.hostname} host={r.host} cluster={game.clusters.find((x) => x.id === p.clusterId)} defaced={p.defaced} path={p.path} />;
  else if (p.kind === "ipmi") body = <IpmiPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "kvm") body = <KvmPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "router") body = <FritzOz game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "switch") body = <SwitchPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "host") body = <HostPage host={r.host} />;
  else body = <NotFound host={r.host} />;
  const paper = !waiting && r.load !== "down" && ["company", "customer", "vendor", "sponsorboard", "registrar", "bank", "supplier", "index", "office", "software", "os"].includes(p.kind);
  return (
    <>
      {waiting && <div className="web-load" aria-hidden />}
      <div className={`web-view${paper ? " white" : ""}`}>{body}</div>
    </>
  );
}

const showDownloads = () => useStore.getState().openApp("Applications", { kind: "folder", id: "downloads" });

function DownloadsButton({ game }: { game: GameState }) {
  const running = useDownloads();
  const ids = (Object.keys(running) as OsImage[]).filter((id) => running[id]), first = ids[0] && running[ids[0]]!;
  const done = (d: { start: number; hours: number }) => Math.floor(Math.min(1, (nowHours(game) - d.start) / d.hours) * 100);
  return (
    <button className="btn icon ghost br-dl" aria-label={t("misc1.browser.downloads")} onClick={menuOn(() => [
      ...ids.map((id) => ({ label: `${isoFile(id)}, ${done(running[id]!)}%`, disabled: true })),
      ...game.media.images.map((id) => ({ label: isoFile(id), run: showDownloads })),
      !game.media.images.length && !ids.length && { label: t("misc1.browser.noDownloads"), disabled: true },
      null,
      { label: t("misc1.browser.showInFinder"), run: showDownloads },
    ])}>
      <CircleArrowDown aria-hidden />
      {first && <span className="br-dl-bar"><i key={ids[0]} style={{ width: `${done(first)}%` }} /></span>}
    </button>
  );
}

export function BrowserApp() {
  const game = useStore((s) => s.game);
  const [tabs, setTabs] = useSessionState<Tab[]>("browser.tabs", [{ id: 1, history: [HOME_URL], at: 0, nav: 0 }]);
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
  const keep = (rest: Tab[]) => {
    if (!rest.length || rest.length === tabs.length) return;
    setTabs(rest);
    if (!rest.some((x) => x.id === active)) {
      const at = tabs.findIndex((x) => x.id === active);
      setActive((tabs.slice(0, at).reverse().find((x) => rest.includes(x)) ?? rest[0]).id);
    }
  };
  const close = (id: number) => keep(tabs.filter((x) => x.id !== id));
  const tabMenu = (i: number) => [
    { label: t("misc1.browser.closeTab"), run: () => close(tabs[i].id), disabled: tabs.length < 2 },
    { label: t("misc1.browser.closeOthers"), run: () => keep([tabs[i]]), disabled: tabs.length < 2 },
    { label: t("misc1.browser.closeLeft"), run: () => keep(tabs.slice(i)), disabled: i === 0 },
    { label: t("misc1.browser.closeRight"), run: () => keep(tabs.slice(0, i + 1)), disabled: i === tabs.length - 1 },
  ];

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
        {tabs.map((x, i) => {
          const rx = resolve(game, x.history[x.at]);
          return (
            <div key={x.id} role="tab" aria-selected={x.id === tab.id} className="br-tab" tabIndex={0} onClick={() => setActive(x.id)} onContextMenu={menuOn(() => tabMenu(i))}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(x.id)}>
              <Favicon game={game} r={rx} />
              <span className="br-tab-title">{titleOf(game, rx)}</span>
              {tabs.length > 1 && <button className="br-tab-x" aria-label={t("misc1.browser.closeTab")} onClick={(e) => { e.stopPropagation(); close(x.id); }}><X aria-hidden /></button>}
            </div>
          );
        })}
        <button className="br-new" aria-label={t("misc1.browser.newTab")} onClick={() => open(HOME_URL)}><Plus aria-hidden /></button>
      </div>
      <div className="br-bar">
        <button className="btn icon ghost" aria-label={t("misc1.browser.back")} disabled={tab.at === 0} onClick={() => step(-1)}><ArrowLeft aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.forward")} disabled={tab.at >= tab.history.length - 1} onClick={() => step(1)}><ArrowRight aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.reload")} onClick={reload}><RotateCw aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.home")} onClick={() => go(HOME_URL)}><House aria-hidden /></button>
        <form className="br-addr" onSubmit={(e) => { e.preventDefault(); if (addr.trim()) go(addr); }}>
          <Favicon game={game} r={r} />
          <input aria-label={t("misc1.browser.address")} value={addr} spellCheck={false} autoCapitalize="off" onChange={(e) => setAddr(e.target.value)} onFocus={(e) => e.currentTarget.select()} />
          <button type="button" className="br-star" aria-label={t("misc1.browser.bookmark")} aria-pressed={marked} disabled={isDefault} onClick={toggleMark}><Star aria-hidden /></button>
        </form>
        <DownloadsButton game={game} />
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
