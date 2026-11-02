import type { CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { brandColor, Logo } from "../../../../art/logos";
import { A, Body, citiesOf, Nav, SitesList, titleOf, type ProviderProps } from "./ProviderSite";
import "./plain.css";

// The layout for a provider without its own design: the wordmark in the provider's colour, its cities and its sites.
export function Plain(props: ProviderProps) {
  const { p, look, route, go, year } = props;
  return (
    <div className={`ps ps-plain ${look}`} style={{ "--ps-accent": brandColor(p.id) } as CSSProperties}>
      <header>
        <A to="/" go={go} className="ps-wm"><Logo provider={p.id} size={22} word /></A>
        <Nav route={route} go={go} />
      </header>
      <main>
        {route.page === "home" ? <>
          <section className="pl-hero">
            <h1>{t("providers.plainHero", { cities: citiesOf(p.id).join(", ") })}</h1>
            <A to="/order" go={go} className="ps-btn pri">{t("providers.order")}</A>
          </section>
          <h2>{t("providers.sites")}</h2>
          <SitesList p={p} go={go} />
        </> : <>
          <h1>{titleOf(route)}</h1>
          <Body {...props} />
        </>}
      </main>
      <footer>© {year} {p.name}</footer>
    </div>
  );
}
