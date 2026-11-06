import { ArrowDownToLine, Router, Truck } from "lucide-react";
import { useRef, useState, type ReactNode } from "react";
import { isOfficeRouter, modelById, modelName } from "../../../sim/10-catalog/hardware";
import type { Device, GameState, Location } from "../../../sim/50-state";
import { euro } from "../../../sim/00-core/money";
import { deviceValue, freeSlots, heightIn, mountFrom, mountMax, parcelCost, storageStacks } from "../../../sim/60-infra/status";
import { sellDevice, shipStock } from "../../../sim/90-actions/hardware";
import { installRouter } from "../../../sim/90-actions/routers";
import { mountedRouter } from "../../../sim/60-infra/routers";
import { present } from "../../../sim/60-infra/handwork";
import { drive } from "../../../sim/90-actions/travel";
import { Isometric } from "../../art/Isometric";
import { RackFront } from "../../art/RackFront";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { day, height } from "../hw";
import { Stepper } from "../shop/Cart";
import { SellConfirm } from "./Inspector";
import { ListForSale } from "../shop/Used";
import { menuOn, type MenuEntry } from "../../desktop/ContextMenu";
import { More } from "../More";
import { rackUnits } from "./Floor";
import { mountTask, rackItems } from "./RackView";
import { useHandWork, type HandTask } from "./HandSheet";
import { LocName, Sheet, Zone } from "./ui";

type Stack = ReturnType<typeof storageStacks>[number];

// Ships the first n units of a stack to another zone.
function Ship({ game, ids, onDone }: { game: GameState; ids: string[]; onDone: () => void }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const from = game.devices.find((d) => d.id === ids[0])!.store!;
  const targets = game.locations.filter((l) => l.id !== from);
  const [to, setTo] = useState(targets[0].id), [n, setN] = useState(ids.length);
  const count = Math.min(n, ids.length), dest = targets.find((l) => l.id === to)!, trip = parcelCost(game, from, to, count);
  const fare = present(game, from) && game.player.until <= game.hour ? drive(game, to) : null;
  const ship = (self = false) => {
    if (!act(shipStock, ids.slice(0, count), to, self).ok) return;
    notify("Locations", t("locations-2.shippingTo", { az: dest.az }), t("locations-2.nUnits", { n }));
    onDone();
  };
  return (
    <div className="loc-row loc-ship">
      <Stepper value={count} min={1} onChange={(v) => setN(Math.min(v, ids.length))} />
      <div className="seg wrap" role="group" aria-label={t("locations-2.zone")}>
        {targets.map((l) => <button key={l.id} className="num" title={l.name} aria-pressed={l.id === to} onClick={() => setTo(l.id)}>{l.az}</button>)}
      </div>
      <span className="grow" />
      <span className="num">{euro(trip.price)}</span>
      <span className="num loc-muted">{t("locations-2.arrives", { day: day(game.hour + trip.hours) })}</span>
      {fare && <button className="btn" onClick={() => ship(true)}>{t("locations-1.driveYourself", { hours: fare.hours, fee: euro(fare.fee) })}</button>}
      <button className="btn primary" onClick={() => ship()}>{t("locations-2.ship")}</button>
    </div>
  );
}

// Sells the first n paid-off units of a stack.
function SellMany({ game, units, onDone }: { game: GameState; units: Device[]; onDone: () => void }) {
  const act = useStore((s) => s.act);
  const [n, setN] = useState(units.length);
  const pick = units.slice(0, n), value = pick.reduce((v, d) => v + deviceValue(game, d), 0);
  const sell = () => { for (const d of pick) act(sellDevice, d.id); onDone(); };
  return (
    <div className="loc-row loc-ship">
      <Stepper value={n} min={1} onChange={(v) => setN(Math.min(v, units.length))} />
      <span className="grow" />
      <button className="btn" onClick={onDone}>{t("locations-1.cancel")}</button>
      <button className="btn primary" onClick={sell}>{t("locations-1.sellFor", { value: euro(value) })}</button>
    </div>
  );
}

