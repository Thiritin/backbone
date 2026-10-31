import { AppWindow, BatteryCharging, Cable, ChevronLeft, ChevronRight, HardDrive, Info, LayoutGrid, List, MonitorCog, Network, Router, Server, Shield, ShoppingCart, Store } from "lucide-react";
import { useEffect, useState } from "react";
import { useSessionState } from "../../session";
import { euro } from "../../../sim/00-core/money";
import { monthIndexOf, yearOf } from "../../../sim/00-core/time";
import { cardOf, cardWatts } from "../../../sim/10-catalog/gpu";
import { boardSpec, brandOnSale, brandFrom, wattsFactorOf, brandsOf, COMPONENTS, cpuOptions, cpuWattsShift, modelById, modelName, partOffers, presetSku, shopModels, vendorsOf, type DeviceModel, type PartSpec } from "../../../sim/10-catalog/hardware";
import { skuById, VENDOR_NAME, type Vendor } from "../../../sim/10-catalog/cpus";
import { lineParts, unitPrice, type CartLine } from "../../../sim/90-actions/hardware";
import { Cart, Stepper } from "./Cart";
import { Software } from "./Software";
import { ShopFilter, useFilter } from "./FilterBar";
import { CLASS_TREE, classLabel, classOf, inClass, makerOf, MAKERS, matchesFilter, partClass, rowLabel, sortItems, type Sort } from "./filter";
import { familyById, isRamFamily } from "../../../sim/10-catalog/families";
import { onMarket, type Channel } from "../../../sim/10-catalog/used";
import { Used } from "./Used";
import { Isometric } from "../../art/Isometric";
import { BrandLogo } from "../../art/logos";
import { useFocus, useStore } from "../../store";
import { socketOf } from "../../../sim/10-catalog/cpus";
import { memoryDriveRows, clockLabel, cores, disk, height, partLabel, partSize, portsText, ram, speed, threadsLabel } from "../hw";
import "./shop.css";
import { LOCALE } from "../../../i18n/lang";
import { t } from "../../../i18n/en";

const ICON: Record<string, typeof Server> = {
  Servers: Server, Switches: Network, Routers: Router, Security: Shield, "Patch panels": Cable, "Remote access": MonitorCog, Power: BatteryCharging, Parts: HardDrive,
};

const releaseLabel = (month: number) => t("shop.release", { month: month % 12, year: Math.floor(month / 12) });

// The spec sheet of a stick or drive with a maker: its type and speed, or its interface, class and throughput.
function familyRows(part: PartSpec): [string, string][] {
  const f = familyById(part.sku);
  if (!f) return [];
  if (isRamFamily(f)) return [["Type", `${f.ddr}-${f.mts}`], ["Stick", f.stick]];
  return [["Interface", f.iface], f.rpm ? ["Spindle", `${f.rpm.toLocaleString(LOCALE)} rpm`] : ["Endurance", `${f.dwpd} DWPD`], ["Read", `${f.mbps.toLocaleString(LOCALE)} MB/s`], ["IOPS", f.iops.toLocaleString(LOCALE)]];
}

// A device model from a manufacturer, or a sized part; make is who the sidebar files it under.
interface Item { model: DeviceModel; brand: string; make: string | null; cls: string; part?: PartSpec }

// Every model comes from each manufacturer that builds its kind; parts are sold sized.
const items = (year: number, month: number): Item[] => [
  ...shopModels(year).filter((m) => m.kind !== "part").flatMap((model) => brandsOf(model).filter((brand) => brandOnSale(model, brand, month)).map((brand) => ({ model, brand, make: brand, cls: classOf(model) }))),
  ...partOffers(year).map((part) => ({ model: modelById(`part-${part.kind}`), brand: "Generic", make: makerOf("Generic", part), cls: partClass(part.kind), part })),
];
const itemKey = (it: Item) => `${it.model.id}|${it.brand}|${it.part?.size ?? ""}|${it.part?.ff ?? ""}|${it.part?.vendor ?? ""}|${it.part?.gen ?? ""}|${it.part?.sku ?? ""}`;

