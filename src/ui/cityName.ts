import { REGIONS } from "../sim/20-world/datacenters";
import { t } from "../i18n/en";

// A city as shown on screen; the stored value stays the English name.
export const cityName = (city: string): string => {
  const r = REGIONS.find((x) => x.city === city);
  return r ? t(`city.${r.id}`) : city;
};
