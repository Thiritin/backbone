// GDD, Own datacenter, Service doors: the transformer room and the meet-me room drawn large. An empty spot carries a paper tag with
// its price; the tag opens a slip, and signing it buys the part or builds the carrier in. Bought parts are drawn in place.
import { useState } from "react";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { HALL } from "../../sim/20-world/properties";
import type { Location } from "../../sim/50-state";
import { buildCarrier, cityCarriers, hallAt } from "../../sim/90-actions/hall";
import { useStore } from "../store";
import { Slab } from "./panel/Slab";
import "./hall.css";

// A stable colour for a carrier or an exchange.
export const hueOf = (id: string): number => [...id].reduce((h, c) => (h * 31 + c.charCodeAt(0)) % 360, 7);

interface Offer { key: string; name: string; price: number; monthly?: number; run: () => { ok: boolean; error?: string } }

function Slip({ offer, onDone }: { offer: Offer; onDone: () => void }) {
  const [refused, setRefused] = useState<string | null>(null);
  const sign = () => { const r = offer.run(); if (r.ok) onDone(); else setRefused(r.error ?? "error.noCash"); };
  return (
    <div className="wr-tag wr-slip hd-slip" data-slip="">
      <div className="wr-tag-body">
        <div className="wr-tag-h"><strong>{offer.name}</strong></div>
        <div className="wr-model">{euro(offer.price)}{offer.monthly ? ` · ${t("locations-2.perMonth", { amount: euro(offer.monthly) })}` : ""}</div>
        <div className="wr-lines">
          <button className="wr-line" onClick={sign}>{t("hall.door.buy")}</button>
          <button className="wr-line" onClick={onDone}>{t("locations-2.cancel")}</button>
        </div>
        {refused && <div className="wr-model hd-refused" role="alert">{t(refused)}</div>}
      </div>
    </div>
  );
}


// One carrier's fiber duct coming through the wall in its colour; a built one runs on to the patch rack.
function Duct({ hue, built }: { hue: number; built: boolean }) {
  const c = `oklch(0.66 0.15 ${hue})`, d = `oklch(0.42 0.1 ${hue})`;
  return (
    <svg className="wp-art hd-art" viewBox="0 0 100 150" width="110" aria-hidden>
      <rect className="hd-wall" x="0" y="0" width="100" height="150" />
      <rect x="38" y="0" width="24" height="96" rx="2" style={{ fill: built ? c : "oklch(0.5 0.01 250)" }} />
      <rect x="38" y="0" width="7" height="96" style={{ fill: built ? d : "oklch(0.4 0.01 250)" }} />
      <rect className="hd-collar" x="32" y="90" width="36" height="9" rx="1" />
      {built
        ? <><path d="M50,99 V128" style={{ stroke: c, strokeWidth: 3, fill: "none" }} /><rect className="hd-jack" x="40" y="128" width="20" height="12" rx="1" /><rect className="w-led w-led-on" x="46" y="132" width="3" height="2" /></>
        : <rect className="hd-cap" x="40" y="99" width="20" height="10" rx="1" />}
    </svg>
  );
}

// The meet-me room: one duct per carrier of the city. Without a meet-me area nothing can be built in.
export function MeetMeRoom({ loc, title, onClose }: { loc: Location; title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt), [slip, setSlip] = useState<string | null>(null);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const zone = h.hall.zones.some((z) => z.kind === "meetme");
  const offer = (id: string, name: string): Offer => ({ key: id, name, price: HALL.carrierFee, run: () => attempt(buildCarrier, loc.id, id) });
  const carriers = cityCarriers(loc.city), open = carriers.find((c) => c.id === slip);
  return (
    <Slab title={title} onClose={onClose} data={{ "door-panel": "meetme" }}>
      <div className="wp-scene hd-room">
        <div className="hd-row">
          {carriers.map((c) => {
            const built = h.hall.carriers.includes(c.id);
            return (
              <div key={c.id} className="wp-unit hd-spot">
                <Duct hue={hueOf(c.id)} built={built} />
                {built || !zone
                  ? <span className="wp-label"><b>{c.name}</b>{!built && <span>{t("hall.door.noMeetMe")}</span>}</span>
                  : <button onClick={() => setSlip(slip === c.id ? null : c.id)} aria-expanded={slip === c.id}><span className="wp-label"><b>{c.name}</b><span className="num">{euro(HALL.carrierFee)}</span></span></button>}
              </div>
            );
          })}
        </div>
        {open && <Slip offer={offer(open.id, open.name)} onDone={() => setSlip(null)} />}
      </div>
    </Slab>
  );
}