export function ShopApp() {
  const game = useStore((s) => s.game), hour = game.hour;
  const [market, setMarket] = useSessionState<"new" | "used">("shop.market", "new");
  const [channel, setChannel] = useSessionState<Channel>("shop.usedChannel", "ebuy");
  const [maker, setMaker] = useSessionState<string | null>("shop.maker", null);
  const [cls, setCls] = useSessionState<string | null>("shop.cls", null);
  useFocus("Shop", (f) => { if (f.kind === "software") { setMarket("new"); setMaker(null); setCls("Software"); } });
  const all = items(yearOf(hour), monthIndexOf(hour));
  const software = market === "new" && cls === "Software";
  const rows: { make: string | null; cls: string }[] = market === "new" ? all
    : game.used.filter((l) => l.channel === channel && onMarket(game, l)).map((l) => ({ make: l.brand, cls: classOf(modelById(l.model)) }));
  const keep = (r: { make: string | null; cls: string }) => (!maker || r.make === maker) && inClass(cls, r.cls);
  const count = (f: (r: { make: string | null; cls: string }) => boolean) => rows.filter(f).length;
  const [filter, setFilter, clearFilter] = useFilter();
  const [sort, setSort] = useSessionState<Sort>("shop.sort", "default");
  const scoped = all.filter(keep);
  const shown = sortItems(scoped.filter((it) => matchesFilter(it.model, filter, it.part)), sort, yearOf(hour));
  const [cartOpen, setCartOpen] = useState(false);
  const inCart = useStore((st) => st.cart.reduce((n, l) => n + l.qty, 0));
  const [detail, setDetail] = useSessionState<string | null>("shop.detail", null);
  useEffect(() => setDetail(null), [maker, cls, market]);
  const opened_ = detail ? all.find((it) => itemKey(it) === detail) : undefined;
  const [view, setView] = useSessionState<"grid" | "list">("shop.view", "grid");
  // Parent classes the player opened; a parent also shows its children while it or one of them is picked.
  const [opened, setOpened] = useSessionState<string[]>("shop.opened", []);
  const toggle = (p: string) => setOpened(opened.includes(p) ? opened.filter((o) => o !== p) : [...opened, p]);
  const pickMaker = (m: string) => { setMaker(maker === m ? null : m); if (software) setCls(null); };
  const classItem = (c: string, Icon: typeof Server | null) => (
    <button key={c} className={`side-item${Icon ? "" : " shop-side-sub"}${cls === c ? " active" : ""}`} aria-pressed={cls === c} onClick={() => setCls(cls === c ? null : c)}>
      {Icon && <Icon />}{classLabel(c)}<span className="side-count">{count((r) => inClass(c, r.cls) && (!maker || r.make === maker))}</span>
    </button>
  );
  const parentItem = (p: string, kids: string[]) => {
    const shownKids = kids.filter((c) => rows.some((r) => r.cls === c));
    if (!shownKids.length) return [classItem(p, ICON[p])];
    const open = opened.includes(p) || cls === p || kids.includes(cls ?? "");
    return [
      <div key={p} className="shop-side-parent">
        {classItem(p, ICON[p])}
        <button className={`shop-side-toggle${open ? " open" : ""}`} aria-label={t(open ? "shop.collapse" : "shop.expand", { name: classLabel(p) })} aria-expanded={open} onClick={() => toggle(p)}><ChevronRight /></button>
      </div>,
      ...(open ? shownKids.map((c) => classItem(c, null)) : []),
    ];
  };

  return (
    <div className="shop">
      <aside className="sidebar shop-side">
        <button className={`side-item${!maker && !cls ? " active" : ""}`} aria-pressed={!maker && !cls} onClick={() => { setMaker(null); setCls(null); }}><Store />{t("shop.all")}<span className="side-count">{rows.length}</span></button>
        {market === "new" && (
          <button className={`side-item shop-side-soft${software ? " active" : ""}`} aria-pressed={software} onClick={() => { setMaker(null); setCls(software ? null : "Software"); }}>
            <span className="shop-soft-tile"><AppWindow /></span>{t("shop.software")}
          </button>
        )}
        <div className="side-h">{t("shop.manufacturer")}</div>
        {MAKERS.filter((m) => rows.some((r) => r.make === m)).map((m) => (
          <button key={m} className={`side-item${maker === m ? " active" : ""}`} aria-pressed={maker === m} onClick={() => pickMaker(m)}>
            <BrandLogo brand={m} size={16} />{m}<span className="side-count">{count((r) => r.make === m && (software || inClass(cls, r.cls)))}</span>
          </button>
        ))}
        <div className="side-h">{t("shop.class")}</div>
        {CLASS_TREE.filter(([p]) => rows.some((r) => inClass(p, r.cls))).flatMap(([p, kids]) => parentItem(p, kids))}
      </aside>
      <div className="shop-main">
        <div className="shop-bar">
          <div className="seg" role="group" aria-label={t("shop.market")}>
            <button aria-pressed={market === "new"} onClick={() => setMarket("new")}>{t("shop.new")}</button>
            <button aria-pressed={market === "used"} onClick={() => { setMarket("used"); if (software) setCls(null); }}>{t("shop.used")}</button>
          </div>
          <span className="grow" />
          {market === "new" && !software && !opened_ && (
            <div className="seg shop-view" role="group" aria-label={t("shop.view")}>
              <button aria-pressed={view === "grid"} aria-label={t("shop.grid")} title={t("shop.grid")} onClick={() => setView("grid")}><LayoutGrid /></button>
              <button aria-pressed={view === "list"} aria-label={t("shop.list")} title={t("shop.list")} onClick={() => setView("list")}><List /></button>
            </div>
          )}
          <button className="btn ghost" aria-pressed={cartOpen} onClick={() => setCartOpen(!cartOpen)}><ShoppingCart />{t("shop.cart")}<span key={inCart} className="num shop-count" data-full={inCart > 0 || undefined}>{inCart}</span></button>
        </div>
        {market === "new" && !software && !opened_ && <ShopFilter items={scoped} filter={filter} set={setFilter} clear={clearFilter} sort={sort} setSort={setSort} />}
        <div className="shop-body">
          {market === "used" ? <Used channel={channel} setChannel={setChannel} keep={(l) => keep({ make: l.brand, cls: classOf(modelById(l.model)) })} /> : software ? <Software /> : opened_ ? <Details {...opened_} maker={filter.vendor} onBack={() => setDetail(null)} /> : view === "list" ? (
            <div className="shop-list">
              {shown.map((it) => <Row key={itemKey(it)} {...it} maker={filter.vendor} onOpen={() => setDetail(itemKey(it))} />)}
              {!shown.length && <div className="shop-none">{t("shop.noModels")}</div>}
            </div>
          ) : (
            <div className="shop-grid">
              {shown.map((it) => <Card key={itemKey(it)} {...it} maker={filter.vendor} onOpen={() => setDetail(itemKey(it))} />)}
              {!shown.length && <div className="shop-none">{t("shop.noModels")}</div>}
            </div>
          )}
          {cartOpen && <Cart />}
        </div>
      </div>
    </div>
  );
}

