import { t } from "../../../../../i18n/en";
import { Body, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./multikraft.css";

// MultiKraft: a dirt-brown header over dark grey with blocky headings; from 2018 white and green cards.
export function MultiKraft(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-multikraft ${look}`}>
      <header><span className="sw-wm"><SiteMark id="multikraft" name={p.name} size={32} color={look === "late" ? "#3e9b3e" : undefined} /> MultiKraft</span><Nav {...props} /></header>
      {page === "home" ? (
        <main>
          <h1>{p.site.tagline}</h1>
          <p className="lead">{p.site.blurb}</p>
          <Features p={p} className={look === "late" ? "cards" : "blocks"} />
        </main>
      ) : <main><Body {...props} /></main>}
      <footer>{t("browser-sites-1.mk.footer", { year })}</footer>
    </div>
  );
}
