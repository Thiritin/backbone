import { useEffect, useRef, useState } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { bayTakes, COMPONENTS, fits, modelById, partOffers, samePart, type ComponentKind, type PartSpec, modelName } from "../../../sim/10-catalog/hardware";
import { partPrice } from "../../../sim/10-catalog/parts";
import type { Component, Device } from "../../../sim/50-state";
import { energized, hotKind, hotSwappable, locationOf } from "../../../sim/60-infra/status";
import { buyDevice, installPart, removePart, replaceComponent, replaceSpares, unitPrice } from "../../../sim/90-actions/hardware";
import { formatDay } from "../../apps/billing/format";
import { chassisSlots, GROUP_KINDS, GROUP_NAME, TopDown, type Slot, type Wear } from "../../art/TopDown";
import { reduced } from "../../desktop/motion";
import { ageYears, devName, isWorn, partLabel } from "../../apps/hw";
import { HandsButtons, handsWays, useHandWork } from "../../apps/locations/HandSheet";
import { COUNTED, LID_MS, slotName } from "../../apps/locations/LidSheet";
import { specOf, spareSpec } from "../../apps/locations/Slots";
import { useStore } from "../../store";

// The pull along the rails between the rack and the open spot in front of it.
const PULL_MS = 260;
type Phase = "in" | "out" | "open";

// The server pulled out of the rack on its rails with the lid slid off. A slot click hangs its part's tag beside the chassis;
// closing slides the lid back and pushes the server in before onClose.
export function LidScene({ deviceId, onClose }: { deviceId: string; onClose: () => void }) {
  const game = useStore((s) => s.game), hand = useHandWork();
  const device = game.devices.find((d) => d.id === deviceId);
  const [phase, setPhase] = useState<Phase>("in");
  const [sel, setSel] = useState<string | null>(null);
  const timers = useRef<number[]>([]);
  const slow = !reduced(), lidMs = slow ? LID_MS : 0, pullMs = slow ? PULL_MS : 0;
  const later = (ms: number, f: () => void) => { timers.current.push(window.setTimeout(f, ms)); };
  useEffect(() => {
    later(30, () => setPhase("out"));
    later(30 + pullMs, () => setPhase("open"));
    return () => timers.current.forEach(clearTimeout);
  }, []);
  const gone = !device;
  useEffect(() => { if (gone) onClose(); }, [gone, onClose]);
  if (!device) return null;

  const close = () => {
    if (phase === "in") return;
    timers.current.forEach(clearTimeout);
    setSel(null);
    setPhase("out");
    later(phase === "open" ? lidMs : 0, () => setPhase("in"));
    later((phase === "open" ? lidMs : 0) + pullMs, onClose);
  };
  const model = modelById(device.model), slots = chassisSlots(model, device.components), slot = slots.find((s) => s.id === sel);
  const wear = (c: Component): Wear => (c.failedAt !== null ? "bad" : isWorn(game, c) ? "warn" : "ok");
  const open = phase === "open";

  return (
    <div className="wl-scene" data-lid={device.id} onClick={(e) => { if (e.target === e.currentTarget) close(); }}>
      <div className={`wl-pull${phase === "in" ? "" : " out"}`} style={{ ["--pull-ms" as string]: `${pullMs}ms` }}>
        <div className="wl-rail top" aria-hidden="true" />
        <div className="wl-rail bottom" aria-hidden="true" />
        <TopDown model={model} brand={device.brand} name={devName(device)} parts={device.components} wear={wear} open={open} ms={lidMs} sel={sel} onPick={(id) => open && setSel(id)} />
        <div className="wl-spec" data-spec="">
          <b>{device.brand} {modelName(model, device.brand)}</b>
          <dl>
            {COUNTED.map((g) => (
              <div key={g}><dt>{GROUP_NAME[g]}</dt><dd>{t("locations-1.nOfM", { n: slots.filter((s) => s.group === g && s.part).length, m: slots.filter((s) => s.group === g).length })}</dd></div>
            ))}
          </dl>
          <button className="wr-line" onClick={close}>{t("locations-1.close")}</button>
        </div>
      </div>
      {open && slot && <div className="wr-tag wl-tag"><SlotTag key={slot.id} device={device} slot={slot} wear={wear} hand={hand} /></div>}
      {hand.dialog}
    </div>
  );
}

