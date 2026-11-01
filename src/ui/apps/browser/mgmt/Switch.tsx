// docs/design/lan.md, Management interfaces in the Browser: one switch web interface, themed per brand in switch.css.
import { useState } from "react";
import { t } from "../../../../i18n/en";
import { modelById } from "../../../../sim/10-catalog/hardware";
import type { Device, GameState } from "../../../../sim/50-state";
import { portPeers } from "../../../../sim/60-infra/status";
import { addressOf } from "../../../../sim/60-infra/lan";
import { MGMT_VLAN, vlanOf, vlansIn } from "../../../../sim/60-infra/switches";
import { setPortGroup } from "../../../../sim/90-actions/hardware";
import { saveSwitchConfig, setPortVlan } from "../../../../sim/90-actions/switches";
import { devName, portName, speed } from "../../hw";
import "../consoles/consoles.css";
import "./switch.css";
import { usePageAct } from "../pageAct";

// Each maker's web interface; other makers show the plain one under the model's name.
const LOOKS: Record<string, { look: string; title: string; frame: "side" | "top" }> = {
  Sysko: { look: "sysko", title: "Sysko Device Mangler", frame: "side" },
  "Hewlett-Packet": { look: "proswerve", title: "ProSwerve", frame: "top" },
  Nettgear: { look: "prosafe", title: "ProSafe-ish", frame: "side" },
};
const lookOf = (d: Device) => LOOKS[d.brand] ?? { look: "plain", title: modelById(d.model).name, frame: "top" as const };
export const switchTitle = (d: Device): string => `${lookOf(d).title} ${devName(d)}`;

const TABS = ["system", "ports", "groups", "vlans", "save"] as const;
type Tab = (typeof TABS)[number];
const TAB_KEY: Record<Tab, string> = { system: "switch.system", ports: "switch.ports", groups: "switch.groups", vlans: "switch.vlans", save: "switch.save" };

const same = (d: Device) => JSON.stringify({ groups: d.groups, vlans: d.vlans ?? {} }) === JSON.stringify(d.saved ?? { groups: [], vlans: {} });
const list = (ns: number[]) => ns.join(", ");

function System({ game, d }: { game: GameState; d: Device }) {
  const m = modelById(d.model);
  return (
    <dl className="sw-facts">
      <div><dt>{t("switch.model")}</dt><dd>{m.name}</dd></div>
      <div><dt>{t("switch.name")}</dt><dd>{devName(d)}</dd></div>
      <div><dt>{t("switch.address")}</dt><dd className="num">{addressOf(game, d.id)}</dd></div>
      <div><dt>{t("switch.mgmtVlan")}</dt><dd className="num">{MGMT_VLAN}</dd></div>
      {d.fw && <div><dt>{t("switch.firmware")}</dt><dd className="num">{d.fw.version}</dd></div>}
    </dl>
  );
}

