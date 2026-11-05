import { CalendarClock, Ellipsis, Flame, Hand, KeyRound, Pencil, PackageMinus, Plug, Tag, Truck, Unlink, UserCog, Wrench, X, Zap, type LucideIcon } from "lucide-react";
import { useEffect, useState } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { isOfficeRouter, modelById, modelName } from "../../../sim/10-catalog/hardware";
import { routerPassword } from "../../../sim/60-infra/lan";
import type { Device } from "../../../sim/50-state";
import { deviceHealth, deviceValue, pluggedIn } from "../../../sim/60-infra/status";
import { cardBoard, nextGoal } from "../../../sim/checklist";
import { busyReason } from "../../../sim/90-actions/busy";
import { sellDevice } from "../../../sim/90-actions/hardware";
import { deviceLamps, devName, partLabel } from "../../apps/hw";
import { secondPsuPrice } from "../../apps/locations/deviceMenu";
import { LabelEdit, POWER, type useDeviceMenu } from "../../apps/locations/Inspector";
import { handsLabel, POWER_ICON, POWER_LABEL, powerOptions } from "../../apps/locations/power";
import type { MenuEntry, MenuItem } from "../../desktop/menu";
import { useStore } from "../../store";

export const ARM_MS = 3000;
// The key on the tag that the current guide card needs.
const GUIDE_KEY: Partial<Record<string, "power" | "console" | "reboot">> = { mountServer: "power", mountRouter: "power", bootUsb: "reboot", installOs: "console" };
type Menus = ReturnType<typeof useDeviceMenu>;
const real = (e: MenuEntry | undefined): e is MenuItem => !!e;
const bare = (s: string) => s.replace(/(\.\.\.|…)$/, "");
// The text a label has before its price or count, to recognise entries whose label carries a parameter.
const lead = (key: Parameters<typeof t>[0], params: Record<string, string | number>) => t(key, { ...params, price: "\u0000", n: 0 }).split("\u0000")[0];

// The pictogram on an action's key.
function iconFor(d: Device, game: Parameters<typeof handsLabel>[0], label: string): LucideIcon {
  const is = (key: Parameters<typeof t>[0]) => label === t(key), starts = (key: Parameters<typeof t>[0]) => label.startsWith(lead(key, {}));
  if (is("locations-1.changeParts")) return Wrench;
  if (is("locations-1.planMaintenance")) return CalendarClock;
  if (is("locations-1.burnIn")) return Flame;
  if (is("locations-1.rename")) return Pencil;
  if (label === handsLabel(game, d)) return Hand;
  if (is("locations-1.moveTo")) return Truck;
  if (is("locations-1.removeFromCluster")) return Unlink;
  if (starts("locations-1.unmount")) return PackageMinus;
  if (starts("locations-1.buyOutLease")) return KeyRound;
  if (starts("locations-1.plugPsu") || starts("locations-1.unplugPsu")) return Plug;
  if (starts("locations-2.techItem")) return UserCog;
  return Ellipsis;
}

// A paper slip with a stamp: what is being confirmed, a small cancel key bottom left and the stamp bottom right.
function Slip({ name, text, action, onStamp, onCancel, slip }: { name: string; text?: string; action: string; onStamp: () => void; onCancel: () => void; slip: string }) {
  return (
    <div className="wk-slip" data-slip={slip}>
      <div className="wk-slip-name">{name}</div>
      {text && <div className="wr-model">{text}</div>}
      <div className="wk-slip-foot">
        <button className="wk-ic" aria-label={t("locations-2.cancel")} title={t("locations-2.cancel")} data-slip-cancel="" onClick={onCancel}><X size={16} /></button>
        <button className="wk-stamp" data-slip-stamp="" onClick={onStamp}>{action}</button>
      </div>
    </div>
  );
}

