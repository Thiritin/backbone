import { useEffect, useState, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { LOCALE } from "../../../i18n/lang";
import { modelById, modelName } from "../../../sim/10-catalog/hardware";
import { atDesk } from "../../../sim/40-support/letters";
import type { Device, Location } from "../../../sim/50-state";
import { resetBreaker, setPower } from "../../../sim/90-actions/hardware";
import { readLetter } from "../../../sim/90-actions/paperwork";
import { scanLetter } from "../../../sim/90-actions/post";
import { Isometric } from "../../art/Isometric";
import { devName } from "../../apps/hw";
import { locationPower } from "../../apps/locations/ui";
import { Letter } from "../../apps/PostApp";
import { payUrl } from "../../apps/books/PayablesTab";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "../../apps/paper.css";
import "./panel.css";

type Props = { loc: Location; onClose: () => void };
const num = (v: number) => v.toLocaleString(LOCALE, { maximumFractionDigits: 0 });
// Stack sheets drawn beside the letter; more letters than this still thin the stack only once fewer remain.
const STACK_MAX = 12;
const SCANNER_BRAND = "Epsilon";

// The shelf drawn large: stored units stand on its boards.
export function StoragePanel({ loc, onClose }: Props) {
  const game = useStore((s) => s.game);
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId);
  const unit = (d: Device) => {
    const m = modelById(d.model);
    return (
      <div key={d.id} className="wp-unit" data-unit={d.id}>
        <Isometric model={m} brand={d.brand} w={m.kind === "part" ? 56 : 92} />
        <span className="wp-label"><b>{devName(d)}</b>{m.kind === "server" ? `${d.brand} ${modelName(m, d.brand)}` : m.name}</span>
      </div>
    );
  };
  // Four boards, filled bottom up so the lowest board carries the first units.
  const per = Math.max(3, Math.ceil(stored.length / 4)), boards = [3, 2, 1, 0].map((b) => stored.slice(b * per, (b + 1) * per));
  return (
    <Slab title={t("world.obj.shelf")} onClose={onClose} data={{ "storage-panel": loc.id }}>
      <div className="wp-scene">
        <div className="wp-shelf-row">
          <div className="wp-shelf">
            {boards.map((b, i) => <div key={i} className="wp-board">{b.map(unit)}</div>)}
          </div>
        </div>
      </div>
    </Slab>
  );
}

// Fetched letters as paper: the current sheet in the middle, the sheets still to read stacked right, the ones gone through stacked left.
export function PostPanel({ title, onClose }: { title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const letters = [...atDesk(game)].reverse();
  // The stack opens at the first unpaid bill, so a card that sent the player here lands on it.
  const [i, setI] = useState(() => Math.max(0, letters.findIndex((x) => game.payables.some((p) => p.id === x.payable && p.paidAt === null))));
  const at = Math.min(i, letters.length - 1), l = letters[at];
  const go = (to: number) => setI(Math.max(0, Math.min(letters.length - 1, to)));
  useEffect(() => { if (l && !l.read) act(readLetter, l.id); }, [l?.id]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => { if (e.key === "ArrowRight") setI((x) => x + 1 < letters.length ? x + 1 : x); else if (e.key === "ArrowLeft") setI((x) => Math.max(0, x - 1)); };
    window.addEventListener("keydown", key);
    return () => window.removeEventListener("keydown", key);
  }, [letters.length]);
  const open = letters.filter((x) => !x.scanned);
  // A bill's Bezahlen opens the prefilled transfer at once.
  const bill = l?.payable ? game.payables.find((p) => p.id === l.payable) : undefined, payable = !!bill && bill.paidAt === null && !!game.bank;
  const stack = (n: number, side: "prev" | "next") => n > 0 && (
    <button className={`wp-stack ${side}`} aria-label={t(side === "next" ? "world.nextLetter" : "world.prevLetter")} onClick={() => go(at + (side === "next" ? 1 : -1))}>
      {Array.from({ length: Math.min(n, STACK_MAX) }, (_, k) => <i key={k} style={{ ["--k" as string]: k }} />)}
    </button>
  );
  return (
    <Slab title={title} onClose={onClose} data={{ "post-panel": "" }}>
      <div className="wp-scene">
        <div className="wp-papers">
          <div className="wp-side">{stack(at, "prev")}</div>
          {l && (
            <div className="wp-sheet" data-letter={l.id}>
              <div className="letter-fit"><Letter letter={l} company={game.company.name} owner={game.registration?.owner} /></div>
              {l.scanned
                ? <span className="wp-stamp">{t("paperwork.post.scanned")}</span>
                : <button className="wp-corner" onClick={() => act(scanLetter, l.id)}>{t("paperwork.post.scan")}</button>}
              {payable && <button className="wp-corner wp-pay" onClick={() => { onClose(); openApp("Browser", { kind: "url", id: payUrl(game, bill!) }); }}>{t("bank.pay.pay")}</button>}
            </div>
          )}
          <div className="wp-side">{stack(letters.length - at - 1, "next")}</div>
        </div>
        <button className="wp-key" disabled={!open.length} onClick={() => open.forEach((x) => act(scanLetter, x.id))}>{t("world.scanAll")}</button>
      </div>
    </Slab>
  );
}

