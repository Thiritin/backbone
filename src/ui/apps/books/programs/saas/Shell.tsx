import { ChevronDown, Lock, Search, Settings } from "lucide-react";
import { useState, type ReactNode } from "react";
import "./saas.css";

export interface NavItem { id: string; label: string; icon: ReactNode; badge?: number; locked?: boolean }
export interface MenuItem { id: string; label: string; run: () => void }

// A dropdown that closes on pick.
function Drop({ cls, label, items, icon }: { cls: string; label: ReactNode; items: MenuItem[]; icon?: ReactNode }) {
  const [open, setOpen] = useState(false);
  return (
    <div className={cls}>
      <button type="button" aria-expanded={open} onClick={() => setOpen(!open)}>{icon}{label}<ChevronDown size={14} aria-hidden /></button>
      {open && <div className="sx-menu" role="menu">{items.map((m) => <button key={m.id} type="button" role="menuitem" onClick={() => { setOpen(false); m.run(); }}>{m.label}</button>)}</div>}
    </div>
  );
}

// The frame of a web bookkeeping app: left navigation, a top bar with the company switcher, search and quick create, and the page.
// cls carries the program's token class and its era variant.
export function SaasShell({ cls, brand, nav, active, onNav, company, companyMenu, query, onQuery, searchLabel, newLabel, newMenu, gear, children }: {
  cls: string; brand: ReactNode; nav: NavItem[]; active: string; onNav: (id: string) => void;
  company: string; companyMenu: MenuItem[]; query: string; onQuery: (q: string) => void; searchLabel: string;
  newLabel: string; newMenu: MenuItem[]; gear?: { label: string; run: () => void }; children: ReactNode;
}) {
  return (
    <div className={`sx ${cls}`}>
      <nav className="sx-nav" aria-label={String(brand)}>
        <div className="sx-brand">{brand}</div>
        <ul>
          {nav.map((n) => (
            <li key={n.id}>
              <button type="button" className={`sx-navitem${n.locked ? " locked" : ""}`} aria-current={n.id === active ? "page" : undefined} data-nav={n.id} onClick={() => onNav(n.id)}>
                {n.icon}<span>{n.label}</span>
                {n.locked ? <Lock size={13} aria-hidden /> : n.badge ? <span className="sx-badge num">{n.badge}</span> : null}
              </button>
            </li>
          ))}
        </ul>
      </nav>
      <div className="sx-main">
        <header className="sx-top">
          <Drop cls="sx-company" label={company} items={companyMenu} />
          <label className="sx-search"><Search aria-hidden /><input type="search" aria-label={searchLabel} placeholder={searchLabel} value={query} onChange={(e) => onQuery(e.target.value)} /></label>
          <Drop cls="sx-new" label={newLabel} items={newMenu} />
          {gear && <button type="button" className="sx-gear" aria-label={gear.label} title={gear.label} onClick={gear.run}><Settings aria-hidden /></button>}
        </header>
        <main className="sx-body">{children}</main>
      </div>
    </div>
  );
}
