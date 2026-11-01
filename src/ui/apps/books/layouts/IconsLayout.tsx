import { Label, navProps } from "./Label";
import { ICONS, type LayoutProps } from "./types";
import "./icons.css";

// WIZO: a friendly blue program with a row of large icons on top.
export function IconsLayout({ entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-icons">
      <nav className="bk-icons-row">
        {entries.map((e) => { const Icon = ICONS[e.id]; return <button key={e.id} {...navProps(e, active, pick)}><Icon /><span><Label e={e} /></span></button>; })}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