type Mounted = (rackId: string, deviceId: string) => void;

// Picks a rack of the zone, then a free slot on its front; a stack covers the clicked unit, its top there where it fits.
function MountSheet({ game, stack, onClose, onMount, onMounted }: { game: GameState; stack: Stack; onClose: () => void; onMount: (task: HandTask) => void; onMounted?: Mounted }) {
  const m = modelById(stack.model), zone = game.devices.find((d) => d.id === stack.ids[0])!.store!;
  const racks = game.racks.filter((r) => r.locationId === zone && r.arriveAt === null);
  const fits = (id: string) => freeSlots(game, id, Math.max(1, heightIn(game, id, m.id))).length > 0;
  const [picked, setPicked] = useState(racks.find((r) => fits(r.id))?.id ?? racks[0]?.id);
  const [count, setCount] = useState(1);
  const rack = racks.find((r) => r.id === picked);
  const n = Math.min(count, stack.ids.length);
  const mount = (unit: number) => {
    if (!rack) return;
    const h = Math.max(1, heightIn(game, rack.id, m.id)), k = mountMax(game, rack.id, h, n, unit), from = mountFrom(game, rack.id, h, k, unit), id = stack.ids[0];
    if (from === undefined) return;
    onClose();
    onMount({ ...mountTask(stack, rack.id, k, from), onDone: () => onMounted?.(rack.id, id) });
  };
  return (
    <Sheet title={t("locations-2.mountName", { name: `${stack.brand} ${modelName(m, stack.brand)}` })} onClose={onClose}>
      <div className="loc-mount">
        <div className="picks" role="group" aria-label={t("locations-2.rack")}>
          {racks.map((r) => {
            const used = game.devices.filter((d) => d.rackId === r.id).reduce((u, d) => u + heightIn(game, r.id, d.model), 0);
            return (
              <button key={r.id} className="pick" aria-pressed={r.id === picked} disabled={!fits(r.id)} onClick={() => setPicked(r.id)}>
                <strong>{r.name}</strong><span className="sub num">{t("locations-2.uFree", { n: rackUnits(r) - used })}</span>
              </button>
            );
          })}
        </div>
        {!racks.length && <div className="loc-row loc-muted">{t("locations-2.noRackInZone")}</div>}
        {rack && (
          <div className="loc-mount-rack">
            <RackFront units={rackUnits(rack)} shelf={rack.model === "shelf"} items={rackItems(game, rack.id)} w={340} u={18} onDevice={() => {}} onFree={(unit) => mount(unit)} />
          </div>
        )}
      </div>
      {stack.ids.length > 1 && (
        <div className="loc-sheet-foot">
          <span className="loc-k">{t("locations-2.units")}</span>
          <Stepper value={n} min={1} onChange={(v) => setCount(Math.min(v, stack.ids.length))} />
        </div>
      )}
    </Sheet>
  );
}

// Ships every selected stack at once: one courier quote, or the player drives the load over.
function Bulk({ game, from, ids, onDone, children }: { game: GameState; from: string; ids: string[]; onDone: () => void; children?: ReactNode }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const targets = game.locations.filter((l) => l.id !== from);
  const [to, setTo] = useState(targets[0].id);
  const dest = targets.find((l) => l.id === to) ?? targets[0], trip = parcelCost(game, from, dest.id, ids.length);
  const here = present(game, from) && game.player.until <= game.hour, fare = drive(game, dest.id);
  const go = (self: boolean) => {
    if (!act(shipStock, ids, dest.id, self).ok) return;
    notify("Locations", t("locations-2.shippingTo", { az: dest.az }), t("locations-2.nUnits", { n: ids.length }));
    onDone();
  };
  return (
    <div className="loc-row loc-ship loc-bulk">
      <strong className="num">{t("locations-2.selectedUnits", { n: ids.length })}</strong>
      {children}
      <div className="seg wrap" role="group" aria-label={t("locations-2.zone")}>
        {targets.map((l) => <button key={l.id} className="num" title={l.name} aria-pressed={l.id === dest.id} onClick={() => setTo(l.id)}>{l.az}</button>)}
      </div>
      <span className="grow" />
      <span className="num">{euro(trip.price)}</span>
      <span className="num loc-muted">{t("locations-2.arrives", { day: day(game.hour + trip.hours) })}</span>
      {fare && <button className="btn" disabled={!here} title={here ? undefined : t("error.notThere")} onClick={() => go(true)}>{t("locations-1.driveYourself", { hours: fare.hours, fee: euro(fare.fee) })}</button>}
      <button className="btn primary" onClick={() => go(false)}>{t("locations-2.ship")}</button>
    </div>
  );
}

