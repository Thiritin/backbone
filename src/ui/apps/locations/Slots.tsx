import { Cpu, Plus } from "lucide-react";
import { Fragment, useState } from "react";
import { dateOf } from "../../../sim/00-core/time";
import { COMPONENTS, fits, modelById, samePart, slotsOf, type ComponentKind, type PartSpec } from "../../../sim/10-catalog/hardware";
import type { Component, Device, GameState } from "../../../sim/50-state";
import { hotKind, hotSwappable, locationOf } from "../../../sim/60-infra/status";
import { installPart, removePart, replaceComponent } from "../../../sim/90-actions/hardware";
import { useStore } from "../../store";
import { ageYears, isWorn, PART_NAME, partLabel, partSize, partSlot } from "../hw";
import { TechButton } from "./TechButton";

interface Group { name: string; kinds: ComponentKind[]; slots: number }

// The slot groups of a chassis; the mainboard and network card sit in an onboard group with no free slots.
function groupsOf(device: Device): Group[] {
  const m = modelById(device.model), v = m.server;
  const onboard = device.components.filter((c) => c.kind === "board" || c.kind === "nic").length;
  const groups: Group[] = [
    { name: "CPU sockets", kinds: ["cpu"], slots: slotsOf(m, "cpu") },
    { name: "DIMM slots", kinds: ["ram"], slots: slotsOf(m, "ram") },
    { name: `Drive bays${v ? `, ${v.bays.map((b) => (b.ff === "nvme" ? "NVMe-capable" : `${b.ff}"`)).join(" and ")}` : ""}`, kinds: ["hdd", "ssd", "nvme"], slots: slotsOf(m, "hdd") },
    { name: "PCIe slots", kinds: [], slots: v?.pcie ?? 0 },
    { name: "Power supply bays", kinds: ["psu"], slots: slotsOf(m, "psu") },
    { name: "Fans", kinds: ["fan"], slots: slotsOf(m, "fan") },
    { name: "Onboard", kinds: ["board", "nic"], slots: onboard },
  ];
  return groups.filter((g) => g.slots > 0);
}
const specOf = (c: { kind: ComponentKind; size?: number; ff?: Component["ff"] }): PartSpec => ({ kind: c.kind, ...(c.size !== undefined ? { size: c.size } : {}), ...(c.ff ? { ff: c.ff } : {}) });
const EMPTY_SHOWN = 4;
const clock = (hour: number) => dateOf(hour).toISOString().slice(11, 16);
// What a spare in storage is.
const spareSpec = (d: Device): PartSpec => ({ ...d.part, kind: d.model.slice(5) as ComponentKind });

