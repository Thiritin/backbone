import { Check, ChevronRight } from "lucide-react";
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { createPortal } from "react-dom";
import { create } from "zustand";
import { place, step, tidy, type MenuEntry, type MenuItem } from "./menu";

export type { MenuEntry, MenuItem } from "./menu";

const useMenu = create<{ menu: { x: number; y: number; items: (MenuItem | null)[]; n: number } | null }>(() => ({ menu: null }));
export const closeMenu = () => useMenu.setState({ menu: null });

export function openMenu(x: number, y: number, entries: MenuEntry[]) {
  const items = tidy(entries);
  useMenu.setState((s) => ({ menu: items.length ? { x, y, items, n: (s.menu?.n ?? 0) + 1 } : null }));
}

// Opens the menu at the pointer on right-click, or under the button on a click, so a three-dot button shares it.
export function menuOn(entries: () => MenuEntry[]) {
  return (e: ReactMouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "contextmenu") return openMenu(e.clientX, e.clientY, entries());
    const r = e.currentTarget.getBoundingClientRect();
    openMenu(r.left, r.bottom + 4, entries());
  };
}

export function ContextMenuHost() {
  const menu = useMenu((s) => s.menu);
  useEffect(() => {
    if (!menu) return;
    const outside = (e: Event) => { if (!(e.target as Element).closest?.(".ctx")) closeMenu(); };
    window.addEventListener("pointerdown", outside, true);
    window.addEventListener("wheel", outside, true);
    window.addEventListener("scroll", outside, true);
    window.addEventListener("blur", closeMenu);
    window.addEventListener("resize", closeMenu);
    return () => {
      window.removeEventListener("pointerdown", outside, true);
      window.removeEventListener("wheel", outside, true);
      window.removeEventListener("scroll", outside, true);
      window.removeEventListener("blur", closeMenu);
      window.removeEventListener("resize", closeMenu);
    };
  }, [menu]);
  if (!menu) return null;
  return createPortal(<Panel key={menu.n} items={menu.items} x={menu.x} y={menu.y} onBack={closeMenu} root />, document.querySelector(".desktop")!);
}

function Panel({ items, x, y, flipX, onBack, root }: { items: (MenuItem | null)[]; x: number; y: number; flipX?: number; onBack: () => void; root?: boolean }) {
  const ref = useRef<HTMLDivElement>(null);
  const [at, setAt] = useState<{ left: number; top: number } | null>(null);
  const [active, setActive] = useState(-1);
  const [sub, setSub] = useState<{ i: number; x: number; y: number; flipX: number; keyed: boolean } | null>(null);
  useLayoutEffect(() => {
    const r = ref.current!.getBoundingClientRect();
    setAt(place(x, y, r.width, r.height, innerWidth, innerHeight, flipX));
  }, [x, y, flipX]);
  // A hidden element takes no focus, so focus waits for the measured position.
  useEffect(() => { if (at) ref.current?.focus(); }, [at]);
  useEffect(() => { if (active >= 0) ref.current?.querySelectorAll<HTMLElement>(":scope > [role^=menuitem]")[items.slice(0, active).filter(Boolean).length]?.focus(); }, [active, items]);

  const openSub = (i: number, keyed: boolean) => {
    const el = ref.current!.querySelectorAll<HTMLElement>(":scope > [role^=menuitem]")[items.slice(0, i).filter(Boolean).length];
    const r = el.getBoundingClientRect();
    setSub({ i, x: r.right + 2, y: r.top - 5, flipX: r.left - 2, keyed });
  };
  const choose = (i: number, keyed = false) => {
    const it = items[i];
    if (!it || it.disabled) return;
    if (it.items) return openSub(i, keyed);
    closeMenu();
    it.run?.();
  };
  const key = (e: React.KeyboardEvent) => {
    if (sub) return;
    const k = e.key;
    if (k === "ArrowDown" || k === "ArrowUp") setActive(step(items, active, k === "ArrowDown" ? 1 : -1));
    else if (k === "Enter" || k === " " || (k === "ArrowRight" && items[active]?.items)) { if (active >= 0) choose(active, true); }
    else if (k === "Escape" || (k === "ArrowLeft" && !root)) onBack();
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  return (
    <>
      <div ref={ref} className="ctx" role="menu" tabIndex={-1} onKeyDown={key} onContextMenu={(e) => e.preventDefault()}
        onPointerLeave={() => { if (!sub) setActive(-1); }}
        style={at ? { left: at.left, top: at.top } : { left: x, top: y, visibility: "hidden" }}>
        {items.map((it, i) => it === null ? <div key={i} className="ctx-sep" role="separator" /> : (
          <button key={i} role={it.checked === undefined ? "menuitem" : "menuitemcheckbox"} aria-checked={it.checked} aria-disabled={it.disabled || undefined}
            aria-haspopup={it.items ? "menu" : undefined} aria-expanded={it.items ? sub?.i === i : undefined} tabIndex={-1}
            className={i === active ? "on" : undefined}
            onPointerEnter={() => { if (it.disabled) return; setActive(i); if (it.items) openSub(i, false); else setSub(null); }}
            onClick={() => choose(i)}>
            <span className="ctx-check">{it.checked && <Check />}</span>
            <span className="ctx-label">{it.label}</span>
            {it.items && <ChevronRight className="ctx-more" />}
          </button>
        ))}
      </div>
      {sub && items[sub.i]?.items && (
        <Panel key={sub.i} items={tidy(items[sub.i]!.items!)} x={sub.x} y={sub.y} flipX={sub.flipX}
          onBack={() => { setSub(null); ref.current?.focus(); setActive(sub.i); }} />
      )}
    </>
  );
}