// Units stored in one zone, grouped by model.
export function Storage({ game, loc, onMounted }: { game: GameState; loc: Location; onMounted?: Mounted }) {
  const stacks = storageStacks(game, loc.id);
  const [sel, setSel] = useState<string[]>([]), [qty, setQty] = useState<Record<string, number>>({}), last = useRef(-1);
  const key = (s: Stack) => `${s.model}|${s.brand}`, keys = stacks.map(key), picked = stacks.filter((s) => sel.includes(key(s)));
  const pick = (i: number, range: boolean) => {
    const span = range && last.current >= 0 ? keys.slice(Math.min(i, last.current), Math.max(i, last.current) + 1) : [keys[i]];
    const on = !sel.includes(keys[i]);
    setSel(on ? [...new Set([...sel, ...span])] : sel.filter((k) => !span.includes(k)));
    last.current = i;
  };
  const transit = new Map<string, Device[]>();
  for (const d of game.devices.filter((x) => x.transitTo)) {
    const k = `${d.model}|${d.brand}|${d.transitTo}|${d.arriveAt}`;
    transit.set(k, [...(transit.get(k) ?? []), d]);
  }
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>{t("locations-2.storage")}</h3><Zone loc={loc} /><span className="grow" />{stacks.length > 1 && game.locations.length > 1 && <label className="loc-pick"><input type="checkbox" checked={picked.length === stacks.length} onChange={(e) => setSel(e.target.checked ? keys : [])} />{t("locations-2.selectAll")}</label>}<span className="num loc-muted">{stacks.reduce((n, s) => n + s.ids.length, 0)}</span></div>
      {stacks.length ? <div className="loc-stack-grid">{stacks.map((s, i) => <StackRow key={key(s)} game={game} stack={s} onMounted={onMounted} checked={sel.includes(key(s))} onPick={game.locations.length > 1 ? (r) => pick(i, r) : undefined} />)}</div> : <div className="loc-row loc-muted">{t("locations-2.empty")}</div>}
      {picked.length > 0 && <Bulk key={loc.id} game={game} from={loc.id} ids={picked.flatMap((s) => s.ids.slice(0, qty[key(s)] ?? s.ids.length))} onDone={() => { setSel([]); setQty({}); }}>
        {picked.filter((s) => s.ids.length > 1).map((s) => <span key={key(s)} className="loc-bulk-qty" title={`${s.brand} ${modelName(modelById(s.model), s.brand)}`}>
          <Stepper value={Math.min(qty[key(s)] ?? s.ids.length, s.ids.length)} min={1} onChange={(v) => setQty({ ...qty, [key(s)]: Math.min(v, s.ids.length) })} /></span>)}
      </Bulk>}
      {transit.size > 0 && <div className="loc-card-h loc-sub"><h3><Truck />{t("locations-2.inTransit")}</h3></div>}
      {[...transit].map(([k, ds]) => {
        const m = modelById(ds[0].model), to = game.locations.find((l) => l.id === ds[0].transitTo)!;
        return (
          <div key={k} className="loc-row loc-transit">
            <span className="num">{ds.length} ×</span><span>{ds[0].brand} {modelName(m, ds[0].brand)}</span><span className="grow" />
            <LocName loc={to} /><span className="num loc-muted">{t("locations-2.arrives", { day: day(ds[0].arriveAt!) })}</span>
          </div>
        );
      })}
    </div>
  );
}

