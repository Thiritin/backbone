import { X } from "lucide-react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { modelById, modelName } from "../../../sim/10-catalog/hardware";
import { deviceValue, heightIn } from "../../../sim/60-infra/status";
import { sellDevice } from "../../../sim/90-actions/hardware";
import { devName, partLabel } from "../../apps/hw";
import { LabelEdit, type useDeviceMenu } from "../../apps/locations/Inspector";
import { useStore } from "../../store";

type Menus = ReturnType<typeof useDeviceMenu>;

// A paper slip with a stamp: what is being confirmed, a small cancel key bottom left and the stamp bottom right.
export function Slip({ name, text, action, onStamp, onCancel, slip }: { name: string; text?: string; action: string; onStamp: () => void; onCancel: () => void; slip: string }) {
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

// The asset tag hung on a selected device: a paper tag with its name, model, rack unit and inventory number.
// Every action lives on the front panel, the crash cart or the right-click menu; its confirmation slips pin below the tag.
export function UnitTag({ deviceId, renaming, onRenaming, menus, onSold }: { deviceId: string; renaming: boolean; onRenaming: (on: boolean) => void; menus: Menus; onSold: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const d = game.devices.find((x) => x.id === deviceId)!;
  const m = modelById(d.model), failed = d.components.filter((c) => c.failedAt !== null), { pending, sale } = menus;
  const top = d.slot + heightIn(game, d.rackId, d.model) - 1;
  return (
    <div className="wr-tag-body wr-asset" data-device={d.id}>
      {failed.length > 0 && <div className="wr-model wr-fault" data-fault="">{failed.map(partLabel).join(", ")} · {t("locations-1.failed")}</div>}
      <div className="wr-tag-h">{renaming ? <LabelEdit device={d} editing onEditing={onRenaming} /> : <span data-name="">{devName(d)}</span>}</div>
      <div className="wr-model">{m.kind === "server" ? `${d.brand} ${modelName(m, d.brand)}` : m.name}</div>
      <div className="wr-asset-row">
        {d.rackId && <span data-unit="">{t("world.tagUnit", { n: top > d.slot ? `${d.slot}-${top}` : d.slot })}</span>}
        <span data-inv="">{t("world.tagInv", { n: d.id.replace(/\D/g, "").padStart(4, "0") })}</span>
      </div>
      {pending ? (
        <Slip slip="offline" name={pending.title} text={pending.text} action={pending.action} onStamp={pending.confirm} onCancel={pending.cancel} />
      ) : sale ? (
        <Slip slip="sell" name={devName(d)} action={t("locations-1.sellFor", { value: euro(deviceValue(game, d)) })} onCancel={sale.cancel} onStamp={() => { if (act(sellDevice, d.id).ok) { sale.cancel(); onSold(); } }} />
      ) : null}
    </div>
  );
}
