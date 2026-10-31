import { Car } from "lucide-react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { euro } from "../../../sim/00-core/money";
import { sky, temperature } from "../../../sim/20-world/weather";
import { playerAt } from "../../../sim/60-infra/handwork";
import { drive, travelTo } from "../../../sim/90-actions/travel";
import { useStore } from "../../store";
import { SkyIcon } from "./SkyIcon";
import "./weather.css";

export const degrees = (city: string, hour: number): string =>
  t("weather.degrees", { value: new Intl.NumberFormat(LOCALE).format(temperature(city, hour)) });

export function WeatherApp() {
  const game = useStore((s) => s.game);
  const act = useStore((s) => s.act);
  const here = playerAt(game);
  return (
    <div className="weather">
      <section className="wx-now">
        <h2>Frankfurt</h2>
        <SkyIcon kind={sky("Frankfurt", game.hour)} />
        <strong>{degrees("Frankfurt", game.hour)}</strong>
        <span>{t(`weather.sky.${sky("Frankfurt", game.hour)}`)}</span>
      </section>
      <ul className="wx-list">
        {game.locations.map((l) => {
          const d = l.id !== here.id && drive(game, l.id), k = sky(l.city, game.hour);
          return (
            <li key={l.id} className="wx-row">
              <SkyIcon kind={k} />
              <div className="wx-place"><b>{l.name}</b><span>{l.city}, {t(`weather.sky.${k}`)}</span></div>
              <strong>{degrees(l.city, game.hour)}</strong>
              {l.id === here.id ? <span className="wx-here">{t("weather.here")}</span> : d && (
                <button className="wx-drive" onClick={() => act(travelTo, l.id)}>
                  <Car /><span>{t("weather.drive")}</span><small>{t("weather.driveCost", { hours: d.hours, fee: euro(d.fee) })}</small>
                </button>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}