// A server's unit tag: a small paper tag with its name and model, a drawn power key with console and port connectors, and a grid of pictogram keys for the other actions.
export function UnitTag({ deviceId, renaming, onRenaming, menus, back, onPorts, onCart, onSold }: {
  deviceId: string; renaming: boolean; onRenaming: (on: boolean) => void; menus: Menus; back: boolean; onPorts?: () => void; onCart?: () => void; onSold: () => void;
}) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const d = game.devices.find((x) => x.id === deviceId)!;
  const m = modelById(d.model), state = POWER[m.kind === "server" && d.rackId && !pluggedIn(d) ? "nopower" : deviceHealth(game, d.id).state][0], lamps = deviceLamps(game, d.id, m), failed = d.components.filter((c) => c.failedAt !== null);
  const [armed, setArmed] = useState(false), [flip, setFlip] = useState<number | null>(null), [slip, setSlip] = useState(false);
  useEffect(() => { setArmed(false); setFlip(null); setSlip(false); }, [deviceId]);
  // The key disarms when the server goes off by other means.
  useEffect(() => { setArmed(false); }, [d.on]);
  useEffect(() => {
    if (!armed) return;
    const id = setTimeout(() => setArmed(false), ARM_MS);
    return () => clearTimeout(id);
  }, [armed]);

  const rackServer = m.kind === "server" && !!d.rackId, options = rackServer ? powerOptions(game, d).options : [];
  const flat: MenuItem[] = menus.entries(d).filter(real);
  // A rack server's power entries come first, one per power option.
  const powerEntries = flat.slice(0, options.length);
  const sellLabel = t("locations-1.sell"), psuPrice = secondPsuPrice(d), psuLabel = psuPrice !== null ? t("locations-1.addSecondPsu", { price: euro(psuPrice) }) : null;
  const rest = flat.slice(options.length).filter((e) => e.label !== sellLabel && (rackServer || (e.label !== t("locations-1.powerOn") && e.label !== t("locations-1.powerOff"))));
  // Restart stays on a rack server's tag; the sim disables it unless the machine is up, and the key says what the machine is doing instead.
  const extra = rackServer ? [
    ...options.map((o, i) => ({ o: o.op, e: powerEntries[i] })).filter(({ o, e }) => e && o !== "on" && o !== "shutdown"),
    ...(options.some((o) => o.op === "reboot") ? [] : [{ o: "reboot" as const, e: { label: POWER_LABEL.reboot, disabled: true } as MenuItem }]),
  ] : [];
  const cur = cardBoard(game).current, guide = cur ? GUIDE_KEY[nextGoal(game, cur)] : undefined;
  const busy = !!busyReason(game, { deviceId: d.id });
  const keys = [
    ...extra.map(({ o, e }) => ({ e, icon: POWER_ICON[o], label: bare(POWER_LABEL[o]), badge: "", why: state })),
    ...rest.map((r) => {
      const e = busy ? { ...r, disabled: true } : r, why = busy ? t("world.busy") : "";
      return psuLabel && e.label === psuLabel
        ? { e, icon: Zap, label: t("world.secondPsu"), badge: euro(psuPrice!), why }
        : { e, icon: iconFor(d, game, r.label), label: bare(e.label), badge: "", why };
    }),
  ];

  const onKey = () => {
    if (!d.on) { if (!rackServer) menus.power(d, true); else if (options.some((o) => o.op === "on")) menus.op(d, "on"); else menus.front(d, "power"); return; }
    if (!armed) { setArmed(true); return; }
    setArmed(false);
    if (options.some((o) => o.op === "shutdown")) menus.op(d, "shutdown"); else menus.power(d, false);
  };
  const lampOn = d.on && !(rackServer && !pluggedIn(d)) ? "on" : "off", pending = menus.pending;

  return (
    <div className="wr-tag-body" data-device={d.id}>
      {failed.length > 0 && <div className="wr-model wr-fault" data-fault="">{failed.map(partLabel).join(", ")} · {t("locations-1.failed")}</div>}
      <div className="wr-tag-h">
        <span className={`wr-led ${lamps.state}`} role="img" aria-label={t(d.on ? "locations-1.stOn" : "locations-1.stOff")} />
        <LabelEdit device={d} editing={renaming} onEditing={onRenaming} />
      </div>
      <div className="wr-model">{m.kind === "server" ? `${d.brand} ${modelName(m, d.brand)}` : m.name}</div>
      {m.kind !== "patch" && (
        <div className="wk-plate">
          <button className={`wk-power ${lampOn}${armed ? " armed" : ""}`} data-power={lampOn} data-guide={guide === "power" && !d.on ? "" : undefined} aria-pressed={armed} aria-label={armed ? POWER_LABEL.shutdown : d.on ? t("locations-1.powerOff") : t("locations-1.powerOn")} title={armed ? POWER_LABEL.shutdown : d.on ? t("locations-1.powerOff") : t("locations-1.powerOn")} onClick={onKey}>
            <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3v9M6.6 6.8a8 8 0 1 0 10.8 0" /></svg>
            <i />
          </button>
          <span className="wk-gap" />
          {m.kind === "server" && <button className="wk-port" data-cart="" data-guide={guide === "console" || guide === "reboot" ? "" : undefined} disabled={!onCart} aria-label={t("world.console")} title={t("world.console")} onClick={onCart}>
            <svg viewBox="0 0 24 16" aria-hidden="true"><rect x="1.5" y="1.5" width="21" height="11" /><path d="M8 15h8" /></svg>
          </button>}
          {onPorts && <button className={`wk-port${back ? " on" : ""}`} data-ports="" aria-pressed={back} aria-label={t("locations-1.ports")} title={t("locations-1.ports")} onClick={onPorts}>
            <svg viewBox="0 0 24 16" aria-hidden="true"><rect x="2.5" y="3.5" width="19" height="9" /><path d="M6 7v3M9.5 7v3M13 7v3M16.5 7v3" /></svg>
          </button>}
          <div className="wk-state">{armed ? POWER_LABEL.shutdown : state}</div>
        </div>
      )}
      {isOfficeRouter(m) && !pending && !slip && <div className="wk-slip wk-label"><div className="wk-slip-name">{t("misc1.ipmi.password")}</div><div className="wk-label-pw">{routerPassword(game, d.id)}</div></div>}
      {pending ? (
        <Slip slip="offline" name={pending.title} text={pending.text} action={pending.action} onStamp={pending.confirm} onCancel={pending.cancel} />
      ) : slip ? (
        <Slip slip="sell" name={devName(d)} action={t("locations-1.sellFor", { value: euro(deviceValue(game, d)) })} onCancel={() => setSlip(false)} onStamp={() => { if (act(sellDevice, d.id).ok) onSold(); }} />
      ) : (
        <>
          <div className="wk-grid">
            {keys.map(({ e, icon: Icon, label, badge, why }, i) => (
              <button key={i} className={`wk-ic${flip === i ? " on" : ""}`} aria-label={label} title={e.disabled && why ? `${label}: ${why}` : label} aria-disabled={e.disabled || undefined} data-key={label} data-guide={guide === "reboot" && label === bare(POWER_LABEL.reboot) ? "" : undefined}
                disabled={e.disabled} aria-expanded={e.items ? flip === i : undefined} onClick={e.items ? () => setFlip(flip === i ? null : i) : e.run} >
                <Icon size={18} aria-hidden="true" />{badge && <span className="wk-badge">{badge}</span>}<span className="wk-tip" aria-hidden="true">{label}</span>
              </button>
            ))}
            {m.kind !== "gateway" && sellLabel && flat.some((e) => e.label === sellLabel) && (
              <button className="wk-ic" data-sell="" aria-label={bare(sellLabel)} title={bare(sellLabel)} onClick={() => setSlip(true)}><Tag size={18} aria-hidden="true" /><span className="wk-tip" aria-hidden="true">{bare(sellLabel)}</span></button>
            )}
          </div>
          {flip !== null && keys[flip]?.e.items && (
            <div className="wk-flip">{keys[flip].e.items!.filter(real).map((e, i) => <button key={i} className="wk" disabled={e.disabled} onClick={e.run}>{bare(e.label)}</button>)}</div>
          )}
        </>
      )}
    </div>
  );
}
