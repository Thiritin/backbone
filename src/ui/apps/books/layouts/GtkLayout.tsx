import { t } from "../../../../i18n/en";
import { Label, navProps } from "./Label";
import { GROUPS, ICONS, type LayoutProps } from "./types";
import "./gtk.css";

// GnuCache: a GTK2 grey window, a toolbar of labelled buttons, the account tree and the register beside it.
export function GtkLayout({ entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-gtk">
      <div className="bk-gtk-tools" role="toolbar">
        {entries.filter((e) => e.group !== "reports").map((e) => { const Icon = ICONS[e.id]; return <button key={e.id} {...navProps(e, active, pick)}><Icon /><Label e={e} /></button>; })}
      </div>
      <div className="bk-gtk-split">
        <nav className="bk-gtk-tree" role="tree">
          <div className="bk-gtk-head">{t("books-editions.accounts")}</div>
          {GROUPS.map((g) => (
            <div key={g} role="group">
              <div className="bk-gtk-node">{t(`books-editions.group.${g}`)}</div>
              {entries.filter((e) => e.group === g).map((e) => <button key={e.id} role="treeitem" className="bk-gtk-leaf" {...navProps(e, active, pick)}><Label e={e} /></button>)}
            </div>
          ))}
        </nav>
        <div className="bk-body">{children}</div>
      </div>
    </div>
  );
}