// The card and the list row share the configured line, its spec rows and the buy controls.
function useOffer({ model, brand, part, maker }: Item & { maker: Vendor | null }) {
  const addToCart = useStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);
    const makers = vendorsOf(model);
  const [vendor, setVendor] = useState<Vendor>(maker && makers.includes(maker) ? maker : makers[0] ?? "indel");
  const year = yearOf(useStore((s) => s.game.hour));
  const s = model.server;
  // The CPU part in every socket: the line's default until the player picks another of the socket.
  const options = s ? cpuOptions(model, vendor, year) : [], preset = s ? presetSku(model, vendor)?.id : undefined;
  const [picked, setPicked] = useState<Record<string, string>>({});
  const cpu = picked[vendor] ?? preset;
  const node = model.nodes && modelById(model.nodes.model), nodeCores = node ? lineParts({ model: node.id, brand, qty: 1 }).filter((p) => p.kind === "cpu").reduce((n, p) => n + (p.size ?? 0), 0) : 0;
  const spec = part ? COMPONENTS[part.kind] : null;
  // The line as configured: the server with the vendor's board and CPUs.
  const line: CartLine = { model: model.id, brand, qty, ...(s ? { vendor } : {}), ...(cpu && cpu !== preset ? { cpu } : {}), ...(part ? { part } : {}) };
  const board = s ? boardSpec(model, vendor) : undefined;
  const built = lineParts(line);
  const cards = built.filter((p) => p.kind === "gpu");
  const sum = (kind: string) => built.filter((p) => p.kind === kind).reduce((n, p) => n + (p.size ?? 0), 0);
  const rows: [string, string][] = spec ? [...(part!.size !== undefined && part!.kind !== "gpu" ? [["Size", partSize(part!)]] as [string, string][] : []), ...(part!.kind === "cpu" && part!.vendor && part!.gen ? [...(threadsLabel(part!) ? [["Threads", threadsLabel(part!)]] : []), ["Clock", clockLabel(part!)], ["Socket", socketOf(part!.vendor, part!.gen) ?? ""]] as [string, string][] : []), ...familyRows(part!), ...(part!.kind === "board" && part!.vendor && part!.gen ? [["Socket", socketOf(part!.vendor, part!.gen) ?? ""], ["Takes CPUs up to", cores(part!.size ?? 0)], ["Generation", `G${part!.gen}`]] as [string, string][] : []), ["Life", t("shop.years", { n: spec.life })], ["Swap while running", t(`shop.swap.${spec.hotSwap}`)], ...(part!.kind === "gpu" ? [["Power", `${cardOf(part!.size).watts} W`]] as [string, string][] : [])] : [
    ["Height", height(model)],
    ...(!part && model.price > 0 ? [["Release", releaseLabel(brandFrom(model, brand))]] as [string, string][] : []),
    ...(model.throughputGbit ? [["Throughput", speed(model.throughputGbit)]] as [string, string][] : []),
    ...(model.ipsGbit ? [["IPS throughput", speed(model.ipsGbit)]] as [string, string][] : []),
    ...(model.sessions ? [["Sessions", model.sessions.toLocaleString(LOCALE)]] as [string, string][] : []),
    ...(s ? [["CPU", `${s.sockets} × ${VENDOR_NAME[vendor]} ${(cpu && skuById(cpu)?.name) ?? ""}`.trim()], ["Cores", cores(sum("cpu"))], ...(cpu && skuById(cpu) ? [["Threads", `${s.sockets * skuById(cpu)!.threads}`]] : []), ["Clock", clockLabel({ kind: "cpu", vendor, gen: model.gen, sku: cpu })], ["Mainboard", board?.name ?? ""], ["CPU sockets", board ? t("shop.socketsValue", { n: board.sockets, socket: board.socket, cores: cores(board.maxCores) }) : ""], ["RAM", ram(s.ramGb)],
      ...(cards.length ? [["GPUs", `${cards.length} × ${cardOf(cards[0].size).name}`]] as [string, string][] : []),
      ["Storage", `${disk(s.diskGb)} ${s.disk}`], ...memoryDriveRows(built)] as [string, string][] : []),
    ...(model.kind === "gateway" && model.price > 0 ? [["Routing", model.fullTable ? t("shop.routingFull") : t("shop.routingDefault")], ...(model.fullTable ? [["BGP sessions", `${model.bgpSessions}`]] : [])] as [string, string][] : []),
    ...(node?.server ? [["Nodes", `${model.nodes!.count}`], ["Cores per node", cores(nodeCores)], ["RAM per node", ram(node.server.ramGb)], ["Storage per node", `${disk(node.server.diskGb)} ${node.server.disk}`],
      ["NICs per node", portsText(node)], ["PSUs", `${model.psus}`], ["Power", `${Math.round(wattsFactorOf(node, brand) * node.watts * model.nodes!.count)} W`]] as [string, string][] : []),
    ...(model.batteryWh ? [["Battery", `${model.batteryWh} Wh`]] as [string, string][] : model.outlets ? [["Outlets", `${model.outlets}`]] as [string, string][] : node ? [] : [[model.kind === "patch" ? "Jacks" : model.kind === "server" ? "NICs" : "Ports", portsText(model)]] as [string, string][]),
    ...(model.watts ? [...(model.kind === "pdu" || ["kvm", "console", "oob"].includes(model.kind) ? [] : [["PSUs", `${model.psus}`]]), ["Power", `${Math.round(wattsFactorOf(model, brand) * (model.watts + cpuWattsShift(model, built)) + cardWatts(cards.map((p) => ({ ...p, failedAt: null }))))} W`]] as [string, string][] : []),
  ];
  // The few facts the card and the list row show; the rest sits on the details page.
  const get = (k: string) => rows.find(([l]) => l === k)?.[1] ?? "";
  const summary: [string, string][] = s ? [["CPU", `${get("Cores")} ${get("CPU")}, ${get("Clock")}`], ["Board", get("Mainboard")], ["RAM", get("RAM")], ["Storage", get("Storage")], ["PSUs", get("PSUs")]]
    : rows.filter(([k]) => ["Size", "Ports", "Jacks", "Outlets", "Battery", "Nodes"].includes(k)).slice(0, 1);
  const reset = () => { setQty(1); };
  const buy = () => { addToCart(line); reset(); };
  const vendorSeg = (makers.length > 1 || options.length > 1) && (
    <div className="shop-config">
      {makers.length > 1 && (
        <div className="seg shop-vendor" role="group" aria-label={t("shop.cpuVendor")}>
          {makers.map((v) => <button key={v} aria-pressed={vendor === v} onClick={() => setVendor(v)}>{VENDOR_NAME[v]}</button>)}
        </div>
      )}
      {options.length > 1 && (
        <select className="shop-cpu" aria-label={t("shop.cpu")} value={cpu ?? ""} onChange={(e) => setPicked({ ...picked, [vendor]: e.target.value })}>
          {options.map((c) => <option key={c.id} value={c.id}>{c.name}, {c.cores}c/{c.threads}t, {c.boost} GHz</option>)}
        </select>
      )}
    </div>
  );
  return { s, rows, summary, line, year, qty, setQty, vendor, vendorSeg, buy };
}

