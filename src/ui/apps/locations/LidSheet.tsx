import { useEffect, useRef, useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { bayTakes, COMPONENTS, fits, modelById, partPrice, samePart, type ComponentKind } from "../../../sim/10-catalog/hardware";
import type { Component, Device } from "../../../sim/50-state";
import { locationOf } from "../../../sim/60-infra/status";
import { installPart, removePart, replaceComponent } from "../../../sim/90-actions/hardware";
import { chassisSlots, GROUP_KINDS, GROUP_NAME, TopDown, type Group, type Slot } from "../../art/TopDown";
import { reduced } from "../../desktop/motion";
import { useStore } from "../../store";
import { ageYears, devName, isWorn, partLabel, partSlot } from "../hw";
import { specOf, spareSpec } from "./Slots";
import { Facts, Sheet } from "./ui";

export const LID_MS = 600;
const COUNTED: Group[] = ["cpu", "ram", "bay", "pcie", "psu", "fan"];
const slotName = (s: Slot) => (s.group === "pcie" ? `PCIe ${s.index + 1}` : s.group === "board" ? "Onboard" : partSlot(GROUP_KINDS[s.group][0], s.index + 1));

// The lid-off view of a powered-off server: the lid slides off, every slot opens its part, and Close puts the lid back.
// The lid is UI state of this sheet; the sheet closes itself when the server is powered on or gone.
export function LidSheet({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const device = game.devices.find((d) => d.id === deviceId);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const closing = useRef(false);
  const ms = reduced() ? 0 : LID_MS;
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  const gone = !device || device.on;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);
  if (!device || gone) return null;

  const close = () => {
    if (closing.current) return;
    closing.current = true;
    setSel(null);
    setOpen(false);
    setTimeout(onClose, ms);
  };
  const model = modelById(device.model);
  const slots = chassisSlots(model, device.components), slot = slots.find((s) => s.id === sel);
  const zone = device.rackId ? locationOf(game, device) : game.locations.find((l) => l.id === device.store);
  const spares = (kinds: ComponentKind[]) => game.devices.filter((d) => d.store === zone?.id && kinds.some((k) => d.model === `part-${k}`));
  const wear = (c: Component) => (c.failedAt !== null ? "bad" : isWorn(game, c) ? "warn" : "ok") as "ok" | "warn" | "bad";

  return (
    <Sheet title={devName(device)} onClose={close} wide>
      <div className="lid-body">
        <TopDown model={model} brand={device.brand} name={devName(device)} parts={device.components} wear={wear} open={open} ms={ms} sel={sel} onPick={(id) => open && setSel(id)} />
        <div className="lid-counts">
          {COUNTED.map((g) => (
            <span key={g}><span className="loc-k">{GROUP_NAME[g]}</span><span className="num">{slots.filter((s) => s.group === g && s.part).length} of {slots.filter((s) => s.group === g).length}</span></span>
          ))}
        </div>
        <div className="lid-detail">{open && slot && <SlotCard device={device} slot={slot} wear={wear} spares={spares} az={zone?.az ?? ""} act={act} />}</div>
      </div>
      <div className="loc-sheet-foot"><span className="grow" /><button className="btn primary" onClick={close}>Close</button></div>
    </Sheet>
  );
}

type Act = ReturnType<typeof useStore.getState>["act"];

// A filled slot shows its part with Replace and Remove; an empty slot offers the spare parts in storage that fit.
function SlotCard({ device, slot, wear, spares, az, act }: { device: Device; slot: Slot; wear: (c: Component) => "ok" | "warn" | "bad"; spares: (kinds: ComponentKind[]) => Device[]; az: string; act: Act }) {
  const game = useStore((s) => s.game), model = modelById(device.model), c = slot.part;
  const busy = !!device.maintenance;
  if (c) {
    const w = wear(c);
    const spare = spares([c.kind]).some((d) => d.part === undefined || (d.part.size ?? 0) >= (c.size ?? 0));
    const removable = c.kind !== "board" && c.kind !== "nic";
    return (
      <div className="loc-card lid-card">
        <div className="loc-card-h">
          <h3>{partLabel(c)}</h3>
          {busy ? <span className="pill">Work under way</span> : <span className={`pill ${w}`}>{w === "bad" ? "Failed" : w === "warn" ? "Worn" : "OK"}</span>}
          <span className="grow" />
          {!busy && <button className="btn" disabled={!spare} onClick={() => act((g) => replaceComponent(g, device.id, c.id))}>Replace</button>}
          {!busy && removable && <button className="btn" onClick={() => act((g) => removePart(g, device.id, c.id))}>Remove</button>}
        </div>
        <Facts rows={[
          ["Slot", <span className="num">{slotName(slot)}</span>],
          ["Age", <span className="num">{ageYears(game, c).toFixed(1)} / {COMPONENTS[c.kind].life} y</span>],
          ["Price", <span className="num">{euro(partPrice(specOf(c)))}</span>],
        ]} />
      </div>
    );
  }
  const taken = (d: Device) => { const f = spareSpec(d).ff; return slot.group !== "bay" || !f || bayTakes(slot.ff!, f); };
  const fitting = spares(GROUP_KINDS[slot.group]).filter((d) => taken(d) && !fits(model, [...device.components.map(specOf), spareSpec(d)]));
  const offers = fitting.filter((d, i) => fitting.findIndex((x) => samePart(spareSpec(x), spareSpec(d))) === i);
  return (
    <div className="loc-card lid-card">
      <div className="loc-card-h"><h3>{slotName(slot)}</h3><span className="pill">Empty</span></div>
      <div className="lid-offers">
        {busy ? <span className="loc-muted">Work under way</span> : offers.length ? offers.map((d) => {
          const spec = spareSpec(d), n = fitting.filter((x) => samePart(spareSpec(x), spec)).length;
          return (
            <button key={d.id} className="btn" onClick={() => act((g) => installPart(g, device.id, d.id))}>
              {partLabel(spec)}<span className="num">{euro(partPrice(spec))}</span>{n > 1 && <span className="num">× {n}</span>}
            </button>
          );
        }) : <span className="loc-muted">No fitting part in {az}</span>}
      </div>
    </div>
  );
}
