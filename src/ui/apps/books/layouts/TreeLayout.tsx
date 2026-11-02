import { t } from "../../../../i18n/en";
import { Label, navProps } from "./Label";
import { GROUPS, ICONS, type LayoutProps } from "./types";
import "./tree.css";

// Lexwear: a grey Windows 2000 program, a row of small icons on top and the folder tree on the left.
export function TreeLayout({ entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-tree">
      <div className="bk-tree-tools" role="toolbar">
        {entries.map((e) => { const Icon = ICONS[e.id]; return <button key={e.id} title={t(`books.tab.${e.id}`)} {...navProps(e, active, pick)}><Icon /></button>; })}
      </div>
      <div className="bk-tree-split">
        <nav className="bk-tree-nav">
          {GROUPS.map((g) => (
            <div key={g} role="group" aria-label={t(`books-editions.group.${g}`)}>
              <div className="bk-tree-folder">{t(`books-editions.group.${g}`)}</div>
              {entries.filter((e) => e.group === g).map((e) => <button key={e.id} className="bk-tree-leaf" {...navProps(e, active, pick)}><Label e={e} /></button>)}
            </div>
          ))}
        </nav>
        <div className="bk-body">{children}</div>
      </div>
    </div>
  );
}
