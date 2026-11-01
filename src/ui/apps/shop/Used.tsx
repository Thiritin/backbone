import { Tag } from "lucide-react";
import { useState } from "react";
import { euro } from "../../../sim/00-core/money";
import { channelName, EBUY_FEE, SELL_ASK, SELL_START } from "../../../sim/10-catalog/used";
import type { GameState } from "../../../sim/50-state";
import { deviceValue } from "../../../sim/60-infra/status";
import { listForSale } from "../../../sim/90-actions/used";
import { useStore } from "../../store";
import { t } from "../../../i18n/en";
import { Money } from "../browser/sites/market/shared";
import "./used.css";

// "List for sale" on a stored device: the board at an ask, or eBuy from half the value.
export function ListForSale({ game, id, onDone }: { game: GameState; id: string; onDone: () => void }) {
  const act = useStore((s) => s.act), notify = useStore((s) => s.notify);
  const d = game.devices.find((x) => x.id === id)!, value = deviceValue(game, d);
  const [channel, setChannel] = useState<"board" | "ebuy">("board");
  const [ask, setAsk] = useState(Math.round(value * SELL_ASK));
  const list = () => {
    if (!act(listForSale, id, channel, channel === "board" ? ask : undefined).ok) return;
    notify("Shop", t("shop.listed", { name: d.name }), channelName(channel));
    onDone();
  };
  return (
    <div className="loc-row loc-ship">
      <div className="seg" role="group" aria-label={t("shop.channel")}>
        <button aria-pressed={channel === "board"} onClick={() => setChannel("board")}>{channelName("board")}</button>
        <button aria-pressed={channel === "ebuy"} onClick={() => setChannel("ebuy")}>{channelName("ebuy")}</button>
      </div>
      <span className="grow" />
      <span className="num loc-muted">{t("shop.value", { price: euro(value) })}</span>
      {channel === "board" ? <Money value={ask} onChange={setAsk} label={t("shop.askLabel")} /> : <span className="num">{t("shop.startsFee", { price: euro(Math.round(value * SELL_START)), fee: EBUY_FEE * 100 })}</span>}
      <button className="btn primary" disabled={channel === "board" && !(ask >= 1)} onClick={list}><Tag />{t("shop.listAction")}</button>
    </div>
  );
}
