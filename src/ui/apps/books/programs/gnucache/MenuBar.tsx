import { useEffect, useState } from "react";

export interface MenuItem { id: string; label: string; run: () => void; off?: boolean }
export interface MenuDef { id: string; label: string; items: MenuItem[] }

// The program's own menu bar: a click opens a menu, moving to a neighbour switches, a click elsewhere closes.
export function MenuBar({ menus }: { menus: MenuDef[] }) {
  const [open, setOpen] = useState<string | null>(null);
  useEffect(() => {
    if (!open) return;
    const away = (e: MouseEvent) => { if (!(e.target as HTMLElement).closest(".gc-menubar")) setOpen(null); };
    document.addEventListener("mousedown", away);
    return () => document.removeEventListener("mousedown", away);
  }, [open]);
  return (
    <div className="gc-menubar" role="menubar">
      {menus.filter((m) => m.items.length).map((m) => (
        <div key={m.id} className="gc-menu">
          <button role="menuitem" aria-haspopup="menu" aria-expanded={open === m.id} onClick={() => setOpen(open === m.id ? null : m.id)} onMouseEnter={() => open && setOpen(m.id)}>{m.label}</button>
          {open === m.id && (
            <div className="gc-drop" role="menu">
              {m.items.map((i) => <button key={i.id} role="menuitem" disabled={i.off} onClick={() => { setOpen(null); i.run(); }}>{i.label}</button>)}
            </div>
          )}
        </div>
      ))}
    </div>
  );
}
