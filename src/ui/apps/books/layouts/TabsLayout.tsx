import { Label, navProps } from "./Label";
import type { LayoutProps } from "./types";
import "./tabs.css";

// orgaMIN: orange, every area a tab along the top.
export function TabsLayout({ entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-tabs">
      <nav className="bk-tabs-row" role="tablist">
        {entries.map((e) => { const p = navProps(e, active, pick); return <button key={e.id} role="tab" aria-selected={e.id === active} {...p}><Label e={e} /></button>; })}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
