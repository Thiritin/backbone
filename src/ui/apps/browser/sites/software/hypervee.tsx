import { t } from "../../../../../i18n/en";
import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./hypervee.css";

const CRUMB = { home: t("browser-sites-1.hv.overview"), features: t("browser-sites-1.hv.new"), pricing: t("browser-sites-1.hv.licensing"), download: t("browser-sites-1.hv.installing"), cart: t("vendor-shop.cart", { n: 0 }), account: t("vendor-shop.myAccount") } as const;

// HyperVee: the dense 2008 library page with breadcrumbs; from 2016 the flat docs page with a left tree.
export function HyperVee(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-hypervee ${look}`}>
      <header><span className="corp"><SiteMark id="hypervee" name={p.name} size={18} /> {t(look === "early" ? "browser-sites-1.hv.corpEarly" : "browser-sites-1.hv.corpLate")}</span></header>
      <div className="cols">
        <aside>
          {look === "late" && <p className="tree">Windoors Server<br />&nbsp;&nbsp;{t("browser-sites-1.hv.virt")}<br />&nbsp;&nbsp;&nbsp;&nbsp;HyperVee</p>}
          <Nav {...props} labels={CRUMB} />
        </aside>
        <main>
          <p className="crumb">{t("browser-sites-1.hv.crumb", { page: CRUMB[page] })}</p>
          <h1>{t("browser-sites-1.hv.title", { page: CRUMB[page] })}</h1>
          {page === "home" && <p><b>{t("browser-sites-1.hv.tag", { tagline: p.site.tagline })}</b> {t("browser-sites-1.hv.applies")}</p>}
          <Body {...props} />
          <p className="foot">{t("browser-sites-1.hv.foot", { year })}</p>
        </main>
      </div>
    </div>
  );
}
