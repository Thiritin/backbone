import { t } from "../../../../../i18n/en";
import { Body, Nav, type SiteProps } from "./SoftwareSite";
import { SiteMark } from "./marks";
import "./openveezee.css";

const TITLE = { home: t("browser-sites-1.oz.main"), features: t("browser-sites-1.oz.features"), pricing: t("browser-sites-1.oz.license"), download: t("browser-sites-1.oz.download"), cart: t("vendor-shop.cart", { n: 0 }), account: t("vendor-shop.myAccount") } as const;

// OpenVeeZee: a project wiki with a grey sidebar; 2016 adds a blue header band.
export function OpenVeeZee(props: SiteProps) {
  const { p, look, page, year } = props;
  return (
    <div className={`sw sw-openveezee ${look}`}>
      {look === "late" && <div className="band"><SiteMark id="openveezee" name={p.name} size={22} /> {t("browser-sites-1.oz.wiki")}</div>}
      <div className="wiki">
        <aside>
          <div className="sw-logo"><SiteMark id="openveezee" name={p.name} size={64} /><span>OpenVeeZee</span></div>
          <h3>{t("browser-sites-1.oz.nav")}</h3>
          <Nav {...props} labels={{ home: TITLE.home, pricing: TITLE.pricing }} />
          <h3>{t("browser-sites-1.oz.toolbox")}</h3>
          <p>{t("browser-sites-1.oz.links")}<br />{t("browser-sites-1.oz.print")}</p>
        </aside>
        <main>
          <div className="sw-tabs"><span className="on">{t("browser-sites-1.oz.page")}</span><span>{t("browser-sites-1.oz.discussion")}</span><span>{t("browser-sites-1.oz.source")}</span><span>{t("browser-sites-1.oz.history")}</span></div>
          <h1>{TITLE[page]}</h1>
          {page === "home" && <p className="lead"><b>{t("browser-sites-1.oz.tag", { tagline: p.site.tagline })}</b></p>}
          <Body {...props} />
          <p className="mod">{t("browser-sites-1.oz.modified", { year })}</p>
        </main>
      </div>
    </div>
  );
}
