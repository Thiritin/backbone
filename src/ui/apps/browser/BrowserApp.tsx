import { DeskSite } from "./sites/desk/DeskSite";
import { DeskSetup } from "./sites/desk/setup/DeskSetup";
import { ShopSetup } from "./sites/portal/setup/ShopSetup";
import { ArrowLeft, ArrowRight, ChevronDown, CircleArrowDown, Folder, House, Plus, RotateCw, Star, X } from "lucide-react";
import { useEffect, useRef, useState, type DragEvent } from "react";
import { AGENCY_TITLE, BOARD_TITLE, defaultBookmarks, resolve, split, VIDEO_TITLE, WIKI_TITLE, type Resolved } from "../../../sim/80-business/browser";
import { customerSite } from "../../../sim/80-business/website";
import { familyOf } from "../../../sim/60-infra/vulns";
import { consoleTitle } from "../../../sim/80-business/consoles";
import type { GameState } from "../../../sim/50-state";
import { MANUFACTURERS } from "../../../sim/10-catalog/hardware";
import { softwareById } from "../../../sim/10-catalog/platforms";
import { serverOsById } from "../../../sim/10-catalog/server-os";
import { registrarById } from "../../../sim/10-catalog/registrars";
import { reduced } from "../../desktop/motion";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { companyFolder, type IndexRow } from "../../../sim/80-business/index";
import { nowHours } from "../../../sim/00-core/time";
import { isoFile } from "./sites/software/SoftwareSite";
import { softwareDownloads, useDownloads } from "../../downloads";
import { imageExists, type OsImage } from "../../../sim/10-catalog/server-os";
import { readSession, useSessionState, writeSession } from "../../session";
import { homeUrl } from "./home";
import { t } from "../../../i18n/en";
import { useFocus, useStore, useWin } from "../../store";
import { useBack } from "../../desktop/back";
import { VaultOffer } from "../../vault";
import { Favicon } from "./Favicon";
import { ConsolePage } from "./consoles/ConsolePage";
import { PageError } from "./pageAct";
import { PageBoundary } from "./PageBoundary";
import { bmcTitle, IpmiPage } from "./ipmi/IpmiPage";
import { FritzOz } from "./mgmt/FritzOz";
import { KvmPage, kvmTitle } from "./ipmi/KvmPage";
import { SwitchPage, switchTitle } from "./mgmt/Switch";
import { RouterPage, routerTitle } from "./mgmt/Router";
import { UpsPage, upsTitle } from "./mgmt/Ups";
import { isOwnRouter } from "../../../sim/60-infra/routers";
import { CompanySite } from "./sites/CompanySite";
import { SponsorBoard } from "./sites/SponsorBoard";
import { FlyerlarmSite } from "./sites/marketing/FlyerlarmSite";
import { FLYER_NAME } from "../../../sim/10-catalog/flyers";
import { AgencySite } from "./sites/marketing/AgencySite";
import { IndexSite } from "./sites/index/IndexSite";
import { ProgramSite } from "./sites/programs/ProgramSite";
import { OfficeSite } from "./sites/office/OfficeSite";
import { DohleSite } from "./sites/dohle/DohleSite";
import { LexwearSite } from "./sites/lexwear/LexwearSite";
import { MarketSite } from "./sites/market/MarketSite";
import { channelName } from "../../../sim/10-catalog/used";
import { BOOKS_SITES } from "./sites/books/sites";
import { BooksProgram } from "../books/BooksApp";
import { currentVendor } from "../../../sim/80-business/bookkeeping";
import { booksVendor } from "../../../sim/10-catalog/bookkeeping";
import { ShopVendorSite } from "./sites/shopvendors/registry";
import { shopById } from "../../../sim/10-catalog/shops";
import { deskById } from "../../../sim/10-catalog/desks";
import { HostedDeskSite } from "./sites/desks/HostedDeskSite";
import { SelfDeskSite } from "./sites/desks/SelfDeskSite";
import { gmixTitle } from "./sites/mail/gmix/GmixMail";
import { GmixSite } from "./sites/mail/gmix/GmixSite";
import { GOGGLE_SESSION, GoggleSite, goggleTitle } from "./sites/mail/goggle/GoggleSite";
import { Gmial, gmialTitle } from "./sites/mail/gmial/Gmial";
import { IonoseSite, ionoseTitle } from "./sites/mail/ionose/IonoseSite";
import { Owa, owaTitle } from "./sites/mail/owa/Owa";
import { IONOSE_OWA, LOOKOUT_OWA } from "../../../sim/10-catalog/mail-hosted";
import { LookoutSite, lookoutTitle } from "./sites/mail/lookout/LookoutSite";
import { HostToastSite } from "./sites/hosttoast/HostToastSite";
import { HOSTTOAST } from "../../../sim/10-catalog/hosttoast";
import { WikiSite } from "./sites/wiki/WikiSite";
import { PanelWebmail } from "./consoles/squarecube/PanelWebmail";
import { SoftwarePage } from "./sites/software/registry";
import { RegistrarSite } from "./sites/registrars";
import { ParkedPage } from "./sites/registrars/Parked";
import { SupplierSite } from "./sites/bank/SupplierSite";
import { UtilitySite } from "./sites/bank/UtilitySite";
import { UTILITY } from "../../../sim/46-finance/payables";
import { BankSite } from "./sites/bank/BankSite";
import { bankById } from "../../../sim/10-catalog/banks";
import { siteTitle, WebspaceSite } from "./sites/webspace/WebspaceSite";
import { CannotReach, CustomerSite, HostPage, NoticePage, noticeTitle, NotFound, VideoPage } from "./sites/Pages";
import { PortalSite } from "./sites/portal/PortalSite";
import { VendorSite } from "./sites/vendors/registry";
import { ProviderSite } from "./sites/providers/registry";
import { dcProvider } from "../../../sim/20-world/datacenters";
import "./browser.css";

