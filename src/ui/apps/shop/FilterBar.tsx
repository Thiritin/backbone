import { useSessionState } from "../../session";
import type { DeviceModel, PartSpec } from "../../../sim/10-catalog/hardware";
import { VENDOR_NAME, VENDORS, type Vendor } from "../../../sim/10-catalog/cpus";
import { ram } from "../hw";
import { CORES, DISKS, FORMS, isSet, matchesFilter, NO_FILTER, RAMS, SORTS, type Filter, type Sort } from "./filter";

export function useFilter(): [Filter, (patch: Partial<Filter>) => void, () => void] {
  const [form, setForm] = useSessionState<string | null>("shop.filter.form", null);
  const [cores, setCores] = useSessionState("shop.filter.cores", 0);
  const [mem, setMem] = useSessionState("shop.filter.ram", 0);
  const [disk, setDisk] = useSessionState<string | null>("shop.filter.disk", null);
  const [vendor, setVendor] = useSessionState<Vendor | null>("shop.filter.vendor", null);
  const set = (p: Partial<Filter>) => {
    if ("form" in p) setForm(p.form!);
    if ("cores" in p) setCores(p.cores!);
    if ("ram" in p) setMem(p.ram!);
    if ("disk" in p) setDisk(p.disk!);
    if ("vendor" in p) setVendor(p.vendor!);
  };
  return [{ form, cores, ram: mem, disk, vendor }, set, () => set(NO_FILTER)];
}

// Each option shows how many of `items` stay when it is chosen with the other filters kept.
export function ShopFilter({ items, filter, set, clear, sort, setSort }: { sort: Sort; setSort: (s: Sort) => void; items: { model: DeviceModel; part?: PartSpec }[]; filter: Filter; set: (p: Partial<Filter>) => void; clear: () => void }) {
  const left = (p: Partial<Filter>) => items.filter((it) => matchesFilter(it.model, { ...filter, ...p }, it.part)).length;
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
  const vendors = VENDORS.filter((v) => filter.vendor === v || left({ vendor: v }) > 0);
  return (
    <div className="shop-filter">
      <label className="shop-filter-row">
        <span className="shop-filter-h">Sort</span>
        <select value={sort} onChange={(e) => setSort(e.target.value as Sort)}>
          {SORTS.map(([k, label]) => <option key={k} value={k}>{label}</option>)}
        </select>
      </label>
      {pick("form", "Form factor", FORMS, String, null)}
      {pick("cores", "Min cores", CORES, String, 0)}
      {pick("ram", "Min RAM", RAMS, ram, 0)}
      {pick("disk", "Disk", DISKS, String, null)}
      {vendors.length > 0 && (
        <div className="shop-filter-row" role="group" aria-label="Vendor">
          <span className="shop-filter-h">Vendor</span>
          {vendors.map((v) => (
            <button key={v} className="shop-chip" aria-pressed={filter.vendor === v} onClick={() => set({ vendor: filter.vendor === v ? null : v })}>
              {VENDOR_NAME[v]} <span className="num">{left({ vendor: v })}</span>
            </button>
          ))}
        </div>
      )}
      {isSet(filter) && <button className="shop-chip" onClick={clear}>Clear</button>}
    </div>
  );
}
