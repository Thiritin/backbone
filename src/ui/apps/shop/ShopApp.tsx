import { Cable, Minus, Network, Plus, Server, ShoppingCart, Store } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { SERVER_BRANDS, shopModels, SWITCH_BRAND, type DeviceKind, type DeviceModel } from "../../../sim/10-catalog/hardware";
import { buyDevice } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { useStore } from "../../store";
import { cores, disk, height, portsText, ram } from "../hw";
import "./shop.css";

const PATCH = "Patch panels";
const MAKERS = [...SERVER_BRANDS, SWITCH_BRAND, PATCH];
const KINDS: [DeviceKind, string, typeof Server][] = [["server", "Servers", Server], ["switch", "Switches", Network], ["patch", "Patch panels", Cable]];

interface Item { model: DeviceModel; brand: string; maker: string }

// Servers come from every brand; switches are Sysko and patch panels have no maker of their own.
function items(year: number): Item[] {
  return shopModels(year).flatMap((model) => {
    if (model.kind === "server") return SERVER_BRANDS.map((brand) => ({ model, brand, maker: brand }));
    return [{ model, brand: SWITCH_BRAND, maker: model.kind === "patch" ? PATCH : SWITCH_BRAND }];
  });
}

export function ShopApp() {
  const hour = useStore((s) => s.game.hour);
  const [maker, setMaker] = useState<string | null>(null);
  const [kind, setKind] = useState<DeviceKind | null>(null);
  const all = items(yearOf(hour));
  const shown = all.filter((it) => (!maker || it.maker === maker) && (!kind || it.model.kind === kind));
  const count = (f: (it: Item) => boolean) => all.filter(f).length;

  return (
    <div className="shop">
      <aside className="sidebar shop-side">
        <div className="side-h">Manufacturer</div>
        <button className={`side-item${!maker ? " active" : ""}`} aria-pressed={!maker} onClick={() => setMaker(null)}><Store />All<span className="side-count">{count((it) => !kind || it.model.kind === kind)}</span></button>
        {MAKERS.map((m) => (
          <button key={m} className={`side-item${maker === m ? " active" : ""}`} aria-pressed={maker === m} onClick={() => setMaker(m)}>{m}<span className="side-count">{count((it) => it.maker === m && (!kind || it.model.kind === kind))}</span></button>
        ))}
        <div className="side-h">Kind</div>
        {KINDS.map(([k, label, Icon]) => (
          <button key={k} className={`side-item${kind === k ? " active" : ""}`} aria-pressed={kind === k} onClick={() => setKind(kind === k ? null : k)}><Icon />{label}<span className="side-count">{count((it) => it.model.kind === k && (!maker || it.maker === maker))}</span></button>
        ))}
      </aside>
      <div className="shop-grid">
        {shown.map((it) => <Card key={`${it.model.id}|${it.brand}`} {...it} />)}
        {!shown.length && <div className="shop-none">No models</div>}
      </div>
    </div>
  );
}

function Card({ model, brand, maker }: Item) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const [qty, setQty] = useState(1);
  const s = model.server;
  const rows: [string, string][] = [
    ["Height", height(model)],
    ...(s ? [["Cores", cores(s.cores)], ["RAM", ram(s.ramGb)], ["Storage", `${disk(s.diskGb)} ${s.disk}`]] as [string, string][] : []),
    [model.kind === "patch" ? "Jacks" : model.kind === "server" ? "NICs" : "Ports", portsText(model)],
    ...(model.watts ? [["PSUs", `${model.psus}`], ["Power", `${model.watts} W`]] as [string, string][] : []),
  ];
  const buy = () => {
    if (act((g) => buyDevice(g, model.id, brand, qty)).ok) notify("Shop", "Added to storage", `${qty} × ${model.kind === "server" ? `${brand} ` : ""}${model.name}`);
  };
  return (
    <div className="shop-card">
      <div className="shop-pic"><Isometric model={model} brand={brand} w={170} /></div>
      <div className="shop-name">
        <strong>{model.name}</strong>
        <span>{maker === PATCH ? "Patch panel" : brand}</span>
      </div>
      <dl className="shop-specs">
        {rows.map(([k, v]) => <div key={k}><dt>{k}</dt><dd className="num">{v}</dd></div>)}
      </dl>
      <div className="shop-buy">
        <strong className="num">{euro(model.price * qty)}</strong>
        <span className="grow" />
        <div className="shop-qty" role="group" aria-label="Quantity">
          <button className="btn icon" aria-label="Fewer" disabled={qty <= 1} onClick={() => setQty(qty - 1)}><Minus /></button>
          <span className="num">{qty}</span>
          <button className="btn icon" aria-label="More" onClick={() => setQty(qty + 1)}><Plus /></button>
        </div>
        <button className="btn primary" onClick={buy}><ShoppingCart />Buy</button>
      </div>
    </div>
  );
}
