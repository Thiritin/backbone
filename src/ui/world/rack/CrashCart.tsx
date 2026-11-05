import { t } from "../../../i18n/en";
import { Screen } from "../../apps/console/Screen";
import { useStore } from "../../store";
import "./rack.css";

// The crash cart: a monitor and keyboard on a trolley, drawn large in front of the rack; the keyboard types into the machine's own console.
export function CrashCart({ deviceId, onClose }: { deviceId: string | null; onClose?: () => void }) {
  const game = useStore((s) => s.game);
  const d = game.devices.find((x) => x.id === deviceId);
  return (
    <div className="wr-cart" data-cart-panel={deviceId ?? ""}>
      <div className="wr-cart-monitor">
        {d ? <Screen game={game} device={d} via="monitor" /> : <div className="scr-wrap monitor"><div className="scr" data-look="dark"><span className="scr-osd">{t("console.noSignal")}</span></div></div>}
      </div>
      <svg className="wr-cart-frame" viewBox="0 -20 640 270" aria-hidden="true">
        <rect className="wr-cart-post" x="48" y="30" width="10" height="190" />
        <rect className="wr-cart-post" x="582" y="30" width="10" height="190" />
        <rect className="wr-cart-shelf" x="30" y="150" width="580" height="10" />
        <rect className="wr-cart-tray" x="20" y="14" width="600" height="20" />
        <rect className="wr-kb" x="110" y="-18" width="420" height="32" rx="3" />
        {[0, 1, 2, 3].map((r) => Array.from({ length: r === 3 ? 9 : 19 }, (_, c) => <rect key={`${r}${c}`} className="wr-key" x={r === 3 ? 190 + c * 26 : 118 + c * 21.2} y={-14 + r * 7} width={r === 3 ? 22 : 18} height="5" />))}
        {[48, 582].map((x) => <g key={x}><rect className="wr-cart-post" x={x - 6} y="220" width="22" height="8" /><circle className="wr-wheel" cx={x + 5} cy="238" r="10" /><circle className="wr-hub" cx={x + 5} cy="238" r="3" /></g>)}
      </svg>
      {onClose && <button className="wr-cart-back" aria-label={t("world.toRack")} onClick={onClose} />}
    </div>
  );
}
