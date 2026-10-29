import { AppWindow, BatteryCharging, Cable, HardDrive, History, MonitorCog, Network, Router, Server, Shield, ShoppingCart, SlidersHorizontal, Store } from "lucide-react";
import { useState } from "react";
import { useSessionState } from "../../session";
import { euro } from "../../../sim/00-core/money";
import { monthIndexOf, yearOf } from "../../../sim/00-core/time";
import { cardOf, cardWatts } from "../../../sim/10-catalog/gpu";
import { brandOnSale, brandFrom, brandUntil, wattsFactorOf, brandsOf, COMPONENTS, cpuWattsShift, fits, MANUFACTURERS, modelById, partOffers, shopModels, vendorsOf, type DeviceModel, type PartSpec } from "../../../sim/10-catalog/hardware";
import { VENDOR_NAME, type Vendor } from "../../../sim/10-catalog/cpus";
import { partPrice } from "../../../sim/10-catalog/parts";
import { lineParts, unitPrice, type CartLine } from "../../../sim/90-actions/hardware";
import { Cart, Stepper } from "./Cart";
import { Software } from "./Software";
import { ShopFilter, useFilter } from "./FilterBar";
import { matchesFilter, sortItems, type Sort } from "./filter";
import { Used } from "./Used";
import { lineOf } from "../../art/fronts";
import { Isometric } from "../../art/Isometric";
import { BrandLogo } from "../../art/logos";
import { useFocus, useStore } from "../../store";
import { cores, disk, height, partLabel, partSize, portsText, ram, speed } from "../hw";
import "./shop.css";

const LINE_NAME: Record<string, string> = {
  compute: "Balanced", "compute-2psu": "Balanced", dense: "Compute dense", memory: "Memory optimized",
  storage: "Storage", backup: "Backup", archive: "Archive", gpu: "GPU", arm: "ARM",
};
const CLASSES: [string, typeof Server][] = [
  ...[...new Set(Object.values(LINE_NAME))].map((c): [string, typeof Server] => [c, Server]),
  ["Multi-node", Server], ["Layer 2", Network], ["Layer 3", Network], ["Routers", Router], ["Security", Shield], ["Patch panels", Cable], ["Remote access", MonitorCog], ["Power", BatteryCharging], ["Parts", HardDrive],
];
const classOf = (m: DeviceModel) =>
  m.kind === "chassis" ? "Multi-node" : m.kind === "server" ? LINE_NAME[lineOf(m)!] : m.kind === "switch" ? `Layer ${m.layer ?? 2}` : m.kind === "firewall" ? "Security" : m.kind === "gateway" ? "Routers" : m.kind === "ups" || m.kind === "pdu" ? "Power" : m.kind === "kvm" || m.kind === "console" || m.kind === "oob" ? "Remote access" : "Patch panels";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const releaseLabel = (month: number) => `${MONTHS[month % 12]} ${Math.floor(month / 12)}`;

const SWAP = { raid: "In RAID", dual: "With two", yes: "Yes", no: "No" };

// A device model from a manufacturer, or a sized part from the Parts tab.
interface Item { model: DeviceModel; brand: string; cls: string; part?: PartSpec }

// Every model comes from each manufacturer that builds its kind; parts are sold sized.
const items = (year: number, month: number): Item[] => [
  ...shopModels(year).filter((m) => m.kind !== "part").flatMap((model) => brandsOf(model).filter((brand) => brandOnSale(model, brand, month)).map((brand) => ({ model, brand, cls: classOf(model) }))),
  ...partOffers(year).map((part) => ({ model: modelById(`part-${part.kind}`), brand: "Generic", cls: "Parts", part })),
];
const itemKey = (it: Item) => `${it.model.id}|${it.brand}|${it.part?.size ?? ""}|${it.part?.ff ?? ""}|${it.part?.vendor ?? ""}|${it.part?.gen ?? ""}`;

