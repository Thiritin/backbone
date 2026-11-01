import { Fragment } from "react";
import { booksHost } from "../../../../sim/80-business/bookkeeping";
import { Label, navProps } from "./Label";
import type { LayoutProps } from "./types";
import "./web.css";

// Collmix: a plain web page inside the window, an address bar, blue links and plain tables.
export function WebLayout({ v, entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-web">
      <div className="bk-web-url num">{`https://www.${booksHost(v)}/app?view=${active}`}</div>
      <header className="bk-web-head"><b>{v.name}</b></header>
      <nav className="bk-web-links">
        {entries.map((e, i) => <Fragment key={e.id}>{i > 0 && " | "}<a href={`#${e.id}`} {...navProps(e, active, pick)} onClick={(ev) => { ev.preventDefault(); pick(e.id); }}><Label e={e} /></a></Fragment>)}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
