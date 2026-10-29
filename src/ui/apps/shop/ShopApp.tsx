import { AppWindow, BatteryCharging, Cable, HardDrive, Network, Router, Server, Shield, ShoppingCart, SlidersHorizontal, Store } from "lucide-react";
import { useState } from "react";
import { useSessionState } from "../../session";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { cardOf, cardWatts } from "../../../sim/10-catalog/gpu";
import { brandsOf, COMPONENTS, fits, MANUFACTURERS, modelById, partOffers, shopModels, type DeviceModel, type PartSpec } from "../../../sim/10-catalog/hardware";
import { partPrice } from "../../../sim/10-catalog/parts";
import { lineParts, unitPrice, type CartLine } from "../../../sim/90-actions/hardware";
import { Cart, Stepper } from "./Cart";
import { Software } from "./Software";
import { ShopFilter, useFilter } from "./FilterBar";
import { matchesFilter } from "./filter";
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
  ["Layer 2", Network], ["Layer 3", Network], ["Routers", Router], ["Security", Shield], ["Patch panels", Cable], ["Power", BatteryCharging], ["Parts", HardDrive],
];
const classOf = (m: DeviceModel) =>
  m.kind === "server" ? LINE_NAME[lineOf(m)!] : m.kind === "switch" ? `Layer ${m.layer ?? 2}` : m.kind === "firewall" ? "Security" : m.kind === "gateway" ? "Routers" : m.kind === "ups" || m.kind === "pdu" ? "Power" : "Patch panels";

const SWAP = { raid: "In RAID", dual: "With two", yes: "Yes", no: "No" };

// A device model from a manufacturer, or a sized part from the Parts tab.
interface Item { model: DeviceModel; brand: string; cls: string; part?: PartSpec }

// Every model comes from each manufacturer that builds its kind; parts are sold sized.
const items = (year: number): Item[] => [
  ...shopModels(year).filter((m) => m.kind !== "part").flatMap((model) => brandsOf(model).map((brand) => ({ model, brand, cls: classOf(model) }))),
  ...partOffers(year).map((part) => ({ model: modelById(`part-${part.kind}`), brand: "Generic", cls: "Parts", part })),
];
const itemKey = (it: Item) => `${it.model.id}|${it.brand}|${it.part?.size ?? ""}|${it.part?.ff ?? ""}`;

