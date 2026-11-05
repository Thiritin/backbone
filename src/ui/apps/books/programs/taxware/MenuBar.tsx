import { useState } from "react";

// One menu entry; locked opens the vendor's editions page, sep draws a line above it.
export interface Item { id: string; label: string; run: () => void; locked?: boolean; checked?: boolean; sep?: boolean }
export interface Menu { id: string; label: string; items: Item[] }

// The program's own menu bar: a click opens a menu, hovering moves between open menus, leaving closes it.
export function MenuBar({ menus }: { menus: Menu[] }) {
  const [open, setOpen] = useState<string | null>(null);
  return (
    <nav className="txo-menubar" role="menubar" onMouseLeave={() => setOpen(null)} onKeyDown={(e) => e.key === "Escape" && setOpen(null)}>
      {menus.filter((m) => m.items.length).map((m) => (
        <div key={m.id} className="txo-menu">
          <button role="menuitem" aria-haspopup="menu" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)} onMouseEnter={() => open && setOpen(m.id)}>{m.label}</button>
          {open === m.id && (
            <div className="txo-drop" role="menu" aria-label={m.label}>
              {m.items.map((x) => (
                <button key={x.id} role={x.checked === undefined ? "menuitem" : "menuitemradio"} aria-checked={x.checked} className={x.sep ? "txo-sep" : undefined}
                  aria-disabled={x.locked || undefined} onClick={() => { setOpen(null); x.run(); }}>{x.label}</button>
              ))}
            </div>
          )}
        </div>
      ))}
    </nav>
  );
}
