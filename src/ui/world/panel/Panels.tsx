import { useState } from "react";
import { t } from "../../../i18n/en";
import { modelById } from "../../../sim/10-catalog/hardware";
import { atDesk } from "../../../sim/40-support/letters";
import type { Device, Location } from "../../../sim/50-state";
import { pickUp } from "../../../sim/90-actions/carry";
import { readLetter } from "../../../sim/90-actions/paperwork";
import { scanLetter } from "../../../sim/90-actions/post";
import { Isometric } from "../../art/Isometric";
import { devName } from "../../apps/hw";
import { Facts, locationPower, PowerMeter, RoomTemp } from "../../apps/locations/ui";
import { Letter } from "../../apps/PostApp";
import { paperDay } from "../../apps/FormDoc";
import { useStore } from "../../store";
import { Slab } from "./Slab";
import "../../apps/locations/locations.css";
import "../../apps/paper.css";
import "./panel.css";

type Props = { loc: Location; onClose: () => void };

// Stored units and parcels at the door; either can be taken into the hands.
export function StoragePanel({ loc, onClose }: Props) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const stored = game.devices.filter((d) => d.store === loc.id && !d.chassisId), door = game.devices.filter((d) => d.door?.at === loc.id && !d.chassisId);
  const full = !!game.player.carrying;
  const row = (d: Device) => {
    const m = modelById(d.model);
    return (
      <div key={d.id} className="wp-row" data-unit={d.id}>
        <Isometric model={m} brand={d.brand} w={48} />
        <strong>{m.kind === "server" ? `${d.brand} ${m.name}` : m.name}</strong>
        <span>{devName(d)}</span>
        <button className="wr-btn" disabled={full} onClick={() => { if (act(pickUp, d.id).ok) onClose(); }}>{t("world.pickUp")}</button>
      </div>
    );
  };
  return (
    <Slab title={t("world.obj.shelf")} head={<span className="wr-num">{stored.length}</span>} onClose={onClose} className="wp-panel" data={{ "storage-panel": loc.id }}>
      <div className="wp-list">
        {stored.map(row)}
        {!stored.length && <div className="wp-none">{t("locations-2.empty")}</div>}
        {door.length > 0 && <h3 className="wp-h">{t("locations-2.atDoor")}</h3>}
        {door.map(row)}
      </div>
    </Slab>
  );
}

// Fetched letters, newest first; picking one opens it for reading with the scan action.
export function PostPanel({ title, onClose }: { title: string; onClose: () => void }) {
  const game = useStore((s) => s.game), act = useStore((s) => s.act);
  const [sel, setSel] = useState<string | null>(null);
  const letters = [...atDesk(game)].reverse(), l = letters.find((x) => x.id === sel);
  const open = (id: string, read: boolean) => { setSel(id); if (!read) act(readLetter, id); };
  return (
    <Slab title={title} head={<span className="wr-num">{letters.length}</span>} onClose={onClose} onBack={() => (sel ? (setSel(null), true) : false)} className="wp-panel wp-post" data={{ "post-panel": "" }}>
      <div className="wp-split">
        <div className="wp-list" role="list">
          {letters.map((x) => (
            <button key={x.id} role="listitem" className={`wp-letter${x.id === sel ? " on" : ""}${x.read ? "" : " unread"}`} onClick={() => open(x.id, x.read)}>
              <strong>{x.from}</strong>
              <span>{t(`letter.${x.topic}.subject`, x.params)}</span>
              <small>{paperDay(x.at)}</small>
            </button>
          ))}
          {!letters.length && <div className="wp-none">{t("paperwork.post.empty")}</div>}
        </div>
        {l && (
          <div className="wp-read">
            <div className="letter-fit"><Letter letter={l} company={game.company.name} owner={game.registration?.owner} /></div>
            <div className="wp-acts">
              {l.scanned ? <span className="wr-num">{t("paperwork.post.scanned")}</span> : <button className="wr-btn" onClick={() => act(scanLetter, l.id)}>{t("paperwork.post.scan")}</button>}
            </div>
          </div>
        )}
      </div>
    </Slab>
  );
}

// The location's power draw against its limit and the room temperature.
export function PowerPanel({ loc, title, onClose }: Props & { title: string }) {
  const game = useStore((s) => s.game), power = locationPower(game, loc.id);
  return (
    <Slab title={title} onClose={onClose} className="wp-panel" data={{ "power-panel": loc.id }}>
      <div className="wp-list wp-facts">
        <Facts rows={[
          [t("locations-2.power"), <PowerMeter watts={power.watts} limit={power.limit} tripped={power.tripped} />],
          [t("locations-2.temperature"), <RoomTemp g={game} loc={loc} />],
        ]} />
      </div>
    </Slab>
  );
}
