import { CircleDollarSign, Truck } from "lucide-react";
import { useState } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState, Location } from "../../../sim/50-state";
import { euro } from "../../../sim/00-core/money";
import { storageStacks, travelCost } from "../../../sim/60-infra/status";
import { sellDevice, shipStock } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { useStore } from "../../store";
import { day, height } from "../hw";
import { Stepper } from "../shop/Cart";
import { SellConfirm } from "./Inspector";
import { LocName, Zone } from "./ui";

type Stack = ReturnType<typeof storageStacks>[number];

// Ships the first n units of a stack to another zone.
function Ship({ game, ids, onDone }: { game: GameState; ids: string[]; onDone: () => void }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const from = game.devices.find((d) => d.id === ids[0])!.store!;
  const targets = game.locations.filter((l) => l.id !== from);
  const [to, setTo] = useState(targets[0].id), [n, setN] = useState(ids.length);
  const dest = targets.find((l) => l.id === to)!, trip = travelCost(game, from, to);
  const ship = () => {
    if (!act((s) => shipStock(s, ids.slice(0, n), to)).ok) return;
    notify("Locations", `Shipping to ${dest.az}`, `${n} ${n === 1 ? "unit" : "units"}`);
    onDone();
  };
  return (
    <div className="loc-row loc-ship">
      <Stepper value={Math.min(n, ids.length)} min={1} onChange={(v) => setN(Math.min(v, ids.length))} />
      <select aria-label="Zone" value={to} onChange={(e) => setTo(e.target.value)}>
        {targets.map((l) => <option key={l.id} value={l.id}>{l.name} · {l.az}</option>)}
      </select>
      <span className="grow" />
      <span className="num">{euro(trip.price)}</span>
      <span className="num loc-muted">Arrives {day(game.hour + trip.hours)}</span>
      <button className="btn primary" onClick={ship}>Ship</button>
    </div>
  );
}

// Units stored in one zone, grouped by model; they are mounted from the rack view.
export function Storage({ game, loc }: { game: GameState; loc: Location }) {
  const stacks = storageStacks(game, loc.id);
  const transit = new Map<string, Device[]>();
  for (const d of game.devices.filter((x) => x.transitTo)) {
    const k = `${d.model}|${d.brand}|${d.transitTo}|${d.arriveAt}`;
    transit.set(k, [...(transit.get(k) ?? []), d]);
  }
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>Storage</h3><Zone loc={loc} /><span className="grow" /><span className="num loc-muted">{stacks.reduce((n, s) => n + s.ids.length, 0)}</span></div>
      {stacks.length ? stacks.map((s) => <StackRow key={`${s.model}|${s.brand}`} game={game} stack={s} />) : <div className="loc-row loc-muted">Empty</div>}
      {transit.size > 0 && <div className="loc-card-h loc-sub"><h3><Truck />In transit</h3></div>}
      {[...transit].map(([k, ds]) => {
        const m = modelById(ds[0].model), to = game.locations.find((l) => l.id === ds[0].transitTo)!;
        return (
          <div key={k} className="loc-row loc-transit">
            <span className="num">{ds.length} ×</span><span>{ds[0].brand} {m.name}</span><span className="grow" />
            <LocName loc={to} /><span className="num loc-muted">{day(ds[0].arriveAt!)}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackRow({ game, stack }: { game: GameState; stack: Stack }) {
  const act = useStore((s) => s.act);
  const [selling, setSelling] = useState(false);
  const [shipping, setShipping] = useState(false);
  // Leased units can't be sold, so Sell takes the first paid-off unit of the stack.
  const m = modelById(stack.model), units = game.devices.filter((d) => stack.ids.includes(d.id)), first = units.find((d) => !d.lease) ?? units[0];
  return (
    <div className="loc-stack">
      <div className="loc-stack-main">
        <Isometric model={m} brand={stack.brand} w={96} count={stack.ids.length} />
        <div className="loc-stack-name">
          <strong>{stack.brand} {m.name}</strong>
          <span className="num loc-muted">{height(m)} · {stack.ids.length} in storage</span>
        </div>
        <span className="grow" />
        <button className="btn" aria-expanded={shipping} disabled={game.locations.length < 2} onClick={() => setShipping(!shipping)}><Truck />Ship to…</button>
        <button className="btn" disabled={!!first.lease} onClick={() => setSelling(true)}><CircleDollarSign />Sell</button>
      </div>
      {shipping && <Ship game={game} ids={stack.ids} onDone={() => setShipping(false)} />}
      {selling && (
        <SellConfirm game={game} name={first.name} price={first.price} boughtAt={first.boughtAt}
          onCancel={() => setSelling(false)}
          onSell={() => { setSelling(false); act((s) => sellDevice(s, first.id)); }} />
      )}
    </div>
  );
}
