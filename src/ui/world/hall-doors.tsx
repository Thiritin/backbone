// GDD, Own datacenter, Service doors: the main distribution board and the meet-me room drawn large. An unbuilt carrier carries a paper
// tag with its price; the tag opens a slip, and signing it builds the carrier in. A built carrier shows a patch lead to a tag for each
// customer cross-connected to it. The board shows the load per transformer, the backup and the main breaker.
import { useState } from "react";
import { t } from "../../i18n/en";
import { euro } from "../../sim/00-core/money";
import { HALL, isHalle } from "../../sim/20-world/properties";
import { airflow } from "../../sim/60-infra/airflow";
import { hallBackupMinutes } from "../../sim/60-infra/incidents";
import type { Location } from "../../sim/50-state";
import { resetBreaker } from "../../sim/90-actions/hardware";
import { buildCarrier, cityCarriers, hallAt, unmaintained } from "../../sim/90-actions/hall";
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


// One carrier's fiber duct coming through the wall in its colour; a built one runs on to the patch rack, an unbuilt one ends in a cap.
function Duct({ hue, built }: { hue: number; built: boolean }) {
  const c = `oklch(0.66 0.15 ${hue})`, d = `oklch(0.42 0.1 ${hue})`, pale = `oklch(0.78 0.06 ${hue})`, paleD = `oklch(0.6 0.06 ${hue})`;
  return (
    <svg className="wp-art hd-art" viewBox="0 0 100 130" width="100" aria-hidden>
      <rect className="hd-wall" x="0" y="0" width="100" height="130" />
      <rect x="38" y="0" width="24" height={built ? 96 : 70} rx="2" style={{ fill: built ? c : pale }} />
      <rect x="38" y="0" width="7" height={built ? 96 : 70} style={{ fill: built ? d : paleD }} />
      {built
        ? <><rect className="hd-collar" x="32" y="90" width="36" height="9" rx="1" /><path d="M50,99 V122" style={{ stroke: c, strokeWidth: 3, fill: "none" }} /><rect className="hd-jack" x="40" y="116" width="20" height="12" rx="1" /><rect className="w-led w-led-on" x="46" y="120" width="3" height="2" /></>
        : <><rect x="34" y="64" width="32" height="12" rx="2" style={{ fill: paleD }} /><rect x="38" y="76" width="24" height="5" rx="1" style={{ fill: pale }} /><path d="M50,81 V92" style={{ stroke: pale, strokeWidth: 2, strokeDasharray: "3 3", fill: "none" }} /></>}
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
  const leads = (id: string) => h.hall.xconnects.filter((x) => x.carrierId === id).map((x) => ({ id: x.id, name: h.hall.customers.find((c) => c.id === x.customerId)?.name })).filter((x): x is { id: string; name: string } => !!x.name);
  return (
    <Slab title={title} onClose={onClose} data={{ "door-panel": "meetme" }}>
      <div className="wp-scene hd-room">
        <div className="hd-row">
          {carriers.map((c) => {
            const built = h.hall.carriers.includes(c.id), hue = hueOf(c.id), xc = built ? leads(c.id) : [];
            return (
              <div key={c.id} className="wp-unit hd-spot" style={{ "--h": hue } as React.CSSProperties}>
                <Duct hue={hue} built={built} />
                {built || !zone
                  ? <span className="wp-label hd-name"><b>{c.name}</b>{!built && <span>{t("hall.door.noMeetMe")}</span>}</span>
                  : <button className="hd-name" onClick={() => setSlip(slip === c.id ? null : c.id)} aria-expanded={slip === c.id}><span className="wp-label"><b>{c.name}</b><span className="num">{euro(HALL.carrierFee)}</span></span></button>}
                {xc.length > 0 && <ul className="hd-leads">{xc.map((x) => <li key={x.id} className="hd-lead" data-xconnect=""><span className="hd-tag">{x.name}</span></li>)}</ul>}
              </div>
            );
          })}
        </div>
        {open && <Slip offer={offer(open.id, open.name)} onDone={() => setSlip(null)} />}
      </div>
    </Slab>
  );
}

// The main distribution board of the transformer room: a breaker and load meter per transformer, feed B, the backup runtime,
// the generator lamp and the main breaker that resets a trip.
export function MainBoardRoom({ loc, title, onClose }: { loc: Location; title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), attempt = useStore((s) => s.attempt), [refused, setRefused] = useState<string | null>(null);
  const h = hallAt(game, loc.id);
  if (!h) return null;
  const { hall, p } = h, halle = isHalle(p.buildingId), cut = new Set(unmaintained(game, loc.id).map((r) => r.slice(5)));
  const per = HALL.items.transformer.kw as { office: number; halle: number }, load = airflow(game, loc).load;
  const xfmr = hall.items.filter((i) => i.kind === "transformer").map((i) => ({ id: i.id, max: per[halle ? "halle" : "office"] * (cut.has(i.id) ? HALL.service.derate : 1) }));
  const total = xfmr.reduce((n, x) => n + x.max, 0), n = (v: number) => v.toLocaleString(undefined, { maximumFractionDigits: 0 });
  const feedB = hall.items.some((i) => i.kind === "switchgear");
  const genKw = hall.items.filter((i) => i.kind === "generator").length * Number(HALL.items.generator.kw);
  const ready = genKw >= load && genKw > 0;
  const minutes = Math.round(hallBackupMinutes(game, hall, load));
  const reset = () => { const r = attempt(resetBreaker, loc.id); setRefused(r.ok ? null : r.error ?? "error.noCash"); };
  const Lamp = ({ on }: { on: boolean }) => <span className={`hd-lamp${on ? " hd-lamp-on" : ""}`} aria-hidden />;
  return (
    <Slab title={title} onClose={onClose} data={{ "door-panel": "mainboard" }}>
      <div className="wp-scene hd-room">
        <div className="hd-board" data-mainboard="">
          {xfmr.map((x, i) => {
            const used = total ? load * x.max / total : 0;
            return (
              <div key={x.id} className="hd-brow">
                <Lamp on={!loc.tripped} /><b>{t("hall.board.xfmr", { n: i + 1 })}</b>
                <span className="hd-meter"><span className="hd-meter-fill" style={{ width: `${Math.min(100, x.max ? used / x.max * 100 : 0)}%` }} /></span>
                <span className="num">{t("hall.board.load", { used: n(used), max: n(x.max) })}</span>
              </div>
            );
          })}
          {feedB && <div className="hd-brow"><Lamp on /><b>{t("hall.board.feedB")}</b></div>}
          <div className="hd-brow"><Lamp on={minutes > 0} /><b>{t("hall.board.runtime", { min: minutes })}</b></div>
          <div className="hd-brow"><Lamp on={ready} /><b>{t("hall.board.generator")}</b><span>{ready ? t("hall.board.ready") : t("hall.board.none")}</span></div>
          <div className="hd-brow hd-main">
            <Lamp on={!loc.tripped} /><b>{t("hall.board.main")}</b><span>{loc.tripped ? t("hall.board.tripped") : t("hall.board.on")}</span>
            {loc.tripped && <button className="wr-line" data-reset-breaker="" onClick={reset}>{t("hall.board.reset")}</button>}
          </div>
          {refused && <div className="wr-model hd-refused" role="alert">{t(refused)}</div>}
        </div>
      </div>
    </Slab>
  );
}