// Each navigation or reload bumps nav, which restarts the page load.
interface Tab { id: number; history: string[]; at: number; nav: number }
// The tab being dragged, so another browser window can take it.
let carried: { win: string; tab: Tab; taken: boolean } | null = null;
interface Mark { title: string; url: string }

const LOAD_MS = 2000;

function titleOf(game: GameState, r: Resolved): string {
  if (r.load === "down") return t("misc1.browser.cannotReach");
  const p = r.page;
  switch (p.kind) {
    case "company": return game.company.name;
    case "customer": return customerSite(game, p.serviceId)?.title ?? r.host;
    case "webspace": return siteTitle(p.body) || r.host;
    case "panelMail": return "Squarecube Webmail";
    case "vendor": return MANUFACTURERS.find((m) => m.id === p.maker)?.name ?? r.host;
    case "provider": return dcProvider(p.id).name;
    case "registrar": return registrarById(p.id)?.name ?? r.host;
    case "parked": return p.domain;
    case "bank": return t("misc1.browser.onlineBanking", { name: bankById(p.id)!.name });
    case "supplier": return p.name;
    case "utility": return UTILITY;
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
    case "router": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d && isOwnRouter(d) ? routerTitle(d) : "Fritz!OZ";
    }
    case "switch": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? switchTitle(d) : r.host;
    }
    case "ups": {
      const d = game.devices.find((x) => x.id === p.deviceId);
      return d ? upsTitle(d) : r.host;
    }
    case "video": return VIDEO_TITLE;
    case "notice": return noticeTitle(game, p.ticketId);
    case "sponsorboard": return BOARD_TITLE;
    case "flyers": return FLYER_NAME;
    case "agency": return AGENCY_TITLE;
    case "index": return t("browser-sites-1.ix.title");
    case "office": return t("browser-sites-1.of.title");
    case "lexwear": return booksVendor("lexwear")!.name;
    case "market": return channelName(p.channel);
    case "books": return booksVendor(p.id)!.program;
    case "shopVendor": return shopById(p.id).name;
    case "deskVendor": case "desk": return deskById(p.id)!.name;
    case "mailProvider": return p.id === "ionose" ? ionoseTitle(r.path) : p.id === "ionose-owa" ? owaTitle(game, "ionose") : p.id === "lookout-owa" ? owaTitle(game, "lookout") : p.id === "lookout" || p.id === "lookout-admin" ? lookoutTitle(r.host) : p.id === "goggle" ? goggleTitle(game, r.host, r.path) : p.id === "gmial" ? gmialTitle(game, readSession<string | null>(GOGGLE_SESSION, null))
      : gmixTitle(game, readSession<string | null>("gmix.account", null));
    case "hosttoast": return HOSTTOAST;
    case "wiki": return WIKI_TITLE;
    case "shop": return game.company.name;
    case "shopSetup": return t("shop-setup.title", { name: shopById(p.id).name });
    case "deskSetup": return t(`desk-setup.${p.id}.installer`);
    case "software": return softwareById(p.id).name;
    case "program": return p.id;
    case "os": return serverOsById(p.id).name;
    default: return t("misc1.browser.notFound");
  }
}

