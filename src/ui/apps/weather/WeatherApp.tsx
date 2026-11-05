import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { DATACENTERS } from "../../../sim/20-world/datacenters";
import { sky, temperature } from "../../../sim/20-world/weather";
import { playerAt } from "../../../sim/60-infra/handwork";
import { useStore } from "../../store";
import { cityName } from "../../cityName";
import { SkyIcon } from "./SkyIcon";
import "./weather.css";

export const degrees = (city: string, hour: number): string =>
  t("weather.degrees", { value: new Intl.NumberFormat(LOCALE).format(temperature(city, hour)) });

const CITIES = [...new Set(DATACENTERS.map((d) => d.city))].sort((a, b) => cityName(a).localeCompare(cityName(b), LOCALE));

export function WeatherApp() {
  const game = useStore((s) => s.game);
  const here = playerAt(game);
  return (
    <div className="weather">
      <section className="wx-now">
        <h2>{cityName(here.city)}</h2>
        <SkyIcon kind={sky(here.city, game.hour)} />
        <strong>{degrees(here.city, game.hour)}</strong>
        <span>{t(`weather.sky.${sky(here.city, game.hour)}`)}</span>
      </section>
      <ul className="wx-list">
        {game.locations.map((l) => {
          const k = sky(l.city, game.hour);
          return (
            <li key={l.id} className="wx-row">
              <SkyIcon kind={k} />
              <div className="wx-place"><b>{l.name}</b><span>{cityName(l.city)}, {t(`weather.sky.${k}`)}</span></div>
              <strong>{degrees(l.city, game.hour)}</strong>
              {l.id === here.id && <span className="wx-here">{t("weather.here")}</span>}
            </li>
          );
        })}
      </ul>
      <h3 className="wx-head">{t("weather.cities")}</h3>
      <ul className="wx-list">
        {CITIES.filter((c) => c !== here.city).map((c) => (
          <li key={c} className="wx-row wx-city">
            <SkyIcon kind={sky(c, game.hour)} />
            <div className="wx-place"><b>{cityName(c)}</b><span>{t(`weather.sky.${sky(c, game.hour)}`)}</span></div>
            <strong>{degrees(c, game.hour)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}
