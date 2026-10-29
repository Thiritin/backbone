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
  const pick = <K extends keyof Filter>(key: K, label: string, options: Filter[K][], text: (o: NonNullable<Filter[K]>) => string, any: Filter[K]) => (
    <label className="shop-filter-row">
      <span className="shop-filter-h">{label}</span>
      <select value={String(filter[key] ?? "")} onChange={(e) => set({ [key]: options.find((o) => String(o ?? "") === e.target.value) ?? any })}>
        {[any, ...options.filter((o) => o !== any)].map((o) => (
          <option key={String(o)} value={String(o ?? "")}>{o === any ? "Any" : text(o!)} ({left({ [key]: o })})</option>
        ))}
      </select>
    </label>
  );
  return (
    <div className="shop-filter">
      {pick("form", "Form factor", FORMS, String, null)}
      {pick("cores", "Min cores", CORES, String, 0)}
      {pick("ram", "Min RAM", RAMS, ram, 0)}
      {pick("disk", "Disk", DISKS, String, null)}
      {isSet(filter) && <button className="shop-chip" onClick={clear}>Clear</button>}
    </div>
  );
}