export function ShopApp() {
  const hour = useStore((s) => s.game.hour);
  const [maker, setMaker] = useSessionState<string | null>("shop.maker", null);
  const [cls, setCls] = useSessionState<string | null>("shop.cls", null);
  const [software, setSoftware] = useSessionState("shop.software", false);
  const [used, setUsed] = useSessionState("shop.used", false);
  const pick = (m: string | null, c: string | null) => { setMaker(m); setCls(c); setSoftware(false); setUsed(false); };
  useFocus("Shop", (f) => { if (f.kind === "software") { pick(null, null); setSoftware(true); } });
  const all = items(yearOf(hour), monthIndexOf(hour));
  const [filter, setFilter, clearFilter] = useFilter();
  const [sort, setSort] = useSessionState<Sort>("shop.sort", "default");
  const scoped = all.filter((it) => (!maker || it.brand === maker) && (!cls || it.cls === cls));
  const shown = sortItems(scoped.filter((it) => matchesFilter(it.model, filter, it.part)), sort, yearOf(hour));
  const count = (f: (it: Item) => boolean) => all.filter(f).length;
  const [cartOpen, setCartOpen] = useState(false);
  const inCart = useStore((st) => st.cart.reduce((n, l) => n + l.qty, 0));

  return (
    <div className="shop">
      <aside className="sidebar shop-side">
        <div className="side-h">Manufacturer</div>
        <button className={`side-item${!maker && !software && !used ? " active" : ""}`} aria-pressed={!maker && !software && !used} onClick={() => pick(null, cls)}><Store />All<span className="side-count">{count((it) => !cls || it.cls === cls)}</span></button>
        <button className={`side-item${software ? " active" : ""}`} aria-pressed={software} onClick={() => { pick(null, null); setSoftware(true); }}><AppWindow />Software</button>
        <button className={`side-item${used ? " active" : ""}`} aria-pressed={used} onClick={() => { pick(null, null); setUsed(true); }}><History />Used</button>
        {MANUFACTURERS.filter(({ name }) => all.some((it) => it.brand === name)).map(({ name }) => (
          <button key={name} className={`side-item${maker === name ? " active" : ""}`} aria-pressed={maker === name} onClick={() => pick(name, cls)}>
            <BrandLogo brand={name} size={16} />{name}<span className="side-count">{count((it) => it.brand === name && (!cls || it.cls === cls))}</span>
          </button>
        ))}
        <div className="side-h">Class</div>
        {CLASSES.filter(([c]) => all.some((it) => it.cls === c)).map(([c, Icon]) => (
          <button key={c} className={`side-item${cls === c ? " active" : ""}`} aria-pressed={cls === c} onClick={() => pick(maker, cls === c ? null : c)}>
            <Icon />{c}<span className="side-count">{count((it) => it.cls === c && (!maker || it.brand === maker))}</span>
          </button>
        ))}
      </aside>
      <div className="shop-main">
        <div className="shop-bar">
          <span className="grow" />
          <button className="btn ghost" aria-pressed={cartOpen} onClick={() => setCartOpen(!cartOpen)}><ShoppingCart />Cart<span className="num shop-count">{inCart}</span></button>
        </div>
        {!software && !used && <ShopFilter items={scoped} filter={filter} set={setFilter} clear={clearFilter} sort={sort} setSort={setSort} />}
        <div className="shop-body">
          {used ? <Used /> : software ? <Software /> : (
            <div className="shop-grid">
              {shown.map((it) => <Card key={itemKey(it)} {...it} maker={filter.vendor} />)}
              {!shown.length && <div className="shop-none">No models</div>}
            </div>
          )}
          {cartOpen && <Cart />}
        </div>
      </div>
    </div>
  );
}

const BUILD_KINDS = ["cpu", "ram", "hdd", "ssd", "nvme", "gpu"];

// Parts a server can carry on top of its preset or bare chassis, with a count each.
// The parts a chassis with a board of the vendor takes as extras.
const buildOffers = (model: DeviceModel, vendor: Vendor, year: number) =>
  partOffers(year).filter((p) => BUILD_KINDS.includes(p.kind) && !fits(model, [{ kind: "board", vendor }, p]));

