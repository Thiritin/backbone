import { useState } from "react";
import { t } from "../../../../i18n/en";
import { Label, navProps } from "./Label";
import { GROUPS, type LayoutProps } from "./types";
import "./menus.css";

// Saga: a dense grey enterprise screen run from its menu bar.
export function MenusLayout({ entries, active, pick, children }: LayoutProps) {
  const [open, setOpen] = useState<string | null>(null);
  const current = entries.find((e) => e.id === active);
  return (
    <div className="bk-menus" onMouseLeave={() => setOpen(null)}>
      <nav className="bk-menus-bar" role="menubar">
        {GROUPS.map((g) => (
          <div key={g} className="bk-menus-menu">
            <button role="menuitem" aria-haspopup="menu" aria-expanded={open === g} onClick={() => setOpen(open === g ? null : g)}>{t(`books-editions.group.${g}`)}</button>
            {open === g && (
              <div className="bk-menus-drop" role="menu">
                {entries.filter((e) => e.group === g).map((e) => { const p = navProps(e, active, pick); return <button key={e.id} role="menuitem" {...p} onClick={() => { setOpen(null); p.onClick(); }}><Label e={e} /></button>; })}
              </div>
            )}
          </div>
        ))}
      </nav>
      {current && <div className="bk-menus-path">{t(`books-editions.group.${current.group}`)} › {t(`books.tab.${current.id}`)}</div>}
      <div className="bk-body">{children}</div>
    </div>
  );
}