export function ShopApp() {
  const hour = useStore((s) => s.game.hour);
  const [maker, setMaker] = useSessionState<string | null>("shop.maker", null);
  const [cls, setCls] = useSessionState<string | null>("shop.cls", null);
  const [software, setSoftware] = useSessionState("shop.software", false);
  const pick = (m: string | null, c: string | null) => { setMaker(m); setCls(c); setSoftware(false); };
  useFocus("Shop", (f) => { if (f.kind === "software") { pick(null, null); setSoftware(true); } });
  const all = items(yearOf(hour));
  const [filter, setFilter, clearFilter] = useFilter();
  const serverCls = !!cls && Object.values(LINE_NAME).includes(cls);
  const scoped = all.filter((it) => (!maker || it.brand === maker) && (!cls || it.cls === cls));
  const shown = serverCls ? scoped.filter((it) => matchesFilter(it.model, filter)) : scoped;
  const count = (f: (it: Item) => boolean) => all.filter(f).length;
  const [cartOpen, setCartOpen] = useState(false);
  const inCart = useStore((st) => st.cart.reduce((n, l) => n + l.qty, 0));

  return (
    <div className="shop">
      <aside className="sidebar shop-side">
        <div className="side-h">Manufacturer</div>
        <button className={`side-item${!maker && !software ? " active" : ""}`} aria-pressed={!maker && !software} onClick={() => pick(null, cls)}><Store />All<span className="side-count">{count((it) => !cls || it.cls === cls)}</span></button>
        <button className={`side-item${software ? " active" : ""}`} aria-pressed={software} onClick={() => { pick(null, null); setSoftware(true); }}><AppWindow />Software</button>
        {MANUFACTURERS.map(({ name }) => (
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
        {serverCls && !software && <ShopFilter models={scoped.map((it) => it.model)} filter={filter} set={setFilter} clear={clearFilter} />}
        <div className="shop-body">
          {software ? <Software /> : (
            <div className="shop-grid">
              {shown.map((it) => <Card key={itemKey(it)} {...it} />)}
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
function Build({ model, brand, qty, bare, setBare, counts, setCounts }: {
  model: DeviceModel; brand: string; qty: number; bare: boolean; setBare: (b: boolean) => void; counts: Record<number, number>; setCounts: (c: Record<number, number>) => void;
}) {
  const year = yearOf(useStore((s) => s.game.hour));
  const offers = partOffers(year).filter((p) => BUILD_KINDS.includes(p.kind) && !fits(model, [p]));
  const lineWith = (c: Record<number, number>): CartLine => ({
    model: model.id, brand, qty, bare, extras: offers.flatMap((p, i) => (c[i] ? [{ kind: p.kind, size: p.size, ff: p.ff, qty: c[i] }] : [])),
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
          <span className="num shop-muted">{euro(partPrice(p.kind, p.size, p.ff, year))}</span>
          <Stepper value={counts[i] ?? 0} onChange={(n) => set(i, n)} max={fits(model, lineParts(lineWith({ ...counts, [i]: (counts[i] ?? 0) + 1 }))) ? counts[i] ?? 0 : undefined} label={`${partLabel(p)} quantity`} />
        </div>
      ))}
    </div>
  );
}

function Card({ model, brand, cls, part }: Item) {
  const addToCart = useStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);
  const [open, setOpen] = useState(false), [bare, setBare] = useState(false), [counts, setCounts] = useState<Record<number, number>>({});
  const year = yearOf(useStore((s) => s.game.hour));
  const s = model.server;
  const spec = part ? COMPONENTS[part.kind] : null;
  // The line as configured: the preset or the bare chassis, with the extras ticked in the build panel.
  const offers = s ? partOffers(year).filter((p) => BUILD_KINDS.includes(p.kind) && !fits(model, [p])) : [];
  const extras = offers.flatMap((p, i) => (counts[i] ? [{ kind: p.kind, size: p.size, ff: p.ff, qty: counts[i] }] : []));
  const line: CartLine = { model: model.id, brand, qty, ...(part ? { part } : {}), ...(bare ? { bare } : {}), ...(extras.length ? { extras } : {}) };
  const built = lineParts(line), custom = bare || extras.length > 0;
  const cards = built.filter((p) => p.kind === "gpu");
  const sum = (kind: string) => built.filter((p) => p.kind === kind).reduce((n, p) => n + (p.size ?? 0), 0);
  const drives = built.filter((p) => ["hdd", "ssd", "nvme"].includes(p.kind));
  const rows: [string, string][] = spec ? [...(part!.size !== undefined && part!.kind !== "gpu" ? [["Size", partSize(part!)]] as [string, string][] : []), ["Life", `${spec.life} years`], ["Swap while running", SWAP[spec.hotSwap]], ...(part!.kind === "gpu" ? [["Power", `${cardOf(part!.size).watts} W`]] as [string, string][] : [])] : [
    ["Height", height(model)],
    ...(model.until !== null ? [["End of sale", `${model.until}`]] as [string, string][] : []),
    ...(model.throughputGbit ? [["Throughput", speed(model.throughputGbit)]] as [string, string][] : []),
    ...(s ? [["Cores", cores(custom ? sum("cpu") : s.cores)], ["RAM", ram(custom ? sum("ram") : s.ramGb)],
      ...(cards.length ? [["GPUs", `${cards.length} × ${cardOf(cards[0].size).name}`]] as [string, string][] : []),
      ["Storage", custom ? (drives.length ? `${disk(drives.reduce((n, p) => n + (p.size ?? 0), 0))} in ${drives.length} ${drives.length === 1 ? "drive" : "drives"}` : "None") : `${disk(s.diskGb)} ${s.disk}`]] as [string, string][] : []),
    ...(model.kind === "gateway" && model.price > 0 ? [["Routing", model.fullTable ? "Full table" : "Default route"], ...(model.fullTable ? [["BGP sessions", `${model.bgpSessions}`]] : [])] as [string, string][] : []),
    ...(model.batteryWh ? [["Battery", `${model.batteryWh} Wh`]] as [string, string][] : model.outlets ? [["Outlets", `${model.outlets}`]] as [string, string][] : [[model.kind === "patch" ? "Jacks" : model.kind === "server" ? "NICs" : "Ports", portsText(model)]] as [string, string][]),
    ...(model.watts ? [...(model.kind === "pdu" ? [] : [["PSUs", `${model.psus}`]]), ["Power", `${model.watts + cardWatts(cards.map((p) => ({ ...p, failedAt: null })))} W`]] as [string, string][] : []),
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
      <dl className="shop-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      {s && open && <Build model={model} brand={brand} qty={qty} bare={bare} setBare={setBare} counts={counts} setCounts={setCounts} />}
      <div className="shop-buy">
        <strong className="num">{euro(unitPrice(line, year) * qty)}</strong>
        <span className="grow" />
        <Stepper value={qty} onChange={setQty} min={1} />
        <button className="btn primary" onClick={() => { addToCart(line); reset(); }}><ShoppingCart />Add to cart</button>
      </div>
    </div>
  );
}