function Build({ model, brand, vendor, qty, bare, setBare, counts, setCounts }: {
  model: DeviceModel; brand: string; vendor: Vendor; qty: number; bare: boolean; setBare: (b: boolean) => void; counts: Record<number, number>; setCounts: (c: Record<number, number>) => void;
}) {
  const year = yearOf(useStore((s) => s.game.hour));
  const offers = buildOffers(model, vendor, year);
  const lineWith = (c: Record<number, number>): CartLine => ({
    model: model.id, brand, vendor, qty, bare, extras: offers.flatMap((p, i) => (c[i] ? [{ kind: p.kind, size: p.size, ff: p.ff, qty: c[i] }] : [])),
  });
  const set = (i: number, n: number) => setCounts({ ...counts, [i]: n });
  return (
    <div className="shop-build">
      <div className="seg" role="group" aria-label="Build">
        <button aria-pressed={!bare} onClick={() => setBare(false)}>Preset</button>
        <button aria-pressed={bare} onClick={() => setBare(true)}>Bare chassis</button>
      </div>
      {offers.map((p, i) => (
        <div key={`${p.kind}|${p.size}|${p.ff}`} className="shop-extra">
          <span>{partLabel(p)}</span>
          <span className="num shop-muted">{euro(partPrice(p.kind, p.size, p.ff, year, p))}</span>
          <Stepper value={counts[i] ?? 0} onChange={(n) => set(i, n)} max={fits(model, lineParts(lineWith({ ...counts, [i]: (counts[i] ?? 0) + 1 }))) ? counts[i] ?? 0 : undefined} label={`${partLabel(p)} quantity`} />
        </div>
      ))}
    </div>
  );
}