// The page of one load; the key restarts it, so a slow host shows its progress bar again after every navigation.
function Viewport({ game, r, go }: { game: GameState; r: Resolved; go: (url: string) => void }) {
  const [waiting, setWaiting] = useState(r.load === "slow" && !reduced());
  const [error, setError] = useState<string | null>(null);
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
  else if (p.kind === "webspace") body = <WebspaceSite game={game} body={p.body} />;
  else if (p.kind === "vendor") body = <VendorSite game={game} maker={p.maker} path={r.path} go={go} />;
  else if (p.kind === "provider") body = <ProviderSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "registrar") body = <RegistrarSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "parked") body = <ParkedPage game={game} registrar={p.registrar} domain={p.domain} />;
  else if (p.kind === "supplier") body = <SupplierSite game={game} name={p.name} go={go} />;
  else if (p.kind === "utility") body = <UtilitySite game={game} path={r.path} go={go} />;
  else if (p.kind === "bank") body = <BankSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "video") body = <VideoPage />;
  else if (p.kind === "notice") body = <NoticePage game={game} ticketId={p.ticketId} />;
  else if (p.kind === "sponsorboard") body = <SponsorBoard game={game} />;
  else if (p.kind === "flyers") body = <FlyerlarmSite game={game} path={r.path} go={go} />;
  else if (p.kind === "agency") body = <AgencySite game={game} path={r.path} go={go} />;
  else if (p.kind === "office") body = <OfficeSite game={game} path={r.path} go={go} />;
  else if (p.kind === "dohle") body = <DohleSite game={game} path={r.path} go={go} />;
  else if (p.kind === "lexwear") body = <LexwearSite game={game} path={r.path} go={go} />;
  else if (p.kind === "market") body = <MarketSite game={game} channel={p.channel} path={r.path} go={go} />;
  else if (p.kind === "shop") body = <PortalSite game={game} host={r.host + (p.base ?? "")} path={r.path.slice((p.base ?? "").length) || "/"} go={go} />;
  else if (p.kind === "shopSetup") body = <ShopSetup game={game} page={p} host={r.host} path={r.path} go={go} />;
  else if (p.kind === "books" && r.path.startsWith("/app") && currentVendor(game)?.id === p.id && booksVendor(p.id)!.deployment === "browser") body = <BooksProgram />;
  else if (p.kind === "books" && p.id !== "lexwear") { const Site = BOOKS_SITES[p.id]; body = <Site game={game} path={r.path} go={go} />; }
  else if (p.kind === "shopVendor") body = <ShopVendorSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "desk") body = <DeskSite game={game} id={p.id} host={r.host + (p.base ?? "")} path={r.path.slice((p.base ?? "").length) || "/"} go={go} />;
  else if (p.kind === "deskSetup") body = <DeskSetup game={game} page={p} host={r.host} go={go} />;
  else if (p.kind === "deskVendor") body = deskById(p.id)!.hosting === "self" ? <SelfDeskSite game={game} id={p.id} path={r.path} go={go} /> : <HostedDeskSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "mailProvider") body = p.id === "ionose" ? <IonoseSite game={game} path={r.path} go={go} />
    : p.id === "ionose-owa" ? <Owa game={game} provider="ionose" host={IONOSE_OWA} path={r.path} go={go} />
    : p.id === "lookout-owa" ? <Owa game={game} provider="lookout" host={LOOKOUT_OWA} path={r.path} go={go} />
    : p.id === "lookout" || p.id === "lookout-admin" ? <LookoutSite game={game} host={r.host} path={r.path} go={go} />
    : p.id === "goggle" ? <GoggleSite game={game} host={r.host} path={r.path} go={go} />
    : p.id === "gmial" ? <Gmial game={game} path={r.path} go={go} /> : <GmixSite game={game} path={r.path} go={go} />;
  else if (p.kind === "panelMail") body = <PanelWebmail game={game} domain={p.domain} />;
  else if (p.kind === "hosttoast") body = <HostToastSite game={game} path={r.path} go={go} />;
  else if (p.kind === "wiki") body = <WikiSite game={game} path={r.path} go={go} />;
  else if (p.kind === "index") body = <IndexSite game={game} path={r.path} go={go} />;
  else if (p.kind === "program") body = <ProgramSite game={game} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "software" || p.kind === "os") body = <SoftwarePage game={game} kind={p.kind} id={p.id} path={r.path} go={go} />;
  else if (p.kind === "console") body = <ConsolePage game={game} hostname={p.hostname} host={r.host} cluster={game.clusters.find((x) => x.id === p.clusterId)} defaced={p.defaced} path={p.path} />;
  else if (p.kind === "ipmi") body = <IpmiPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "kvm") body = <KvmPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "router") {
    const d = game.devices.find((x) => x.id === p.deviceId);
    body = d && isOwnRouter(d) ? <RouterPage game={game} deviceId={p.deviceId} host={r.host} /> : <FritzOz game={game} deviceId={p.deviceId} host={r.host} />;
  }
  else if (p.kind === "switch") body = <SwitchPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "ups") body = <UpsPage game={game} deviceId={p.deviceId} host={r.host} />;
  else if (p.kind === "host") body = <HostPage host={r.host} />;
  else body = <NotFound host={r.host} />;
  const paper = !waiting && r.load !== "down" && ["company", "customer", "webspace", "vendor", "provider", "sponsorboard", "flyers", "agency", "registrar", "parked", "bank", "supplier", "index", "office", "shop", "shopSetup", "software", "os", "program"].includes(p.kind);
  return (
    <>
      {waiting && <div className="web-load" aria-hidden />}
      <div className={`web-view${paper ? " white" : ""}`}>
        {error && <div className="web-error" role="alert">{t(error)}</div>}
        <PageError.Provider value={setError}><PageBoundary key={`${r.host}${r.path}`}>{body}</PageBoundary></PageError.Provider>
      </div>
    </>
  );
}

