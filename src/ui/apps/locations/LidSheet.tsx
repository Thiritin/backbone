import { useEffect, useRef, useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { bayTakes, COMPONENTS, fits, modelById, samePart, type ComponentKind } from "../../../sim/10-catalog/hardware";
import { partPrice } from "../../../sim/10-catalog/parts";
import type { Component, Device } from "../../../sim/50-state";
import { energized, hotKind, hotSwappable, locationOf } from "../../../sim/60-infra/status";
import { installPart, removePart, replaceComponent, replaceSpares } from "../../../sim/90-actions/hardware";
import { chassisSlots, GROUP_KINDS, GROUP_NAME, TopDown, type Group, type Slot } from "../../art/TopDown";
import { reduced } from "../../desktop/motion";
import { t } from "../../../i18n/en";
import { useStore } from "../../store";
import { ageYears, devName, isWorn, partLabel, partSlot } from "../hw";
import { specOf, spareSpec } from "./Slots";
import { useHandWork } from "./HandSheet";
import { Facts, Sheet } from "./ui";

export const LID_MS = 600;
const COUNTED: Group[] = ["cpu", "ram", "bay", "pcie", "psu", "fan"];
const slotName = (s: Slot) => (s.group === "pcie" ? `PCIe ${s.index + 1}` : s.group === "board" ? t("locations-1.onboard") : partSlot(GROUP_KINDS[s.group][0], s.index + 1));

// The lid-off view of a server: the lid slides off, every slot opens its part, and Close puts the lid back. A running server only
// takes hot-swap work. The lid is UI state of this sheet; the sheet closes itself when the server is gone.
export function LidSheet({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const game = useStore((s) => s.game);
  const device = game.devices.find((d) => d.id === deviceId);
  const [open, setOpen] = useState(false);
  const [sel, setSel] = useState<string | null>(null);
  const closing = useRef(false);
  const ms = reduced() ? 0 : LID_MS;
  useEffect(() => { const t = setTimeout(() => setOpen(true), 60); return () => clearTimeout(t); }, []);
  const gone = !device;
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
            <span key={g}><span className="loc-k">{GROUP_NAME[g]}</span><span className="num">{t("locations-1.nOfM", { n: slots.filter((s) => s.group === g && s.part).length, m: slots.filter((s) => s.group === g).length })}</span></span>
          ))}
        </div>
        <div className="lid-detail">{open && slot && <SlotCard device={device} slot={slot} wear={wear} spares={spares} az={zone?.az ?? ""} />}</div>
      </div>
      <div className="loc-sheet-foot"><span className="grow" /><button className="btn primary" onClick={close}>{t("locations-1.close")}</button></div>
    </Sheet>
  );
}

// A filled slot shows its part with Replace and Remove; an empty slot offers the spare parts in storage that fit.
function SlotCard({ device, slot, wear, spares, az }: { device: Device; slot: Slot; wear: (c: Component) => "ok" | "warn" | "bad"; spares: (kinds: ComponentKind[]) => Device[]; az: string }) {
  const game = useStore((s) => s.game), hand = useHandWork(), model = modelById(device.model), c = slot.part;
  const busy = !!device.maintenance, live = !!device.rackId && energized(device);
  if (c) {
    const w = wear(c);
    const zone = device.rackId ? locationOf(game, device)?.id : device.store;
    const set = zone ? replaceSpares(game, device, c, zone).length : 0, spare = set > 0;
    const removable = c.kind !== "board" && c.kind !== "nic", cold = live && !hotSwappable(device, c);
    return (
      <div className="loc-card lid-card">
        <div className="loc-card-h">
          <h3>{partLabel(c)}</h3>
          {busy ? <span className="pill">{t("locations-1.workUnderWay")}</span> : <span className={`pill ${w}`}>{w === "bad" ? t("locations-1.failed") : w === "warn" ? t("locations-1.worn") : t("locations-1.ok")}</span>}
          <span className="grow" />
          {!busy && cold && <span className="loc-muted">{t("locations-1.powerOffFirst")}</span>}
          {!busy && !cold && <button className="btn" disabled={!spare} onClick={() => hand.start(game, { title: set > 1 ? t("locations-1.replaceCpus", { n: set }) : t("locations-1.replacePart", { part: partLabel(c) }), deviceId: device.id, action: replaceComponent, args: [device.id, c.id], tech: { kind: "replace", componentId: c.id } })}>{t("locations-1.replace")}</button>}
          {!busy && !cold && removable && <button className="btn" onClick={() => hand.start(game, { title: t("locations-1.removePart", { part: partLabel(c) }), deviceId: device.id, action: removePart, args: [device.id, c.id], tech: { kind: "part", componentId: c.id } })}>{t("locations-1.remove")}</button>}
        </div>
        <Facts rows={[
          [t("locations-1.slot"), <span className="num">{slotName(slot)}</span>],
          [t("locations-1.age"), <span className="num">{ageYears(game, c) === null ? t("locations-1.unknown") : t("locations-1.ageOf", { age: ageYears(game, c)!.toFixed(1), life: COMPONENTS[c.kind].life })}</span>],
          [t("locations-1.price"), <span className="num">{euro(partPrice(c.kind, c.size, c.ff, yearOf(game.hour), c))}</span>],
        ]} />
        {hand.dialog}
      </div>
    );
  }
  const taken = (d: Device) => { const f = spareSpec(d).ff; return slot.group !== "bay" || !f || bayTakes(slot.ff!, f); };
  const fitting = spares(GROUP_KINDS[slot.group]).filter((d) => taken(d) && !fits(model, [...device.components.map(specOf), spareSpec(d)]));
  const offers = fitting.filter((d, i) => fitting.findIndex((x) => samePart(spareSpec(x), spareSpec(d))) === i);
  const cold = live && GROUP_KINDS[slot.group].every((k) => !hotKind(device, k));
  return (
    <div className="loc-card lid-card">
      <div className="loc-card-h"><h3>{slotName(slot)}</h3><span className="pill">{t("locations-1.empty")}</span></div>
      <div className="lid-offers">
        {busy ? <span className="loc-muted">{t("locations-1.workUnderWay")}</span> : cold ? <span className="loc-muted">{t("locations-1.powerOffFirst")}</span> : offers.length ? offers.map((d) => {
          const spec = spareSpec(d), n = fitting.filter((x) => samePart(spareSpec(x), spec)).length;
          return (
            <button key={d.id} className="btn" onClick={() => hand.start(game, { title: t("locations-1.installPart", { part: partLabel(spec) }), deviceId: device.id, action: installPart, args: [device.id, d.id, undefined], tech: { kind: "part", partId: d.id } })}>
              {partLabel(spec)}<span className="num">{euro(partPrice(spec.kind, spec.size, spec.ff, yearOf(game.hour), spec))}</span>{n > 1 && <span className="num">× {n}</span>}
            </button>
          );
        }) : <span className="loc-muted">{t("locations-1.noFittingPart", { az })}</span>}
      </div>
      {hand.dialog}
    </div>
  );
}
