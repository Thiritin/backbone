import { t } from "../../../i18n/en";
import { formatClock } from "../../../sim/00-core/time";
import type { Call } from "../../../sim/47-staff/oncall";
import { present } from "../../../sim/60-infra/handwork";
import { replaceComponent } from "../../../sim/90-actions/hardware";
import { devName, partLabel } from "../../apps/hw";
import { HandsButtons, handsWays } from "../../apps/locations/HandSheet";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "../../apps/paper.css";
import "./panel.css";
import "./phone.css";

// The phone drawn large with the handset off the hook, and the call written on a notepad: site, what happened, when, and what to do about it.
export function PhonePanel({ title, call, cordless, onOpenRack, onClose }: { title: string; call: Call | null; cordless: boolean; onOpenRack: (rackId: string) => void; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const loc = call && game.locations.find((l) => l.id === call.locationId);
  const d = call?.deviceId ? game.devices.find((x) => x.id === call.deviceId) : undefined;
  const part = d?.components.find((c) => c.id === call?.eventId);
  const here = !!loc && present(game, loc.id);
  const what = !call ? "" : part && d ? t("world.phone.failed", { part: partLabel(part), device: devName(d) }) : t("world.phone.attack");
  return (
    <Slab title={title} onClose={onClose} data={{ "phone-panel": call?.id ?? "" }}>
      <div className="wp-scene">
        <div className="wph-desk">
          <svg className="wph-phone" viewBox="0 0 120 160" aria-hidden>
            {cordless ? (
              <>
                <rect className="w-phone-base" x="38" y="40" width="44" height="80" rx="6" />
                <rect className="wph-cradle" x="48" y="50" width="24" height="10" rx="3" />
                <g transform="rotate(-24 30 120)"><rect className="w-phone-cordless" x="10" y="80" width="26" height="70" rx="8" /><rect className="w-phone-screen" x="15" y="88" width="16" height="12" /></g>
              </>
            ) : (
              <>
                <rect className="w-phone" x="40" y="10" width="56" height="100" rx="8" />
                <rect className="wph-cradle" x="32" y="14" width="12" height="90" rx="5" />
                {[0, 1, 2, 3].map((r) => [0, 1, 2].map((c) => <rect key={`${r}${c}`} className="w-phone-key" x={54 + c * 11} y={44 + r * 13} width="8" height="8" rx="1.5" />))}
                <path className="w-phone-cord" d="M38,104 q-8,8 0,12 q8,4 0,12 q-8,4 0,12 q8,4 0,10 L20,150" fill="none" strokeWidth="3" />
                <g transform="rotate(-70 20 148)"><rect className="w-phone-handset" x="4" y="104" width="22" height="88" rx="10" /></g>
              </>
            )}
          </svg>
          <div className="wph-pad" data-call={call?.id ?? ""}>
            {call && loc ? (
              <>
                <dl>
                  <dt>{t("world.phone.site")}</dt><dd>{loc.name}</dd>
                  <dt>{t("world.phone.what")}</dt><dd>{what}</dd>
                  <dt>{t("world.phone.when")}</dt><dd>{formatClock(Math.floor(call.since / 60), call.since % 60)}</dd>
                </dl>
                {d && part && part.failedAt !== null && (here
                  ? d.rackId && <button className="wph-line" data-phone-rack={d.rackId} onClick={() => onOpenRack(d.rackId!)}>{t("world.phone.openRack")}</button>
                  : <HandsButtons ways={handsWays(game, loc.id, "replaceComponent")} className="wph-line" onRun={(how) => act(replaceComponent, d.id, part.id, how)}>
                      {t("locations-1.replacePart", { part: partLabel(part) })}
                    </HandsButtons>)}
              </>
            ) : <p>{t("world.phone.none")}</p>}
          </div>
        </div>
      </div>
    </Slab>
  );
}
