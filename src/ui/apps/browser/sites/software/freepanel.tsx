import { t } from "../../../../../i18n/en";
import { Body, Features, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./freepanel.css";

// FreePanel: a grey project page with a left list of links; from 2016 a README on a code host.
export function FreePanel(props: SiteProps) {
  const { p, look, page, year } = props;
  if (look === "late") {
    return (
      <div className="sw sw-freepanel late">
        <header><span className="repo"><SiteMark id="freepanel" name={p.name} size={20} /> freepanel / <b>freepanel</b></span><Nav {...props} className="sw-tabs" labels={{ home: t("browser-sites-1.fp.code"), features: t("browser-sites-1.fp.wiki"), pricing: t("browser-sites-1.fp.license"), download: t("browser-sites-1.fp.releases") }} /></header>
        <article>
          <div className="file">README.md</div>
          {page === "home" ? (
            <div className="md">
              <h1># FreePanel</h1>
              <p>{t("browser-sites-1.fp.tag", { tagline: p.site.tagline })} {p.site.blurb}</p>
              <h2>## Features</h2>
              <Features p={p} />
            </div>
          ) : <div className="md"><Body {...props} /></div>}
        </article>
      </div>
    );
  }
  return (
    <div className="sw sw-freepanel early">
      <header><SiteMark id="freepanel" name={p.name} size={32} /><span>FreePanel</span><small>{t("browser-sites-1.fp.hosted")}</small></header>
      <div className="cols">
        <aside><b>{t("browser-sites-1.fp.project")}</b><Nav {...props} labels={{ download: t("browser-sites-1.fp.download") }} /><b>{t("browser-sites-1.fp.support")}</b><p>{t("browser-sites-1.fp.support0")}<br />{t("browser-sites-1.fp.support1")}<br />{t("browser-sites-1.fp.support2")}</p></aside>
        <main><h1>{p.site.tagline}</h1><Body {...props} /><p className="foot">{t("browser-sites-1.fp.foot", { year })}</p></main>
      </div>
    </div>
  );
}