// Each slot group of a chassis with the part in every filled slot, its age against its life and its state, and the empty slots,
// where Add offers the spare parts in the zone's storage that fit.
export function PartsCard({ game, device }: { game: GameState; device: Device }) {
  const act = useStore((s) => s.act);
  const [adding, setAdding] = useState<string | null>(null);
  const model = modelById(device.model);
  const zone = device.rackId ? locationOf(game, device) : game.locations.find((l) => l.id === device.store);
  const held = device.maintenance ? "Work under way" : device.rackId || device.store ? null : "In transit";
  const spares = (kinds: ComponentKind[]) => game.devices.filter((d) => d.store === zone?.id && kinds.some((k) => d.model === `part-${k}`));
  const spareFor = (c: Component) => spares([c.kind]).some((d) => d.part === undefined || (d.part.size ?? 0) >= (c.size ?? 0));
  return (
    <div className="loc-card">
      <div className="loc-card-h"><h3><Cpu />Components</h3>{held && <span className="loc-muted">{held}</span>}</div>
      <table className="table loc-parts">
        <thead><tr><th>Part</th><th>Size</th><th>Slot</th><th>Age</th><th>Status</th><th /></tr></thead>
        {groupsOf(device).map((g) => {
          const filled = device.components.filter((c) => g.kinds.includes(c.kind));
          const empty = Math.max(0, g.slots - filled.length);
          const fitting = g.kinds.length ? spares(g.kinds).filter((d) => !fits(model, [...device.components.map(specOf), spareSpec(d)])) : [];
          const offers = fitting.filter((d, i) => fitting.findIndex((x) => samePart(spareSpec(x), spareSpec(d))) === i);
          const cold = (d: Device) => !!device.rackId && device.on && !hotKind(device, d.model.slice(5) as ComponentKind);
          return (
            <tbody key={g.name}>
              <tr className="loc-group"><th colSpan={6}>{g.name}<span className="num loc-muted"> {filled.length} of {g.slots}</span></th></tr>
              {filled.map((c, i) => {
                const life = COMPONENTS[c.kind].life, age = ageYears(game, c), worn = isWorn(game, c);
                const swap = device.maintenance?.componentId === c.id, rebuild = device.rebuild?.componentId === c.id;
                const status = swap ? <span className="pill">Swap at <span className="num">{clock(device.maintenance!.doneAt)}</span></span>
                  : c.failedAt !== null ? <span className="pill bad">Failed</span>
                  : rebuild ? <span className="pill warn">Rebuilding</span>
                  : worn ? <span className="pill warn">Worn</span> : <span className="pill ok">OK</span>;
                const busy = swap || held !== null || !device.rackId;
                const hot = hotSwappable(device, c);
                const block = busy ? null : !spareFor(c) ? (c.failedAt !== null || worn ? `No part in ${zone?.az ?? ""}` : "")
                  : device.on && !hot ? "Power off first" : null;
                const removable = c.kind !== "board" && c.kind !== "nic" && !swap && held === null;
                return (
                  <tr key={c.id}>
                    <td>{PART_NAME[c.kind]}</td>
                    <td className="num">{partSize(c)}</td>
                    <td className="num">{partSlot(c.kind, i + 1)}</td>
                    <td>
                      <span className={`loc-meter${worn ? " worn" : ""}`}>
                        <span className="loc-meter-bar"><span style={{ width: `${Math.min(1, age / life) * 100}%` }} /></span>
                        <span className="num">{age.toFixed(1)} / {life} y</span>
                      </span>
                    </td>
                    <td>{status}</td>
                    <td className="r">
                      <span className="loc-acts">
                        {busy ? null : block !== null ? <span className="loc-muted">{block}</span>
                          : <button className="btn" onClick={() => act((gm) => replaceComponent(gm, device.id, c.id))}>Replace</button>}
                        {!busy && spareFor(c) && <TechButton game={game} deviceId={device.id} kind="replace" componentId={c.id} />}
                        {removable && (device.rackId && device.on && !hot ? null : <button className="btn" onClick={() => act((gm) => removePart(gm, device.id, c.id))}>Remove</button>)}
                        {removable && !!device.rackId && <TechButton game={game} deviceId={device.id} kind="part" componentId={c.id} />}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {Array.from({ length: Math.min(empty, EMPTY_SHOWN) }, (_, i) => (
                <tr key={`e${i}`} className="loc-empty">
                  <td className="loc-muted">Empty</td>
                  <td className="num loc-muted">-</td>
                  <td className="num">{g.kinds.length ? partSlot(g.kinds[0], filled.length + i + 1) : `Slot ${i + 1}`}</td>
                  <td /><td />
                  <td className="r">{g.kinds.length > 0 && held === null && (
                    <button className="btn" aria-pressed={adding === g.name} onClick={() => setAdding(adding === g.name ? null : g.name)}><Plus />Add</button>
                  )}</td>
                </tr>
              ))}
              {empty > EMPTY_SHOWN && <tr><td colSpan={6} className="loc-muted">{empty - EMPTY_SHOWN} more empty</td></tr>}
              {adding === g.name && (
                <tr className="loc-add"><td colSpan={6}>
                  {offers.length ? (
                    <div className="loc-chips">
                      {offers.map((d) => {
                        const spec = spareSpec(d), n = fitting.filter((x) => samePart(spareSpec(x), spec)).length;
                        return (
                          <Fragment key={d.id}>
                            <button className="btn" disabled={cold(d)} onClick={() => { act((gm) => installPart(gm, device.id, d.id)); setAdding(null); }}>
                              {partLabel(spec)}{n > 1 && <span className="num"> × {n}</span>}
                            </button>
                            {!!device.rackId && <TechButton game={game} deviceId={device.id} kind="part" partId={d.id} />}
                          </Fragment>
                        );
                      })}
                      {offers.some(cold) && <span className="loc-muted">Power off first</span>}
                    </div>
                  ) : <span className="loc-muted">No fitting part in {zone?.az ?? ""}</span>}
                </td></tr>
              )}
            </tbody>
          );
        })}
      </table>
    </div>
  );
}
