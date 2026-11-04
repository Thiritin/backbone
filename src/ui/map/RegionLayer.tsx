import { useEffect, useLayoutEffect, useMemo, useState } from "react";
import { LOCALE } from "../../i18n/lang";
import { cityName } from "../cityName";
import { decode } from "./streets/decode";
import type { Detail } from "./detail";
import { loadRegion } from "./regions";
import { XF, Y } from "./WorldMap";

const KEYS = ["urban", "lake", "forest", "river", "stream", "rail", "second", "major"] as const;
const AREAS = new Set(["urban", "lake", "forest"]);
const r3 = (n: number) => Math.round(n * 1000) / 1000;
export const shape = (s: string, close: boolean) => (s ? decode(s).map((l) => "M" + l.map(([lon, lat]) => `${r3(XF(lon))} ${r3(Y(lat))}`).join("L") + (close ? "Z" : "")).join("") : "");
const LANGS = ["de", "fr", "es", "it", "pt"];
const label = (name: string, alt: string) => cityName(alt.split("|")[LANGS.indexOf(LOCALE.slice(0, 2))] || name);

// The merged path data of the patches loaded so far, one path per layer so overlapping patches never cover each other's roads.
const merge = (ds: Detail[]) => Object.fromEntries(KEYS.map((k) => [k, ds.map((d) => shape(d[k], AREAS.has(k))).join("")])) as Record<(typeof KEYS)[number], string>;
type Paths = ReturnType<typeof merge>;

function Ground({ p, cls, water }: { p: Paths; cls: string; water: boolean }) {
  return (
    <g className={cls}>
      <path className="rg-urban" d={p.urban} /><path className="rg-forest" d={p.forest} />
      {water && <><path className="rg-lake" d={p.lake} /><path className="rg-river" d={p.river} /><path className="rg-stream" d={p.stream} /></>}
      <path className="rg-rail" d={p.rail} />
      <path className="rg-second" d={p.second} /><path className="rg-major-case" d={p.major} /><path className="rg-major" d={p.major} />
    </g>
  );
}

// Regional ground between the street patch and the national map. want lists the patch codes in view; level is the smallest town class shown.
export function RegionLayer({ want, level, onDraw }: { want: string[]; level: number; onDraw: () => void }) {
  const [patches, setPatches] = useState<Record<string, Detail>>({});
  const [europe, setEurope] = useState<Detail | null>(null);
  useEffect(() => { void loadRegion("europe").then(setEurope); }, []);
  const key = want.join();
  useEffect(() => {
    let on = true;
    for (const c of want) if (!patches[c]) void loadRegion(c).then((d) => on && d && setPatches((p) => ({ ...p, [c]: d })));
    return () => { on = false; };
    // want is read through its key.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key]);
  const have = Object.keys(patches).sort().join();
  const shown = useMemo(() => Object.values(patches), [have]); // eslint-disable-line react-hooks/exhaustive-deps
  const eu = useMemo(() => (europe ? merge([europe]) : null), [europe]);
  const local = useMemo(() => merge(shown), [shown]);
  // Neighbouring patches share towns.
  const towns = useMemo(() => [...new Map([europe, ...shown].flatMap((d) => d?.towns ?? []).map((t) => [`${t[0]},${t[1]},${t[3]}`, t] as const)).values()].sort((a, b) => a[2] - b[2]), [europe, shown]);
  useLayoutEffect(() => { onDraw(); }, [towns, level]); // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <g className="rg">
      {eu && <Ground p={eu} cls="rg-eu" water={false} />}
      <Ground p={local} cls="rg-patch" water />
      <g className="rg-towns">
        {towns.filter((t) => t[2] <= level).map(([lon, lat, , name, alt]) => (
          <g key={`${lon},${lat},${name}`} className="rg-town" transform={`translate(${r3(XF(lon))} ${r3(Y(lat))})`}>
            <g className="wm-s"><circle r="1.8" /><text x="4.5" y="3.5">{label(name, alt)}</text></g>
          </g>
        ))}
      </g>
    </g>
  );
}