// The flatbed with its lid up and the next unscanned letter on the glass; the front button scans it and the copy slides out as a sheet.
export function ScanPanel({ title, onClose }: { title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const next = [...atDesk(game)].reverse().find((x) => !x.scanned);
  const [out, setOut] = useState<{ id: string; n: number } | null>(null);
  const done = out && game.letters.find((x) => x.id === out.id);
  const scan = () => { if (next && act(scanLetter, next.id).ok) setOut({ id: next.id, n: (out?.n ?? 0) + 1 }); };
  const sheet = (x: NonNullable<typeof next>) => <div className="letter-fit"><Letter letter={x} company={game.company.name} owner={game.registration?.owner} /></div>;
  return (
    <Slab title={title} onClose={onClose} data={{ "scan-panel": "" }}>
      <div className="wp-scene">
        <div className="wp-scanner">
          <div className="wp-lid"><i /></div>
          <div className="wp-bed">
            <div className="wp-glass">{next && <div className="wp-on-glass" data-letter={next.id}>{sheet(next)}</div>}</div>
          </div>
          <div className="wp-front">
            <span className="wp-brand">{SCANNER_BRAND}</span>
            <span className={`wp-led${next ? " on" : ""}`} />
            <button className="wp-go" disabled={!next} aria-label={t("paperwork.post.scan")} onClick={scan}><i /></button>
          </div>
          {done && <div key={out!.n} className="wp-out" data-scanned={done.id}>{sheet(done)}</div>}
        </div>
      </div>
    </Slab>
  );
}

// The fuse box with its door open, or a datacenter PDU; the numbers sit on the meter's face and the PDU's display.
export function PowerPanel({ loc, title, kind, onClose }: Props & { title: string; kind: string }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), attempt = useStore((s) => s.attempt), power = locationPower(game, loc.id);
  const units = game.devices.filter((d) => d.rackId && game.racks.some((r) => r.id === d.rackId && r.locationId === loc.id) && !d.chassisId);
  const live = units.some((d) => d.on), [refused, setRefused] = useState<string | null>(null);
  // The main switch is the pulled plug for every unit in the room, and switching it back on boots them all; a tripped one is reset.
  const main = () => {
    if (!loc.tripped) return units.forEach((d) => act(setPower, d.id, !live));
    const r = attempt(resetBreaker, loc.id);
    setRefused(r.ok ? null : r.error);
  };
  return (
    <Slab title={title} onClose={onClose} data={{ "power-panel": loc.id }}>
      <div className="wp-scene">
        {kind === "pdu"
          ? <PduFace watts={power.watts} limit={power.limit} lit={units.filter((d) => d.on).length} tripped={power.tripped} />
          : <FuseFace watts={power.watts} limit={power.limit} live={live && !loc.tripped} tripped={power.tripped} refused={loc.tripped ? refused : null} onMain={main} />}
      </div>
    </Slab>
  );
}