function Card({ model, brand, cls, part, maker }: Item & { maker: Vendor | null }) {
  const addToCart = useStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false), [bare, setBare] = useState(false), [counts, setCounts] = useState<Record<number, number>>({});
  const makers = vendorsOf(model);
  const [vendor, setVendor] = useState<Vendor>(maker && makers.includes(maker) ? maker : makers[0] ?? "indel");
  const year = yearOf(useStore((s) => s.game.hour));
  const s = model.server;
  const node = model.nodes && modelById(model.nodes.model), nodeCores = node ? lineParts({ model: node.id, brand, qty: 1 }).filter((p) => p.kind === "cpu").reduce((n, p) => n + (p.size ?? 0), 0) : 0;
  const spec = part ? COMPONENTS[part.kind] : null;
  // The line as configured: the preset or the bare chassis with the vendor's board and CPUs, with the extras ticked in the build panel.
  const offers = s ? buildOffers(model, vendor, year) : [];
  const extras = offers.flatMap((p, i) => (counts[i] ? [{ kind: p.kind, size: p.size, ff: p.ff, qty: counts[i] }] : []));
  const line: CartLine = { model: model.id, brand, qty, ...(s ? { vendor } : {}), ...(part ? { part } : {}), ...(bare ? { bare } : {}), ...(extras.length ? { extras } : {}) };
  const built = lineParts(line), custom = bare || extras.length > 0;
  const cards = built.filter((p) => p.kind === "gpu");
  const sum = (kind: string) => built.filter((p) => p.kind === kind).reduce((n, p) => n + (p.size ?? 0), 0);
  const drives = built.filter((p) => ["hdd", "ssd", "nvme"].includes(p.kind));
  const rows: [string, string][] = spec ? [...(part!.size !== undefined && part!.kind !== "gpu" ? [["Size", partSize(part!)]] as [string, string][] : []), ["Life", `${spec.life} years`], ["Swap while running", SWAP[spec.hotSwap]], ...(part!.kind === "gpu" ? [["Power", `${cardOf(part!.size).watts} W`]] as [string, string][] : [])] : [
    ["Height", height(model)],
    ...(!part && model.price > 0 ? [["Release", releaseLabel(brandFrom(model, brand))]] as [string, string][] : []),
    ...(model.until !== null ? [["End of sale", `${brandUntil(model, brand)}`]] as [string, string][] : []),
    ...(model.throughputGbit ? [["Throughput", speed(model.throughputGbit)]] as [string, string][] : []),
    ...(s ? [["CPU", VENDOR_NAME[vendor]], ["Cores", cores(sum("cpu"))], ["RAM", ram(custom ? sum("ram") : s.ramGb)],
      ...(cards.length ? [["GPUs", `${cards.length} × ${cardOf(cards[0].size).name}`]] as [string, string][] : []),
      ["Storage", custom ? (drives.length ? `${disk(drives.reduce((n, p) => n + (p.size ?? 0), 0))} in ${drives.length} ${drives.length === 1 ? "drive" : "drives"}` : "None") : `${disk(s.diskGb)} ${s.disk}`]] as [string, string][] : []),
    ...(model.kind === "gateway" && model.price > 0 ? [["Routing", model.fullTable ? "Full table" : "Default route"], ...(model.fullTable ? [["BGP sessions", `${model.bgpSessions}`]] : [])] as [string, string][] : []),
    ...(node?.server ? [["Nodes", `${model.nodes!.count}`], ["Cores per node", cores(nodeCores)], ["RAM per node", ram(node.server.ramGb)], ["Storage per node", `${disk(node.server.diskGb)} ${node.server.disk}`],
      ["NICs per node", portsText(node)], ["PSUs", `${model.psus}`], ["Power", `${Math.round(wattsFactorOf(node, brand) * node.watts * model.nodes!.count)} W`]] as [string, string][] : []),
    ...(model.batteryWh ? [["Battery", `${model.batteryWh} Wh`]] as [string, string][] : model.outlets ? [["Outlets", `${model.outlets}`]] as [string, string][] : node ? [] : [[model.kind === "patch" ? "Jacks" : model.kind === "server" ? "NICs" : "Ports", portsText(model)]] as [string, string][]),
    ...(model.watts ? [...(model.kind === "pdu" || ["kvm", "console", "oob"].includes(model.kind) ? [] : [["PSUs", `${model.psus}`]]), ["Power", `${Math.round(wattsFactorOf(model, brand) * (model.watts + cpuWattsShift(model, built)) + cardWatts(cards.map((p) => ({ ...p, failedAt: null }))))} W`]] as [string, string][] : []),
  ];
  const reset = () => { setQty(1); setCounts({}); setBare(false); setOpen(false); };
  return (
    <div className="shop-card">
      <div className="shop-pic">
        <Isometric model={model} brand={brand} w={170} />
        {s && <button className="btn icon shop-customize" aria-label="Customize" aria-pressed={open} title="Customize" onClick={() => setOpen(!open)}><SlidersHorizontal /></button>}
      </div>
      <div className="shop-name">
        <strong>{part ? partLabel(part) : model.name}</strong>
        <span className="shop-maker"><BrandLogo brand={brand} size={14} />{brand}<span className="pill">{cls}</span></span>
      </div>
      {makers.length > 1 && (
        <div className="seg shop-vendor" role="group" aria-label="CPU vendor">
          {makers.map((v) => <button key={v} aria-pressed={vendor === v} onClick={() => { setVendor(v); setCounts({}); }}>{VENDOR_NAME[v]}</button>)}
        </div>
      )}
      <dl className="shop-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      {s && open && <Build model={model} brand={brand} vendor={vendor} qty={qty} bare={bare} setBare={setBare} counts={counts} setCounts={setCounts} />}
      <div className="shop-buy">
        <strong className="num">{euro(unitPrice(line, year) * qty)}</strong>
        <span className="grow" />
        <Stepper value={qty} onChange={setQty} min={1} />
        <button className="btn primary" onClick={() => { addToCart(line); reset(); }}><ShoppingCart />Add to cart</button>
      </div>
    </div>
  );
}
