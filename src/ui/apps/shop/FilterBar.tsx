import { useSessionState } from "../../session";
import type { DeviceModel } from "../../../sim/10-catalog/hardware";
import { ram } from "../hw";
import { CORES, DISKS, FORMS, isSet, matchesFilter, NO_FILTER, RAMS, type Filter } from "./filter";

export function useFilter(): [Filter, (patch: Partial<Filter>) => void, () => void] {
  const [form, setForm] = useSessionState<string | null>("shop.filter.form", null);
  const [cores, setCores] = useSessionState("shop.filter.cores", 0);
  const [mem, setMem] = useSessionState("shop.filter.ram", 0);
  const [disk, setDisk] = useSessionState<string | null>("shop.filter.disk", null);
  const set = (p: Partial<Filter>) => {
    if ("form" in p) setForm(p.form!);
    if ("cores" in p) setCores(p.cores!);
    if ("ram" in p) setMem(p.ram!);
    if ("disk" in p) setDisk(p.disk!);
  };
  return [{ form, cores, ram: mem, disk }, set, () => set(NO_FILTER)];
}

// Each option shows how many of `models` stay when it is chosen with the other filters kept.
export function ShopFilter({ models, filter, set, clear }: { models: DeviceModel[]; filter: Filter; set: (p: Partial<Filter>) => void; clear: () => void }) {
  const left = (p: Partial<Filter>) => models.filter((m) => matchesFilter(m, { ...filter, ...p })).length;
  const chips = (key: "form" | "disk", label: string, options: string[]) => (
    <div className="shop-filter-row">
      <span className="shop-filter-h">{label}</span>
      {options.map((o) => (
        <button key={o} className="shop-chip" data-empty={!left({ [key]: o })} aria-pressed={filter[key] === o} onClick={() => set({ [key]: filter[key] === o ? null : o })}>
          {o}<span className="num">{left({ [key]: o })}</span>
        </button>
      ))}
    </div>
  );
  const steps = (key: "cores" | "ram", label: string, options: number[], text: (n: number) => string) => (
    <div className="shop-filter-row">
      <span className="shop-filter-h">{label}</span>
      <div className="seg" role="group" aria-label={label}>
        {options.map((o) => (
          <button key={o} data-empty={!left({ [key]: o })} aria-pressed={filter[key] === o} onClick={() => set({ [key]: o })}>
            {o ? text(o) : "Any"}<span className="num shop-filter-n">{left({ [key]: o })}</span>
          </button>
        ))}
      </div>
    </div>
  );
  return (
    <div className="shop-filter">
      {chips("form", "Form factor", FORMS)}
      {steps("cores", "Min cores", CORES, String)}
      {steps("ram", "Min RAM", RAMS, ram)}
      {chips("disk", "Disk", DISKS)}
      {isSet(filter) && <button className="shop-chip" onClick={clear}>Clear</button>}
    </div>
  );
}
