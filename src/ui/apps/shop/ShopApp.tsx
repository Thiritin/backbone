import { Cable, HardDrive, Network, Server, Shield, ShoppingCart, Store } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { brandsFor, COMPONENTS, MANUFACTURERS, priceOf, shopModels, type ComponentKind, type DeviceModel } from "../../../sim/10-catalog/hardware";
import { Cart, Stepper } from "./Cart";
import { lineOf } from "../../art/fronts";
import { Isometric } from "../../art/Isometric";
import { BrandLogo } from "../../art/logos";
import { useStore } from "../../store";
import { cores, disk, height, portsText, ram, speed } from "../hw";
import "./shop.css";

const LINE_NAME: Record<string, string> = {
  compute: "Balanced", "compute-2psu": "Balanced", dense: "Compute dense", memory: "Memory optimized",
  storage: "Storage", backup: "Backup", archive: "Archive", gpu: "GPU", arm: "ARM",
};
const CLASSES: [string, typeof Server][] = [
  ...[...new Set(Object.values(LINE_NAME))].map((c): [string, typeof Server] => [c, Server]),
  ["Layer 2", Network], ["Layer 3", Network], ["Security", Shield], ["Patch panels", Cable], ["Parts", HardDrive],
];
const classOf = (m: DeviceModel) =>
  m.kind === "server" ? LINE_NAME[lineOf(m)!] : m.kind === "switch" ? `Layer ${m.layer ?? 2}` : m.kind === "firewall" ? "Security" : m.kind === "part" ? "Parts" : "Patch panels";

const SWAP = { raid: "In RAID", dual: "With two", yes: "Yes", no: "No" };

interface Item { model: DeviceModel; brand: string; cls: string }

// Every model comes from each manufacturer that builds its kind.
const items = (year: number): Item[] =>
  shopModels(year).flatMap((model) => brandsFor(model.kind).map((brand) => ({ model, brand, cls: classOf(model) })));

export function ShopApp() {
  const hour = useStore((s) => s.game.hour);
  const [maker, setMaker] = useState<string | null>(null);
  const [cls, setCls] = useState<string | null>(null);
  const all = items(yearOf(hour));
  const shown = all.filter((it) => (!maker || it.brand === maker) && (!cls || it.cls === cls));
  const count = (f: (it: Item) => boolean) => all.filter(f).length;
  const [cartOpen, setCartOpen] = useState(false);
  const inCart = useStore((st) => st.cart.reduce((n, l) => n + l.qty, 0));

  return (
    <div className="shop">
      <aside className="sidebar shop-side">
        <div className="side-h">Manufacturer</div>
        <button className={`side-item${!maker ? " active" : ""}`} aria-pressed={!maker} onClick={() => setMaker(null)}><Store />All<span className="side-count">{count((it) => !cls || it.cls === cls)}</span></button>
        {MANUFACTURERS.map(({ name }) => (
          <button key={name} className={`side-item${maker === name ? " active" : ""}`} aria-pressed={maker === name} onClick={() => setMaker(name)}>
            <BrandLogo brand={name} size={16} />{name}<span className="side-count">{count((it) => it.brand === name && (!cls || it.cls === cls))}</span>
          </button>
        ))}
        <div className="side-h">Class</div>
        {CLASSES.filter(([c]) => all.some((it) => it.cls === c)).map(([c, Icon]) => (
          <button key={c} className={`side-item${cls === c ? " active" : ""}`} aria-pressed={cls === c} onClick={() => setCls(cls === c ? null : c)}>
            <Icon />{c}<span className="side-count">{count((it) => it.cls === c && (!maker || it.brand === maker))}</span>
          </button>
        ))}
      </aside>
      <div className="shop-main">
        <div className="shop-bar">
          <span className="grow" />
          <button className="btn ghost" aria-pressed={cartOpen} onClick={() => setCartOpen(!cartOpen)}><ShoppingCart />Cart<span className="num shop-count">{inCart}</span></button>
        </div>
        <div className="shop-body">
          <div className="shop-grid">
            {shown.map((it) => <Card key={`${it.model.id}|${it.brand}`} {...it} />)}
            {!shown.length && <div className="shop-none">No models</div>}
          </div>
          {cartOpen && <Cart />}
        </div>
      </div>
    </div>
  );
}

function Card({ model, brand, cls }: Item) {
  const addToCart = useStore((s) => s.addToCart);
  const [qty, setQty] = useState(1);
  const s = model.server;
  const part = model.kind === "part" ? COMPONENTS[model.id.replace(/^part-/, "") as ComponentKind] : null;
  const rows: [string, string][] = part ? [["Life", `${part.life} years`], ["Swap while running", SWAP[part.hotSwap]]] : [
    ["Height", height(model)],
    ...(model.throughputGbit ? [["Throughput", speed(model.throughputGbit)]] as [string, string][] : []),
    ...(s ? [["Cores", cores(s.cores)], ["RAM", ram(s.ramGb)], ["Storage", `${disk(s.diskGb)} ${s.disk}`]] as [string, string][] : []),
    [model.kind === "patch" ? "Jacks" : model.kind === "server" ? "NICs" : "Ports", portsText(model)],
    ...(model.watts ? [["PSUs", `${model.psus}`], ["Power", `${model.watts} W`]] as [string, string][] : []),
  ];
  return (
    <div className="shop-card">
      <div className="shop-pic"><Isometric model={model} brand={brand} w={170} /></div>
      <div className="shop-name">
        <strong>{model.name}</strong>
        <span className="shop-maker"><BrandLogo brand={brand} size={14} />{brand}<span className="pill">{cls}</span></span>
      </div>
      <dl className="shop-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      <div className="shop-buy">
        <strong className="num">{euro(priceOf(model, brand) * qty)}</strong>
        <span className="grow" />
        <Stepper value={qty} onChange={setQty} min={1} />
        <button className="btn primary" onClick={() => { addToCart({ model: model.id, brand, qty }); setQty(1); }}><ShoppingCart />Add to cart</button>
      </div>
    </div>
  );
}
