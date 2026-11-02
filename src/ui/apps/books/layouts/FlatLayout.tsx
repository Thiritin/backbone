import { Label, navProps } from "./Label";
import { ICONS, type LayoutProps } from "./types";
import "./flat.css";

// sevDeck and lexoffize: flat cloud software, a coloured sidebar and light cards.
export function FlatLayout({ v, entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-flat" data-vendor={v.id}>
      <nav className="bk-flat-side">
        <div className="bk-flat-brand">{v.name}</div>
        {entries.map((e) => { const Icon = ICONS[e.id]; return <button key={e.id} {...navProps(e, active, pick)}><Icon /><Label e={e} /></button>; })}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