const Maker = ({ make, cls }: { make: string | null; cls: string }) => (
  <span className="shop-maker">{make && <><BrandLogo brand={make} size={14} />{make}</>}<span className="pill">{classLabel(cls)}</span></span>
);

function Row(props: Item & { maker: Vendor | null; onOpen: () => void }) {
  const { model, brand, make, cls, part, onOpen } = props;
  const { summary, line, year, qty, setQty, vendorSeg, buy } = useOffer(props);
  return (
    <div className="shop-row">
      <div className="shop-row-main">
        <button className="shop-row-pic" aria-label={t("shop.details")} onClick={onOpen}><Isometric model={model} brand={brand} w={64} /></button>
        <div className="shop-row-name">
          <button className="shop-link" onClick={onOpen}>{part ? partLabel(part) : modelName(model, brand)}</button>
          <Maker make={make} cls={cls} />
        </div>
        <dl className="shop-row-specs">
          {summary.map(([k, v]) => <div key={k}><dt>{rowLabel(k)}</dt><dd className="num">{v}</dd></div>)}
        </dl>
        <div className="shop-row-buy">
          {vendorSeg}
          <span className="shop-row-act">
            <button className="btn icon" aria-label={t("shop.details")} title={t("shop.details")} onClick={onOpen}><Info /></button>
            <strong className="num">{euro(unitPrice(line, year) * qty)}</strong>
            <Stepper value={qty} onChange={setQty} min={1} />
            <button className="btn primary" onClick={buy}><ShoppingCart />{t("shop.add")}</button>
          </span>
        </div>
      </div>
    </div>
  );
}