const showDownloads = () => useStore.getState().openApp("Applications", { kind: "folder", id: "downloads" });

export function DownloadsButton({ game }: { game: GameState }) {
  const running = useDownloads(), now = nowHours(game);
  const name = (id: string) => (imageExists(id) ? isoFile(id as OsImage) : id);
  const live = [
    ...Object.entries(running).filter(([, d]) => d).map(([id, d]) => ({ file: name(id), ...d! })),
    ...softwareDownloads(game).map((d) => ({ file: d.file, start: d.start, hours: d.hours })),
  ].filter((d) => now - d.start < d.hours), first = live[0];
  const done = (d: { start: number; hours: number }) => Math.floor(Math.min(1, (now - d.start) / d.hours) * 100);
  const finished = [...game.media.images.map(isoFile), ...game.media.files, ...softwareDownloads(game).filter((d) => now - d.start >= d.hours).map((d) => d.file)];
  return (
    <button className="btn icon ghost br-dl" aria-label={t("misc1.browser.downloads")} onClick={menuOn(() => [
      ...live.map((d) => ({ label: `${d.file}, ${done(d)}%`, disabled: true })),
      ...finished.map((file) => ({ label: file, run: showDownloads })),
      !finished.length && !live.length && { label: t("misc1.browser.noDownloads"), disabled: true },
      null,
      { label: t("misc1.browser.showInFinder"), run: showDownloads },
    ])}>
      <CircleArrowDown aria-hidden />
      {first && <span className="br-dl-bar"><i key={first.file} style={{ width: `${done(first)}%` }} /></span>}
    </button>
  );
}