const ROWS = 3, PER_ROW = 8;
function FuseFace({ watts, limit, live, tripped, refused, onMain }: { watts: number; limit: number; live: boolean; tripped: boolean; refused: string | null; onMain: () => void }) {
  const W = 300, H = 440, x0 = 30, y0 = 50, turn = watts > 0 && !tripped ? Math.min(20, 4000 / watts) : 0;
  const lever = (x: number, y: number, up: boolean, wide = false, children?: ReactNode) => (
    <g transform={`translate(${x} ${y})`}>
      <rect className="wp-brk" width={wide ? 44 : 22} height="54" />
      <rect className="wp-brk-slot" x={wide ? 15 : 6} y="14" width="10" height="26" />
      <rect className={`wp-brk-lever${wide ? " main" : ""}`} x={wide ? 13 : 4} y={up ? 12 : 28} width="14" height="14" />
      {wide && <rect className="wp-brk-lever main" x="27" y={up ? 12 : 28} width="4" height="14" />}
      {children}
    </g>
  );
  return (
    <svg className="wp-art" viewBox={`-80 -60 ${W + 160} ${H + 80}`} width={(W + 160) * 1.25} data-fusebox="">
      {/* The conduit leaves the box's top and runs up the wall. */}
      <rect className="w-conduit" x={W - 40} y="-60" width="12" height="62" />
      {[-48, -20].map((y) => <rect key={y} className="w-clip" x={W - 44} y={y} width="20" height="5" />)}
      {/* The open door hangs on its left hinges. */}
      <polygon className="w-fuse-door" points={`-76,-24 0,0 0,${H} -76,${H + 24}`} />
      <polygon className="w-fuse-door-in" points={`-66,-8 -10,10 -10,${H - 10} -66,${H + 8}`} />
      <rect className="wp-screw" x="-62" y={H / 2 - 20} width="6" height="40" />
      <rect className="w-fuse" x="0" y="0" width={W} height={H} />
      <rect className="w-fuse-in" x="10" y="10" width={W - 20} height={H - 20} />
      {[[16, 16], [W - 16, 16], [16, H - 16], [W - 16, H - 16]].map(([x, y]) => <circle key={`${x}${y}`} className="wp-screw" cx={x} cy={y} r="3" />)}
      {/* The meter: a counter, the turning disc behind its window and the rating plate. */}
      <rect className="w-meter" x={x0} y="24" width={W - 2 * x0} height={y0 + 80} />
      <rect className="w-lcd" x={x0 + 16} y="38" width={W - 2 * x0 - 32} height="34" />
      {refused
        ? <text className="wp-lcd-num wp-lcd-msg bad" x={W - x0 - 22} y="59" textLength={W - 2 * x0 - 44} lengthAdjust="spacingAndGlyphs" data-refused="">{t(refused)}</text>
        : <text className={`wp-lcd-num${tripped ? " bad" : ""}`} x={W - x0 - 24} y="63">{`${num(tripped ? 0 : watts)} W`}</text>}
      <rect className="w-disc-win" x={x0 + 16} y="84" width={W - 2 * x0 - 32} height="18" />
      <rect className="w-disc" x={x0 + 18} y="90" width={W - 2 * x0 - 36} height="6" />
      {turn > 0 && <rect className="w-disc-mark wp-disc-mark" x={x0 + 18} y="89" width="8" height="8" style={{ animationDuration: `${turn}s` }} />}
      <rect className="wp-plate" x={x0 + 16} y="110" width="120" height="16" />
      <text className="wp-plate-txt" x={x0 + 22} y="122">{`max ${num(limit)} W`}</text>
      {/* Breakers on their rails; the wide one at the top left is the main switch. */}
      {Array.from({ length: ROWS }, (_, row) => {
        const y = 180 + row * 82;
        return (
          <g key={row}>
            <rect className="w-rail" x={x0 - 6} y={y + 24} width={W - 2 * x0 + 12} height="6" />
            {Array.from({ length: PER_ROW }, (_, k) => {
              if (row === 0 && k < 2) return k === 0 ? (
                <g key={k} className="wp-hit" role="switch" aria-checked={live} aria-label={t("world.mainSwitch")} tabIndex={0} data-main={live ? "on" : "off"}
                  onClick={onMain} onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); onMain(); } }}>
                  {lever(x0 + 2, y, live, true)}
                  {tripped && <rect className="wp-trip-flag" x={x0 + 2 + 31} y={y + 30} width="6" height="8" data-tripped="" />}
                </g>
              ) : null;
              return <g key={k}>{lever(x0 + 2 + k * 30, y, true)}</g>;
            })}
            <rect className="wp-strip" x={x0} y={y + 60} width={W - 2 * x0} height="10" />
          </g>
        );
      })}
    </svg>
  );
}

const OUTLETS = 12;
function PduFace({ watts, limit, lit, tripped }: { watts: number; limit: number; lit: number; tripped: boolean }) {
  const W = 90, H = 560;
  return (
    <svg className="wp-art" viewBox={`-40 -20 ${W + 80} ${H + 40}`} height="min(80vh, 680px)" data-pdu="">
      <rect className="wp-pdu" x="0" y="0" width={W} height={H} />
      <rect className="wp-pdu-face" x="6" y="6" width={W - 12} height={H - 12} />
      <rect className="w-lcd" x="14" y="18" width={W - 28} height="30" />
      <text className={`wp-lcd-num${tripped ? " bad" : ""}`} x={W - 20} y="39">{`${(watts / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1, minimumFractionDigits: 1 })} kW`}</text>
      <rect className="wp-plate" x="14" y="56" width={W - 28} height="14" />
      <text className="wp-plate-txt" x="18" y="66">{`max ${(limit / 1000).toLocaleString(LOCALE, { maximumFractionDigits: 1 })} kW`}</text>
      {Array.from({ length: OUTLETS }, (_, k) => {
        const y = 92 + k * 38;
        return (
          <g key={k} transform={`translate(22 ${y})`}>
            <rect className="wp-outlet" width="34" height="26" />
            <rect className="wp-pin" x="8" y="9" width="4" height="8" /><rect className="wp-pin" x="15" y="9" width="4" height="8" /><rect className="wp-pin" x="22" y="9" width="4" height="8" />
            <circle className={`wp-oled${k < lit ? " on" : ""}`} cx="46" cy="13" r="3.5" />
          </g>
        );
      })}
    </svg>
  );
}