// A filled slot's tag names the part with Replace and Remove; an empty slot's tag lists the stored parts that fit.
function SlotTag({ device, slot, wear, hand }: { device: Device; slot: Slot; wear: (c: Component) => Wear; hand: ReturnType<typeof useHandWork> }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), model = modelById(device.model), c = slot.part;
  const busy = !!device.maintenance, live = !!device.rackId && energized(device);
  const zone = device.rackId ? locationOf(game, device) : game.locations.find((l) => l.id === device.store);
  const at = zone?.id;
  const rep = handsWays(game, at, "replaceComponent"), rem = handsWays(game, at, "removePart"), ins = handsWays(game, at, "installPart");

  if (c) {
    const w = wear(c), set = at ? replaceSpares(game, device, c, at).length : 0;
    const removable = c.kind !== "board" && c.kind !== "nic", cold = live && !hotSwappable(device, c);
    const state = w === "bad" ? t("locations-1.failed") : w === "warn" ? t("locations-1.worn") : t("locations-1.ok");
    const age = ageYears(game, c);
    return (
      <div className="wr-tag-body" data-slot={slot.id}>
        <div className="wr-tag-h"><span className={`wr-led ${w}`} role="img" aria-label={state} /><strong>{partLabel(c)}</strong></div>
        <div className={`wr-model${w === "bad" ? " wr-fault" : ""}`}>{slotName(slot)} · {state}</div>
        {c.failedAt !== null && <div className="wr-model">{t("locations-1.failedOn", { day: formatDay(c.failedAt) })}</div>}
        <div className="wr-model">{age === null ? t("locations-1.unknown") : `${t("locations-1.age")} ${t("locations-1.ageOf", { age: age.toFixed(1), life: COMPONENTS[c.kind].life })}`}</div>
        <div className="wr-model">{euro(partPrice(c.kind, c.size, c.ff, yearOf(game.hour), c))}</div>
        <div className="wr-lines">
          {busy ? note(t("locations-1.workUnderWay")) : cold ? note(t("locations-1.powerOffFirst")) : <>
            <HandsButtons ways={rep} className="wr-line" disabled={!set} onRun={(how) => hand.start(game, { title: set > 1 ? t("locations-1.replaceCpus", { n: set }) : t("locations-1.replacePart", { part: partLabel(c) }), deviceId: device.id, action: replaceComponent, args: [device.id, c.id], tech: { kind: "replace", componentId: c.id }, how })}>{t("locations-1.replace")}</HandsButtons>
            {removable && <HandsButtons ways={rem} className="wr-line" onRun={(how) => hand.start(game, { title: t("locations-1.removePart", { part: partLabel(c) }), deviceId: device.id, action: removePart, args: [device.id, c.id], tech: { kind: "part", componentId: c.id }, how })}>{t("locations-1.remove")}</HandsButtons>}
          </>}
          {w !== "ok" && at && <OrderLine c={c} at={at} order={(line) => act(buyDevice, line.model, line.brand, 1, at, { part: line.part })} />}
        </div>
      </div>
    );
  }
  const spares = (kinds: ComponentKind[]) => game.devices.filter((d) => d.store === zone?.id && kinds.some((k) => d.model === `part-${k}`));
  const taken = (d: Device) => { const f = spareSpec(d).ff; return slot.group !== "bay" || !f || bayTakes(slot.ff!, f); };
  const fitting = spares(GROUP_KINDS[slot.group]).filter((d) => taken(d) && !fits(model, [...device.components.map(specOf), spareSpec(d)]));
  const offers = fitting.filter((d, i) => fitting.findIndex((x) => samePart(spareSpec(x), spareSpec(d))) === i);
  const cold = live && GROUP_KINDS[slot.group].every((k) => !hotKind(device, k));
  return (
    <div className="wr-tag-body" data-slot={slot.id}>
      <div className="wr-tag-h"><strong>{slotName(slot)}</strong></div>
      <div className="wr-model">{t("locations-1.empty")}</div>
      <div className="wr-lines">
        {busy ? note(t("locations-1.workUnderWay")) : cold ? note(t("locations-1.powerOffFirst")) : offers.length ? offers.map((d) => {
          const spec = spareSpec(d), n = fitting.filter((x) => samePart(spareSpec(x), spec)).length;
          return (
            <HandsButtons key={d.id} ways={ins} className="wr-line" onRun={(how) => hand.start(game, { title: t("locations-1.installPart", { part: partLabel(spec) }), deviceId: device.id, action: installPart, args: [device.id, d.id, undefined], tech: { kind: "part", partId: d.id }, how })}>
              {partLabel(spec)} <span className="num">{euro(partPrice(spec.kind, spec.size, spec.ff, yearOf(game.hour), spec))}</span>{n > 1 && <span className="num"> × {n}</span>}
            </HandsButtons>
          );
        }) : note(t("locations-1.noFittingPart", { az: zone?.az ?? "" }))}
      </div>
    </div>
  );
}

// A failed or worn part can be ordered from the Shop at its price; a part the Shop no longer sells says so.
function OrderLine({ c, at, order }: { c: Component; at: string; order: (line: { model: string; brand: string; part: PartSpec }) => void }) {
  const game = useStore((s) => s.game), year = yearOf(game.hour), want = specOf(c);
  const due = game.devices.find((d) => d.model === `part-${c.kind}` && d.arriveAt !== null && (d.transitTo === at || d.store === at) && samePart(spareSpec(d), want));
  if (due) return note(t("locations-1.partOrdered", { day: formatDay(due.arriveAt!) }));
  const part = partOffers(year).find((o) => samePart(o, want));
  if (!part) return note(t("error.notInShop"));
  const line = { model: `part-${c.kind}`, brand: "Generic", qty: 1, part };
  return <button className="wr-line" data-order="" disabled={game.cash < unitPrice(line, year)} onClick={() => order(line)}>{t("locations-1.orderPart")} <span className="num">{euro(unitPrice(line, year))}</span></button>;
}

const note = (text: string) => <span className="wr-line" aria-disabled="true">{text}</span>;
