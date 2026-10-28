import { ArrowDownToLine, CircleDollarSign, Truck } from "lucide-react";
import { useState } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { Device, GameState, Location } from "../../../sim/50-state";
import { euro } from "../../../sim/00-core/money";
import { freeSlots, mountFrom, mountMax, storageStacks, travelCost } from "../../../sim/60-infra/status";
import { mountDevice, mountStack, sellDevice, shipStock } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { RackFront } from "../../art/RackFront";
import { useStore } from "../../store";
import { day, height } from "../hw";
import { Stepper } from "../shop/Cart";
import { SellConfirm } from "./Inspector";
import { rackUnits } from "./Floor";
import { rackItems } from "./RackView";
import { LocName, Sheet, Zone } from "./ui";

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
      <div className="seg wrap" role="group" aria-label="Zone">
        {targets.map((l) => <button key={l.id} className="num" title={l.name} aria-pressed={l.id === to} onClick={() => setTo(l.id)}>{l.az}</button>)}
      </div>
      <span className="grow" />
      <span className="num">{euro(trip.price)}</span>
      <span className="num loc-muted">Arrives {day(game.hour + trip.hours)}</span>
      <button className="btn primary" onClick={ship}>Ship</button>
    </div>
  );
}

type Mounted = (rackId: string, deviceId: string) => void;

// Picks a rack of the zone, then a free slot on its front; a stack covers the clicked unit, its top there where it fits.
function MountSheet({ game, stack, onClose, onMounted }: { game: GameState; stack: Stack; onClose: () => void; onMounted?: Mounted }) {
  const act = useStore((s) => s.act);
  const m = modelById(stack.model), zone = game.devices.find((d) => d.id === stack.ids[0])!.store!;
  const racks = game.racks.filter((r) => r.locationId === zone && r.arriveAt === null);
  const fits = (id: string) => freeSlots(game, id, m.height).length > 0;
  const [picked, setPicked] = useState(racks.find((r) => fits(r.id))?.id ?? racks[0]?.id);
  const [count, setCount] = useState(1);
  const rack = racks.find((r) => r.id === picked);
  const n = Math.min(count, stack.ids.length);
  const mount = (unit: number) => {
    if (!rack) return;
    const k = mountMax(game, rack.id, m.height, n, unit), from = mountFrom(game, rack.id, m.height, k, unit), id = stack.ids[0];
    if (from === undefined || !act((s) => (k === 1 ? mountDevice(s, id, rack.id, from) : mountStack(s, stack.model, stack.brand, rack.id, k, from))).ok) return;
    onClose();
    onMounted?.(rack.id, id);
  };
  return (
    <Sheet title={`Mount ${stack.brand} ${m.name}`} onClose={onClose}>
      <div className="loc-mount">
        <div className="picks" role="group" aria-label="Rack">
          {racks.map((r) => {
            const used = game.devices.filter((d) => d.rackId === r.id).reduce((u, d) => u + modelById(d.model).height, 0);
            return (
              <button key={r.id} className="pick" aria-pressed={r.id === picked} disabled={!fits(r.id)} onClick={() => setPicked(r.id)}>
                <strong>{r.name}</strong><span className="sub num">{rackUnits(r) - used} U free</span>
              </button>
            );
          })}
        </div>
        {!racks.length && <div className="loc-row loc-muted">No rack in this zone</div>}
        {rack && (
          <div className="loc-mount-rack">
            <RackFront units={rackUnits(rack)} items={rackItems(game, rack.id)} w={340} u={18} onDevice={() => {}} onFree={(unit) => mount(unit)} />
          </div>
        )}
      </div>
      {stack.ids.length > 1 && (
        <div className="loc-sheet-foot">
          <span className="loc-k">Units</span>
          <Stepper value={n} min={1} onChange={(v) => setCount(Math.min(v, stack.ids.length))} />
        </div>
      )}
    </Sheet>
  );
}

// Units stored in one zone, grouped by model.
export function Storage({ game, loc, onMounted }: { game: GameState; loc: Location; onMounted?: Mounted }) {
  const stacks = storageStacks(game, loc.id);
  const transit = new Map<string, Device[]>();
  for (const d of game.devices.filter((x) => x.transitTo)) {
    const k = `${d.model}|${d.brand}|${d.transitTo}|${d.arriveAt}`;
    transit.set(k, [...(transit.get(k) ?? []), d]);
  }
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>Storage</h3><Zone loc={loc} /><span className="grow" /><span className="num loc-muted">{stacks.reduce((n, s) => n + s.ids.length, 0)}</span></div>
      {stacks.length ? stacks.map((s) => <StackRow key={`${s.model}|${s.brand}`} game={game} stack={s} onMounted={onMounted} />) : <div className="loc-row loc-muted">Empty</div>}
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

function StackRow({ game, stack, onMounted }: { game: GameState; stack: Stack; onMounted?: Mounted }) {
  const act = useStore((s) => s.act);
  const [mounting, setMounting] = useState(false);
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
        {m.height > 0 && <button className="btn" onClick={() => setMounting(true)}><ArrowDownToLine />Mount</button>}
        <button className="btn" aria-expanded={shipping} disabled={game.locations.length < 2} onClick={() => setShipping(!shipping)}><Truck />Ship to…</button>
        <button className="btn" disabled={!!first.lease} onClick={() => setSelling(true)}><CircleDollarSign />Sell</button>
      </div>
      {mounting && <MountSheet game={game} stack={stack} onClose={() => setMounting(false)} onMounted={onMounted} />}
      {shipping && <Ship game={game} ids={stack.ids} onDone={() => setShipping(false)} />}
      {selling && (
        <SellConfirm game={game} name={first.name} price={first.price} boughtAt={first.boughtAt}
          onCancel={() => setSelling(false)}
          onSell={() => { setSelling(false); act((s) => sellDevice(s, first.id)); }} />
      )}
    </div>
  );
}
