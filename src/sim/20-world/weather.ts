import { dateOf } from "../00-core/time";
import { FIRST_YEAR, FRANKFURT, MONTH_OFFSET, YEARS } from "./weather-data";

export type Sky = "sun" | "partly" | "cloud" | "rain" | "snow";

const DAY = 86400000;

// The recorded Frankfurt mean of the in-game day; years past the data repeat it.
function frankfurt(hour: number): number {
  const d = dateOf(hour), m = d.getUTCMonth(), day = d.getUTCDate();
  const y = FIRST_YEAR + ((d.getUTCFullYear() - FIRST_YEAR) % YEARS + YEARS) % YEARS;
  const leap = new Date(Date.UTC(y, 1, 29)).getUTCMonth() === 1;
  const i = (Date.UTC(y, m, m === 1 && day === 29 && !leap ? 28 : day) - Date.UTC(FIRST_YEAR, 0, 1)) / DAY;
  return FRANKFURT.charCodeAt(i) - 68;
}

// Whole degrees Celsius in a city on the in-game day.
export const temperature = (city: string, hour: number): number =>
  frankfurt(hour) + (MONTH_OFFSET[city]?.[dateOf(hour).getUTCMonth()] ?? 0);

// The sky of a city on the in-game day: a pick per city and day, snow only when it is cold.
export function sky(city: string, hour: number): Sky {
  let h = Math.floor(hour / 24);
  for (const c of city) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  const cold = temperature(city, hour) <= 1;
  const picks: Sky[] = cold ? ["sun", "cloud", "snow", "snow", "cloud"] : ["sun", "sun", "partly", "cloud", "rain"];
  return picks[h % picks.length];
}
