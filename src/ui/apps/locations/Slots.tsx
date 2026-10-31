import { Cpu, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { dateOf, yearOf } from "../../../sim/00-core/time";
import { boardSpec, COMPONENTS, fits, modelById, samePart, slotsOf, specOf as catalogSpec, type ComponentKind, type PartSpec } from "../../../sim/10-catalog/hardware";
import { socketOf, VENDOR_NAME } from "../../../sim/10-catalog/cpus";
import { partPrice } from "../../../sim/10-catalog/parts";
import type { Component, Device, GameState } from "../../../sim/50-state";
import { energized, hotKind, hotSwappable, locationOf } from "../../../sim/60-infra/status";
import { installPart, removePart, replaceComponent, replaceSpares } from "../../../sim/90-actions/hardware";
import { ageYears, clockLabel, isWorn, PART_NAME, partLabel, partSize, partSlot } from "../hw";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { atDatacenter, useHandWork } from "./HandSheet";
import { TechButton } from "./TechButton";

interface Group { name: string; kinds: ComponentKind[]; slots: number }

// The slot groups of a chassis; the mainboard and network card sit in an onboard group with no free slots.
function groupsOf(device: Device): Group[] {
  const m = modelById(device.model), v = m.server;
  const onboard = device.components.filter((c) => c.kind === "board" || c.kind === "nic").length;
  const groups: Group[] = [
    { name: t("locations-2.cpuSockets"), kinds: ["cpu"], slots: slotsOf(m, "cpu") },
    { name: t("locations-2.dimmSlots"), kinds: ["ram"], slots: slotsOf(m, "ram") },
    { name: v ? t("locations-2.driveBaysOf", { bays: new Intl.ListFormat(LOCALE, { type: "conjunction" }).format(v.bays.map((b) => (b.ff === "nvme" ? t("locations-2.nvmeCapable") : `${b.ff}"`))) }) : t("locations-2.driveBays"), kinds: ["hdd", "ssd", "nvme"], slots: slotsOf(m, "hdd") },
    { name: slotsOf(m, "gpu") ? t("locations-2.gpuSlots") : t("locations-2.pcieSlots"), kinds: ["gpu"], slots: slotsOf(m, "gpu") || (v?.pcie ?? 0) },
    { name: t("locations-2.psuBays"), kinds: ["psu"], slots: slotsOf(m, "psu") },
    { name: t("locations-2.fans"), kinds: ["fan"], slots: slotsOf(m, "fan") },
    { name: t("locations-2.onboard"), kinds: ["board", "nic"], slots: onboard },
  ];
  return groups.filter((g) => g.slots > 0);
}
export const specOf = catalogSpec;
const EMPTY_SHOWN = 4;
const clock = (hour: number) => dateOf(hour).toISOString().slice(11, 16);
// What a spare in storage is.
export const spareSpec = (d: Device): PartSpec => ({ ...d.part, kind: d.model.slice(5) as ComponentKind });

// Each slot group of a chassis with the part in every filled slot, its age against its life and its state, and the empty slots,
// where Add offers the spare parts in the zone's storage that fit.
export function PartsCard({ game, device }: { game: GameState; device: Device }) {
  const hand = useHandWork(true), remote = atDatacenter(game, device.id);
  const [adding, setAdding] = useState<string | null>(null);
  const model = modelById(device.model);
  const zone = device.rackId ? locationOf(game, device) : game.locations.find((l) => l.id === device.store);
  const held = device.maintenance ? t("locations-2.workUnderWay") : device.rackId || device.store ? null : t("locations-2.inTransit");
  const spares = (kinds: ComponentKind[]) => game.devices.filter((d) => d.store === zone?.id && kinds.some((k) => d.model === `part-${k}`));
  const swapSet = (c: Component) => (zone ? replaceSpares(game, device, c, zone.id).length : 0), spareFor = (c: Component) => swapSet(c) > 0;
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Cpu />{t("locations-2.components")}</h3>{held && <span className="loc-muted">{held}</span>}</div>
      <table className="table loc-parts">
        <thead><tr><th>{t("locations-2.part")}</th><th>{t("locations-2.size")}</th><th>{t("locations-2.slot")}</th><th>{t("locations-2.age")}</th><th>{t("locations-2.status")}</th><th /></tr></thead>
        {groupsOf(device).map((g) => {
          const filled = device.components.filter((c) => g.kinds.includes(c.kind));
          const empty = Math.max(0, g.slots - filled.length);
          const fitting = g.kinds.length ? spares(g.kinds).filter((d) => !fits(model, [...device.components.map(specOf), spareSpec(d)])) : [];
          const offers = fitting.filter((d, i) => fitting.findIndex((x) => samePart(spareSpec(x), spareSpec(d))) === i);
          const cold = (d: Device) => !!device.rackId && energized(device) && !hotKind(device, d.model.slice(5) as ComponentKind);
          return (
            <tbody key={g.name}>
              <tr className="loc-group"><th colSpan={6}>{g.name}<span className="num loc-muted"> {t("locations-2.nOfM", { n: filled.length, m: g.slots })}</span></th></tr>
              {filled.map((c, i) => {
                const life = COMPONENTS[c.kind].life, age = ageYears(game, c), worn = isWorn(game, c);
                const m = device.maintenance, swap = m?.componentId === c.id || !!m?.others?.includes(c.id),rebuild = device.rebuild?.componentId === c.id;
                const status = swap ? <span className="pill">{t("locations-2.swapAt", { time: clock(device.maintenance!.doneAt) })}</span>
                  : c.failedAt !== null ? <span className="pill bad">{t("locations-2.failed")}</span>
                  : rebuild ? <span className="pill warn">{t("locations-2.rebuilding")}</span>
                  : worn ? <span className="pill warn">{t("locations-2.worn")}</span> : c.wear ? <span className="pill">{t("locations-2.untested")}</span> : <span className="pill ok">{t("locations-2.ok")}</span>;
                const busy = swap || held !== null || !device.rackId || !remote;
                const hot = hotSwappable(device, c);
                const block = busy ? null : !spareFor(c) ? (c.failedAt !== null || worn ? t("locations-2.noPartIn", { az: zone?.az ?? "" }) : "")
                  : energized(device) && !hot ? t("locations-2.powerOffFirst") : null;
                const removable = c.kind !== "board" && c.kind !== "nic" && !swap && held === null && remote;
                return (
                  <tr key={c.id}>
                    <td>{c.vendor && c.kind !== "board" ? `${VENDOR_NAME[c.vendor]} ` : ""}{c.kind === "board" && c.vendor ? boardSpec(modelById(device.model), c.vendor)?.name ?? PART_NAME[c.kind] : PART_NAME[c.kind]}{c.kind === "cpu" && clockLabel(c) ? `, ${clockLabel(c)}` : ""}{c.kind === "cpu" && c.vendor && c.gen ? t("locations-2.socket", { socket: socketOf(c.vendor, c.gen) ?? "" }) : ""}</td>
                    <td className="num">{partSize(c)}</td>
                    <td className="num">{partSlot(c.kind, i + 1)}</td>
                    <td>
                      <span className={`loc-meter${worn ? " worn" : ""}`}>
                        <span className="loc-meter-bar"><span style={{ width: `${age === null ? (worn ? 80 : 0) : Math.min(1, age / life) * 100}%` }} /></span>
                        <span className="num">{age === null ? t("locations-2.unknown") : t("locations-2.ageOfLife", { age: age.toFixed(1), life })}</span>
                      </span>
                    </td>
                    <td>{status}</td>
                    <td className="r">
                      <span className="loc-acts">
                        {busy ? null : block !== null ? <span className="loc-muted">{block}</span>
                          : <button className="btn" onClick={() => hand.start(game, { title: swapSet(c) > 1 ? t("locations-2.replaceCpus", { n: swapSet(c) }) : t("locations-2.replacePart", { part: PART_NAME[c.kind] }), deviceId: device.id, action: replaceComponent, args: [device.id, c.id], tech: { kind: "replace", componentId: c.id } })}>{t("locations-2.replace")}</button>}
                        {!busy && spareFor(c) && <TechButton game={game} deviceId={device.id} kind="replace" componentId={c.id} />}
                        {removable && (device.rackId && energized(device) && !hot ? null : <button className="btn" onClick={() => hand.start(game, { title: t("locations-2.removePart", { part: PART_NAME[c.kind] }), deviceId: device.id, action: removePart, args: [device.id, c.id], tech: { kind: "part", componentId: c.id } })}>{t("locations-2.remove")}</button>)}
                        {removable && !!device.rackId && <TechButton game={game} deviceId={device.id} kind="part" componentId={c.id} />}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: Math.min(empty, EMPTY_SHOWN) }, (_, i) => (
                <tr key={`e${i}`} className="loc-empty">
                  <td className="loc-muted">{t("locations-2.empty")}</td>
                  <td className="num loc-muted">-</td>
                  <td className="num">{g.kinds.length ? partSlot(g.kinds[0], filled.length + i + 1) : t("locations-2.slotN", { n: i + 1 })}</td>
                  <td /><td />
                  <td className="r">{g.kinds.length > 0 && held === null && remote && (
                    <button className="btn" aria-pressed={adding === g.name} onClick={() => setAdding(adding === g.name ? null : g.name)}><Plus />{t("locations-2.add")}</button>
                  )}</td>
                </tr>
              ))}
              {empty > EMPTY_SHOWN && <tr><td colSpan={6} className="loc-muted">{t("locations-2.moreEmpty", { n: empty - EMPTY_SHOWN })}</td></tr>}
              {adding === g.name && (
                <tr className="loc-add"><td colSpan={6}>
                  {offers.length ? (
                    <div className="loc-chips">
                      {offers.map((d) => {
                        const spec = spareSpec(d), n = fitting.filter((x) => samePart(spareSpec(x), spec)).length;
                        return (
                          <Fragment key={d.id}>
                            <button className="btn" disabled={cold(d)} onClick={() => { hand.start(game, { title: t("locations-2.installPart", { part: partLabel(spec) }), deviceId: device.id, action: installPart, args: [device.id, d.id, undefined], tech: { kind: "part", partId: d.id } }); setAdding(null); }}>
                              {partLabel(spec)}{n > 1 && <span className="num"> × {n}</span>}<span className="num loc-muted"> {euro(partPrice(spec.kind, spec.size, spec.ff, yearOf(game.hour), spec))}</span>
                            </button>
                            {!!device.rackId && <TechButton game={game} deviceId={device.id} kind="part" partId={d.id} />}
                          </Fragment>
                        );
                      })}
                      {offers.some(cold) && <span className="loc-muted">{t("locations-2.powerOffFirst")}</span>}
                    </div>
                  ) : <span className="loc-muted">{t("locations-2.noFittingPartIn", { az: zone?.az ?? "" })}</span>}
                </td></tr>
              )}
            </tbody>
          );
        })}
      </table>
      {hand.dialog}
    </div>
  );
}