function StackRow({ game, stack, onMounted, checked, onPick }: { game: GameState; stack: Stack; onMounted?: Mounted; checked: boolean; onPick?: (range: boolean) => void }) {
  const act = useStore((s) => s.act);
  const [mounting, setMounting] = useState(false), hand = useHandWork();
  const [selling, setSelling] = useState(false);
  const [shipping, setShipping] = useState(false);
  const [listing, setListing] = useState(false);
  // Leased units can't be sold, so Sell takes paid-off units of the stack.
  const m = modelById(stack.model), units = game.devices.filter((d) => stack.ids.includes(d.id)), owned = units.filter((d) => !d.lease), first = owned[0] ?? units[0];
  const rackable = m.height > 0 || m.kind === "pdu" || m.kind === "kvm", office = isOfficeRouter(m) && !!units[0].store && !!mountedRouter(game, units[0].store), install = () => act(installRouter, units[0].id);
  const entries = (): MenuEntry[] => [
    rackable && { label: t("locations-2.mountMenu"), run: () => setMounting(true) },
    office && { label: t("locations-2.install"), run: install },
    { label: t("locations-2.shipTo"), disabled: game.locations.length < 2, run: () => setShipping(true) },
    null,
    { label: t("locations-2.listForSale"), disabled: !!first.lease, run: () => setListing(true) },
    { label: t("locations-2.sellMenu"), disabled: !!first.lease, run: () => setSelling(true) },
  ];
  return (
    <div className={`loc-stack${shipping || listing || selling ? " open" : ""}`} onContextMenu={menuOn(entries)}>
      <div className="loc-stack-main">
        {onPick && <input type="checkbox" className="loc-stack-pick" aria-label={t("locations-2.selectStack")} checked={checked} onChange={() => {}} onClick={(e) => onPick(e.shiftKey)} />}
        <Isometric model={m} brand={stack.brand} w={96} count={stack.ids.length} />
        <div className="loc-stack-name">
          <strong>{stack.brand} {modelName(m, stack.brand)}</strong>
          <span className="num loc-muted">{height(m)} · {t("locations-2.nInStorage", { n: stack.ids.length })}</span>
        </div>
        <div className="loc-stack-acts">
          {rackable && <button className="btn" onClick={() => setMounting(true)}><ArrowDownToLine />{t("locations-2.mount")}</button>}
          {office && <button className="btn" onClick={install}><Router />{t("locations-2.install")}</button>}
          {game.locations.length > 1 && <button className="btn" aria-pressed={shipping} onClick={() => setShipping(!shipping)}><Truck />{t("locations-2.ship")}</button>}
          <More label={`${stack.brand} ${modelName(m, stack.brand)}`} entries={entries} />
        </div>
      </div>
      {mounting && <MountSheet game={game} stack={stack} onClose={() => setMounting(false)} onMount={(task) => hand.start(game, task)} onMounted={onMounted} />}
      {hand.dialog}
      {shipping && <Ship game={game} ids={stack.ids} onDone={() => setShipping(false)} />}
      {listing && <ListForSale game={game} id={first.id} onDone={() => setListing(false)} />}
      {selling && (owned.length > 1
        ? <SellMany game={game} units={owned} onDone={() => setSelling(false)} />
        : <SellConfirm game={game} name={first.name} price={first.price} boughtAt={first.boughtAt} value={deviceValue(game, first)}
          onCancel={() => setSelling(false)}
          onSell={() => { setSelling(false); act(sellDevice, first.id); }} />
      )}
    </div>
  );
}