function Card(props: Item & { maker: Vendor | null; onOpen: () => void }) {
  const { model, brand, make, cls, part, onOpen } = props;
  const { summary, line, year, qty, setQty, vendorSeg, buy } = useOffer(props);
  return (
    <div className="shop-card">
      <button className="shop-pic" aria-label={t("shop.details")} onClick={onOpen}><Isometric model={model} brand={brand} w={170} /></button>
      <div className="shop-name">
        <button className="shop-link" onClick={onOpen}>{part ? partLabel(part) : modelName(model, brand)}</button>
        <Maker make={make} cls={cls} />
      </div>
      {vendorSeg}
      <dl className="shop-specs">
        {summary.map(([k, v]) => <div key={k}><dt>{rowLabel(k)}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      <div className="shop-buy">
        <strong className="num">{euro(unitPrice(line, year) * qty)}</strong>
        <span className="grow" />
        <Stepper value={qty} onChange={setQty} min={1} />
        <button className="btn primary" onClick={buy}><ShoppingCart />{t("shop.addToCart")}</button>
      </div>
    </div>
  );
}

// Every fact about one item, with the build panel and the buy controls.
function Details({ onBack, ...props }: Item & { maker: Vendor | null; onBack: () => void }) {
  const { model, brand, make, cls, part } = props;
  const { rows, line, year, qty, setQty, vendorSeg, buy } = useOffer(props);
  return (
    <div className="shop-detail">
      <button className="btn ghost shop-back" onClick={onBack}><ChevronLeft />{t("shop.back")}</button>
      <div className="shop-detail-head">
        <div className="shop-detail-pic"><Isometric model={model} brand={brand} w={200} /></div>
        <div className="shop-detail-info">
          <h2>{part ? partLabel(part) : modelName(model, brand)}</h2>
          <Maker make={make} cls={cls} />
          {vendorSeg}
          <div className="shop-buy shop-detail-buy">
            <strong className="num">{euro(unitPrice(line, year) * qty)}</strong>
            <Stepper value={qty} onChange={setQty} min={1} />
            <button className="btn primary" onClick={buy}><ShoppingCart />{t("shop.addToCart")}</button>
          </div>
        </div>
      </div>
      <dl className="shop-detail-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{rowLabel(k)}</dt><dd className="num">{v}</dd></div>)}
      </dl>
    </div>
  );
}