export function BrowserApp() {
  const game = useStore((s) => s.game);
  const win = useWin();
  const [tabs, setTabs] = useSessionState<Tab[]>(`browser.tabs.${win.id}`, [{ id: 1, history: [homeUrl()], at: 0, nav: 0 }]);
  const [active, setActive] = useSessionState<number>(`browser.active.${win.id}`, tabs[0]?.id ?? 1);
  const [marks, setMarks] = useSessionState<Mark[]>("browser.marks", []);
  const tab = tabs.find((x) => x.id === active) ?? tabs[0];
  const url = tab.history[tab.at];
  const r = resolve(game, url);
  const [addr, setAddr] = useState(url), field = useRef<HTMLInputElement>(null);
  useEffect(() => setAddr(url), [url, tab.id]);

  const patch = (id: number, f: (t: Tab) => Tab) => setTabs(tabs.map((x) => (x.id === id ? f(x) : x)));
  const go = (to: string) => {
    const { host, path } = split(to), next = `${host}${path}`;
    patch(tab.id, (x) => ({ ...x, history: [...x.history.slice(0, x.at + 1), next], at: x.at + 1, nav: x.nav + 1 }));
  };
  const step = (d: number) => patch(tab.id, (x) => ({ ...x, at: x.at + d, nav: x.nav + 1 }));
  useBack(win.id, () => tab.at > 0 && step(-1));
  const reload = () => patch(tab.id, (x) => ({ ...x, nav: x.nav + 1 }));
  const open = (to: string) => {
    const id = Math.max(...tabs.map((x) => x.id)) + 1;
    setTabs([...tabs, { id, history: [to], at: 0, nav: 0 }]);
    setActive(id);
  };
  const [drag, setDrag] = useState<{ id: number; over: number } | null>(null);
  const moveTab = (id: number, before: number) => {
    const from = tabs.findIndex((x) => x.id === id), to = tabs.findIndex((x) => x.id === before);
    if (from < 0 || to < 0 || from === to) return;
    const rest = tabs.filter((x) => x.id !== id);
    rest.splice(rest.findIndex((x) => x.id === before) + (from < to ? 1 : 0), 0, tabs[from]);
    setTabs(rest);
  };
  const keep = (rest: Tab[]) => {
    if (!rest.length) return win.close();
    if (rest.length === tabs.length) return;
    setTabs(rest);
    if (!rest.some((x) => x.id === active)) {
      const at = tabs.findIndex((x) => x.id === active);
      setActive((tabs.slice(0, at).reverse().find((x) => rest.includes(x)) ?? rest[0]).id);
    }
  };
  const close = (id: number) => keep(tabs.filter((x) => x.id !== id));
  const root = useRef<HTMLDivElement>(null);
  const dragEnd = (x: Tab, e: DragEvent) => {
    setDrag(null);
    const c = carried;
    carried = null;
    if (c?.taken) return close(x.id);
    const box = root.current?.closest(".window")?.getBoundingClientRect();
    const { clientX: cx, clientY: cy } = e;
    if (!box || tabs.length < 2 || (!cx && !cy) || (cx >= box.left && cx <= box.right && cy >= box.top && cy <= box.bottom)) return;
    const { openApp, place } = useStore.getState();
    openApp("Browser", undefined, true);
    const { id, w, h } = useStore.getState().windows.at(-1)!;
    writeSession(`browser.tabs.${id}`, [{ ...x, id: 1 }]);
    writeSession(`browser.active.${id}`, 1);
    // Under the pointer, kept clear of the menu bar and dock.
    place(id, { x: Math.max(0, Math.min(cx - 120, innerWidth - w)), y: Math.max(30, Math.min(cy - 16, innerHeight - 80 - h)) });
    close(x.id);
  };
  const take = (e: DragEvent) => {
    if (!carried || carried.win === win.id) return;
    e.preventDefault();
    carried.taken = true;
    const id = Math.max(...tabs.map((x) => x.id)) + 1;
    setTabs([...tabs, { ...carried.tab, id }]);
    setActive(id);
  };
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
    if (have) return setActive(have.id);
    // One bank tab: a payment link steers the open one instead of adding another.
    const bank = resolve(game, f.id).page.kind === "bank" && tabs.find((x) => resolve(game, x.history[x.at]).page.kind === "bank");
    if (bank) {
      patch(bank.id, (x) => ({ ...x, history: [...x.history.slice(0, x.at + 1), f.id], at: x.at + 1, nav: x.nav + 1 }));
      setActive(bank.id);
    } else open(f.id);
  });

  const bookmarks = [...defaultBookmarks(game), ...marks];
  const marked = bookmarks.some((m) => m.url === url);
  const isDefault = defaultBookmarks(game).some((m) => m.url === url);
  const folder = companyFolder(game);
  const folderItem = (r: IndexRow): MenuEntry => ({ label: r.title, run: () => go(r.url) });
  const folderMenu = (): MenuEntry[] => [...folder.rows.map(folderItem), null, ...folder.groups.map((g) => ({ label: g.title, items: g.rows.map(folderItem) }))];
  const toggleMark = () => setMarks(marked ? marks.filter((m) => m.url !== url) : [...marks, { title: titleOf(game, r), url }]);

  return (
    <div className="br" ref={root} onKeyDown={(e) => { if (e.key === "l" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); field.current?.focus(); field.current?.select(); } }} onDragOver={(e) => carried && carried.win !== win.id && e.preventDefault()} onDrop={take}>
      <div className="br-tabs" role="tablist">
        {tabs.map((x, i) => {
          const rx = resolve(game, x.history[x.at]);
          return (
            <div key={x.id} role="tab" aria-selected={x.id === tab.id} className={`br-tab${drag && drag.over === x.id && drag.id !== x.id ? " drop" : ""}`} tabIndex={0} onClick={() => setActive(x.id)} onContextMenu={menuOn(() => tabMenu(i))}
              draggable onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; e.dataTransfer.setData("text/plain", x.history[x.at]); carried = { win: win.id, tab: x, taken: false }; setDrag({ id: x.id, over: x.id }); }}
              onDragOver={(e) => { if (!drag) return; e.preventDefault(); if (drag.over !== x.id) setDrag({ ...drag, over: x.id }); }}
              onDrop={(e) => { e.preventDefault(); if (drag) moveTab(drag.id, x.id); setDrag(null); }}
              onDragEnd={(e) => dragEnd(x, e)}
              onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && setActive(x.id)}>
              <Favicon game={game} r={rx} />
              <span className="br-tab-title">{titleOf(game, rx)}</span>
              <button className="br-tab-x" aria-label={t("misc1.browser.closeTab")} onClick={(e) => { e.stopPropagation(); close(x.id); }}><X aria-hidden /></button>
            </div>
          );
        })}
        <button className="br-new" aria-label={t("misc1.browser.newTab")} onClick={() => open(homeUrl())}><Plus aria-hidden /></button>
      </div>
      <div className="br-bar">
        <button className="btn icon ghost" aria-label={t("misc1.browser.back")} disabled={tab.at === 0} onClick={() => step(-1)}><ArrowLeft aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.forward")} disabled={tab.at >= tab.history.length - 1} onClick={() => step(1)}><ArrowRight aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.reload")} onClick={reload}><RotateCw aria-hidden /></button>
        <button className="btn icon ghost" aria-label={t("misc1.browser.home")} onClick={() => go(homeUrl())}><House aria-hidden /></button>
        <form className="br-addr" onSubmit={(e) => { e.preventDefault(); if (addr.trim()) go(addr); }}>
          <Favicon game={game} r={r} />
          <input ref={field} aria-label={t("misc1.browser.address")} value={addr} spellCheck={false} autoCapitalize="off" onChange={(e) => setAddr(e.target.value)} onFocus={(e) => e.currentTarget.select()} onMouseDown={(e) => { e.preventDefault(); e.currentTarget.focus(); e.currentTarget.select(); }} />
          <button type="button" className="br-star" aria-label={t("misc1.browser.bookmark")} aria-pressed={marked} disabled={isDefault} onClick={toggleMark}><Star aria-hidden /></button>
        </form>
        <DownloadsButton game={game} />
      </div>
      <div className="br-marks">
        {(folder.rows.length > 0 || folder.groups.length > 0) && (
          <button className="br-mark br-folder" aria-haspopup="menu" onClick={menuOn(folderMenu)}>
            <Folder aria-hidden />
            <span>{folder.title}</span>
            <ChevronDown aria-hidden />
          </button>
        )}
        {bookmarks.map((m) => (
          <button key={m.url} className="br-mark" onClick={() => go(m.url)}>
            <Favicon game={game} r={resolve(game, m.url)} />
            <span>{m.title}</span>
          </button>
        ))}
      </div>
      <VaultOffer />
      <Viewport key={`${tab.id}:${tab.nav}`} game={game} r={r} go={go} />
    </div>
  );
}
