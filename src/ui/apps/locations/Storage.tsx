import { CircleDollarSign, HardDriveDownload } from "lucide-react";
import { useState } from "react";
import { modelById } from "../../../sim/10-catalog/hardware";
import type { GameState } from "../../../sim/50-state";
import { freeSlots, storageStacks } from "../../../sim/60-infra/status";
import { mountStack, sellDevice } from "../../../sim/90-actions/hardware";
import { Isometric } from "../../art/Isometric";
import { useStore } from "../../store";
import { height } from "../hw";
import { SellConfirm } from "./Inspector";

type Stack = ReturnType<typeof storageStacks>[number];

// Stored units grouped by model; racks at `locationId` come first in the mount picker.
export function Storage({ game, locationId }: { game: GameState; locationId?: string }) {
  const stacks = storageStacks(game);
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3>Storage</h3><span className="grow" /><span className="num loc-muted">{stacks.reduce((n, s) => n + s.ids.length, 0)}</span></div>
      {stacks.length ? stacks.map((s) => <StackRow key={`${s.model}|${s.brand}`} game={game} stack={s} locationId={locationId} />) : <div className="loc-row loc-muted">Empty</div>}
    </div>
  );
}

function StackRow({ game, stack, locationId }: { game: GameState; stack: Stack; locationId?: string }) {
  const act = useStore((s) => s.act);
  const [mounting, setMounting] = useState(false);
  const [selling, setSelling] = useState(false);
  const [count, setCount] = useState(stack.ids.length);
  const m = modelById(stack.model), first = game.devices.find((d) => d.id === stack.ids[0])!;
  const n = Math.min(Math.max(1, count), stack.ids.length);
  const racks = game.racks.filter((r) => r.arriveAt === null).sort((a, b) => Number(b.locationId === locationId) - Number(a.locationId === locationId));
  const fits = racks.filter((r) => freeSlots(game, r.id, m.height * n).length);
  const [rackId, setRack] = useState("");
  const rack = fits.find((r) => r.id === rackId) ?? fits[0];
  const mount = () => { if (rack && act((s) => mountStack(s, stack.model, stack.brand, rack.id, n)).ok) setMounting(false); };

  return (
    <div className="loc-stack">
      <div className="loc-stack-main">
        <Isometric model={m} brand={stack.brand} w={96} count={stack.ids.length} />
        <div className="loc-stack-name">
          <strong>{m.kind === "server" ? `${stack.brand} ` : ""}{m.name}</strong>
          <span className="num loc-muted">{height(m)} · {stack.ids.length} in storage</span>
        </div>
        <span className="grow" />
        <button className="btn" onClick={() => setSelling(true)}><CircleDollarSign />Sell</button>
        <button className="btn" aria-expanded={mounting} onClick={() => setMounting(!mounting)}><HardDriveDownload />Mount</button>
      </div>
      {mounting && (
        <div className="loc-row">
          <select className="field grow" aria-label="Rack" value={rack?.id ?? ""} onChange={(e) => setRack(e.target.value)} disabled={!fits.length}>
            {fits.length ? fits.map((r) => <option key={r.id} value={r.id}>{r.name}, {game.locations.find((l) => l.id === r.locationId)?.name}</option>) : <option>No rack has room</option>}
          </select>
          <input className="field num loc-qty" type="number" aria-label="Count" min={1} max={stack.ids.length} value={n} onChange={(e) => setCount(Number(e.target.value))} />
          <button className="btn primary" disabled={!rack} onClick={mount}>Mount</button>
        </div>
      )}
      {selling && (
        <SellConfirm game={game} name={first.name} price={first.price} boughtAt={first.boughtAt}
          onCancel={() => setSelling(false)}
          onSell={() => { setSelling(false); act((s) => sellDevice(s, first.id)); }} />
      )}
    </div>
  );
}
