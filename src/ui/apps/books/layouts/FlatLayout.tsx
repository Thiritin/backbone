import { Label, navProps } from "./Label";
import { BrandLogo } from "../../../art/logos";
import { ICONS, type LayoutProps } from "./types";
import "./flat.css";

// EightDesk and lexoffize: flat cloud software, a coloured sidebar and light cards.
export function FlatLayout({ v, entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-flat" data-vendor={v.id}>
      <nav className="bk-flat-side">
        <div className="bk-flat-brand"><BrandLogo brand={v.name} size={20} />{v.name}</div>
        {entries.map((e) => { const Icon = ICONS[e.id]; return <button key={e.id} {...navProps(e, active, pick)}><Icon /><Label e={e} /></button>; })}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
