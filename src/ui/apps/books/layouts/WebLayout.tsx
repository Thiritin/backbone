import { Fragment } from "react";
import { BrandLogo } from "../../../art/logos";
import { Label, navProps } from "./Label";
import type { LayoutProps } from "./types";
import "./web.css";

// Kontomix: a plain web page with blue links and plain tables.
export function WebLayout({ v, entries, active, pick, children }: LayoutProps) {
  return (
    <div className="bk-web">
      <header className="bk-web-head"><BrandLogo brand={v.name} size={18} /><b>{v.name}</b></header>
      <nav className="bk-web-links">
        {entries.map((e, i) => <Fragment key={e.id}>{i > 0 && " | "}<a href={`#${e.id}`} {...navProps(e, active, pick)} onClick={(ev) => { ev.preventDefault(); pick(e.id); }}><Label e={e} /></a></Fragment>)}
      </nav>
      <div className="bk-body">{children}</div>
    </div>
  );
}
