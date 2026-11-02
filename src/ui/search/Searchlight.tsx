import { Search } from "lucide-react";
import { openCustomer } from "../apps/customers/open";
import { Fragment, useEffect, useMemo, useRef, useState } from "react";
import { useStore } from "../store";
import { t } from "../../i18n/en";
import { groupLabel, search, type Hit } from "./hits";
import "./searchlight.css";

// Ctrl+K and Cmd+K open the field once Searchlight is installed; Escape or a click outside closes it.
export function Searchlight() {
  const game = useStore((s) => s.game), openApp = useStore((s) => s.openApp);
  const owned = game.installed.includes("searchlight");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [at, setAt] = useState(0);
  const list = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!owned) return;
    const key = (e: KeyboardEvent) => {
      if (!(e.ctrlKey || e.metaKey) || e.key.toLowerCase() !== "k") return;
      if ((e.target as HTMLElement).closest("input, textarea, select, [role=alertdialog], [role=dialog], [role=menu]")) return;
      e.preventDefault();
      setQuery(""); setAt(0); setOpen(true);
    };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [owned]);

  const hits = useMemo(() => (open ? search(game, query) : []), [open, game, query]);
  useEffect(() => { list.current?.querySelector("[aria-selected=true]")?.scrollIntoView({ block: "nearest" }); }, [at, hits]);
  if (!owned || !open) return null;

  const go = (h: Hit | undefined) => {
    if (!h) return;
    setOpen(false);
    if (h.target?.kind === "customer") openCustomer(h.target.id);
    else openApp(h.app, h.target);
  };
  const onKey = (e: React.KeyboardEvent) => {
    if (e.key === "Escape" || ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k")) { e.preventDefault(); setOpen(false); }
    else if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (hits.length) setAt((at + (e.key === "ArrowDown" ? 1 : -1) + hits.length) % hits.length);
    } else if (e.key === "Enter") { e.preventDefault(); go(hits[at]); }
  };

  return (
    <div className="sl-backdrop" onPointerDown={() => setOpen(false)}>
      <div className="sl" role="dialog" aria-label={t("misc1.search.title")} onPointerDown={(e) => e.stopPropagation()}>
        <label className="sl-field">
          <Search />
          <input autoFocus role="combobox" aria-label={t("misc1.search.search")} aria-expanded={hits.length > 0} aria-controls="sl-list" aria-activedescendant={hits.length ? `sl-${at}` : undefined}
            value={query} spellCheck={false} autoComplete="off" onChange={(e) => { setQuery(e.target.value); setAt(0); }} onKeyDown={onKey} />
        </label>
        {hits.length > 0 && (
          <div className="sl-list" id="sl-list" role="listbox" ref={list}>
            {hits.map((h, i) => (
              <Fragment key={`${h.group}:${h.id}`}>
                {h.group !== hits[i - 1]?.group && <div className="sl-group" role="presentation">{groupLabel(h.group)}</div>}
                <div id={`sl-${i}`} role="option" aria-selected={i === at} className="sl-hit" onPointerMove={() => at !== i && setAt(i)} onClick={() => go(h)}>
                  <span className="sl-title">{h.title}</span>
                  {h.sub && <span className="sl-sub">{h.sub}</span>}
                </div>
              </Fragment>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