function Ports({ game, d }: { game: GameState; d: Device }) {
  const m = modelById(d.model), peers = portPeers(game, d.id);
  const name = (id: string) => { const x = game.devices.find((y) => y.id === id); return x ? devName(x) : ""; };
  return (
    <table className="cx-table">
      <thead><tr><th>{t("switch.port")}</th><th>{t("switch.speed")}</th><th>{t("switch.link")}</th><th>{t("switch.peer")}</th><th>{t("switch.untagged")}</th><th>{t("switch.tagged")}</th><th>{t("switch.group")}</th></tr></thead>
      <tbody>
        {m.ports.map((p, i) => {
          const v = vlanOf(d, i), g = d.groups.findIndex((x) => x.includes(i));
          return (
            <tr key={i}>
              <td>{portName(m, i)}</td>
              <td className="num">{speed(p.gbit)}</td>
              <td><span className={`cx-state ${peers[i] ? "ok" : ""}`}>{peers[i] ? t("switch.up") : t("switch.down")}</span></td>
              <td>{peers[i] ? name(peers[i]!.device) : ""}</td>
              <td className="num">{v.untagged}</td>
              <td className="num">{list(v.tagged)}</td>
              <td>{g >= 0 ? t("switch.groupN", { n: g + 1 }) : ""}</td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function Groups({ d }: { d: Device }) {
  const act = usePageAct(), m = modelById(d.model);
  const [sel, setSel] = useState<number[]>([]);
  const toggle = (i: number) => setSel((cur) => (cur.includes(i) ? cur.filter((x) => x !== i) : [...cur, i].sort((a, b) => a - b)));
  const run = (ports: number[]) => { if (act(setPortGroup, d.id, ports).ok) setSel([]); };
  return (
    <>
      <div className="cx-tools sw-ports" role="group" aria-label={t("switch.ports")}>
        {m.ports.map((_, i) => (
          <button key={i} className="cx-chip num" aria-pressed={sel.includes(i)} onClick={() => toggle(i)}>{i + 1}</button>
        ))}
        <button className="cx-btn primary" disabled={sel.length < 2 || sel.length > 8} onClick={() => run(sel)}>{t("switch.createGroup")}</button>
      </div>
      <table className="cx-table">
        <thead><tr><th>{t("switch.group")}</th><th>{t("switch.members")}</th><th /></tr></thead>
        <tbody>
          {d.groups.map((g, k) => (
            <tr key={k}>
              <td>{t("switch.groupN", { n: k + 1 })}</td>
              <td className="num">{list(g.map((p) => p + 1))}</td>
              <td className="cx-acts"><button className="cx-btn" onClick={() => run([g[0]])}>{t("switch.remove")}</button></td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}

function VlanRow({ d, port }: { d: Device; port: number }) {
  const act = usePageAct(), v = vlanOf(d, port);
  const [untagged, setUntagged] = useState(String(v.untagged)), [tagged, setTagged] = useState(list(v.tagged));
  const changed = untagged !== String(v.untagged) || tagged !== list(v.tagged);
  const apply = () => {
    const r = act(setPortVlan, d.id, port, { untagged: Number(untagged), tagged: tagged.split(/[\s,]+/).filter(Boolean).map(Number) });
    if (!r.ok) { setUntagged(String(v.untagged)); setTagged(list(v.tagged)); }
  };
  return (
    <tr>
      <td>{portName(modelById(d.model), port)}</td>
      <td><input className="num sw-vlan" inputMode="numeric" aria-label={t("switch.untagged")} value={untagged} onChange={(e) => setUntagged(e.target.value)} /></td>
      <td><input className="num" aria-label={t("switch.tagged")} value={tagged} onChange={(e) => setTagged(e.target.value)} /></td>
      <td className="cx-acts"><button className="cx-btn" disabled={!changed} onClick={apply}>{t("switch.apply")}</button></td>
    </tr>
  );
}

function Vlans({ d }: { d: Device }) {
  const ports = modelById(d.model).ports.map((_, i) => i);
  return (
    <>
      <table className="cx-table">
        <thead><tr><th>{t("switch.vlan")}</th><th>{t("switch.untagged")}</th><th>{t("switch.tagged")}</th></tr></thead>
        <tbody>
          {vlansIn(d).map((id) => (
            <tr key={id}>
              <td className="num">{id}</td>
              <td className="num">{list(ports.filter((p) => vlanOf(d, p).untagged === id).map((p) => p + 1))}</td>
              <td className="num">{list(ports.filter((p) => vlanOf(d, p).tagged.includes(id)).map((p) => p + 1))}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h3 className="cx-h">{t("switch.ports")}</h3>
      <table className="cx-table">
        <thead><tr><th>{t("switch.port")}</th><th>{t("switch.untagged")}</th><th>{t("switch.tagged")}</th><th /></tr></thead>
        {/* The key resets a row's fields when the running configuration changes under it. */}
        <tbody>{ports.map((p) => <VlanRow key={`${p}:${JSON.stringify(vlanOf(d, p))}`} d={d} port={p} />)}</tbody>
      </table>
    </>
  );
}

function Save({ d }: { d: Device }) {
  const act = usePageAct(), saved = same(d);
  return (
    <div className="cx-tools">
      <span className={`cx-state ${saved ? "ok" : "warn"}`}>{saved ? t("switch.saved") : t("switch.unsaved")}</span>
      <button className="cx-btn primary" disabled={saved} onClick={() => act(saveSwitchConfig, d.id)}>{t("switch.saveConfig")}</button>
    </div>
  );
}

export function SwitchPage({ game, deviceId, host }: { game: GameState; deviceId: string; host: string }) {
  const [tab, setTab] = useState<Tab>("system");
  const d = game.devices.find((x) => x.id === deviceId);
  if (!d) return null;
  const { look, title, frame } = lookOf(d);
  const nav = (
    <nav className={frame === "side" ? "cx-side" : "cx-tabs"}>
      {TABS.map((k) => (
        <button key={k} className="cx-tab" aria-pressed={tab === k} onClick={() => setTab(k)}>
          {t(TAB_KEY[k])}{k === "save" && !same(d) ? " *" : ""}
        </button>
      ))}
    </nav>
  );
  return (
    <div className="cx sw" data-look={look}>
      <header className="cx-head">
        <span className="cx-brand"><b>{title}</b><span>{modelById(d.model).name}</span></span>
        <span className="cx-host">{host}</span>
      </header>
      <div className={`sw-body ${frame}`}>
        {nav}
        <main className="cx-main">
          {tab === "system" && <System game={game} d={d} />}
          {tab === "ports" && <Ports game={game} d={d} />}
          {tab === "groups" && <Groups d={d} />}
          {tab === "vlans" && <Vlans d={d} />}
          {tab === "save" && <Save d={d} />}
        </main>
      </div>
    </div>
  );
}
