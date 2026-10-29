import { useState } from "react";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { softwareById, softwareOf } from "../../sim/10-catalog/platforms";
import type { GameState } from "../../sim/50-state";
import { mailHost, mailImpaired, MAIL_PROVIDERS, providerById, seatsFor } from "../../sim/80-business/mail";
import { bookMail, cancelMail, selectMailServer } from "../../sim/90-actions/mail";
import { installBlock, installSoftware } from "../../sim/90-actions/software";
import { modelById } from "../../sim/10-catalog/hardware";
import { isOwnVm } from "../../sim/60-infra/cluster";
import { useStore } from "../store";
import { devName } from "./hw";
import { Mark, vmLabel } from "./products/parts";
import "./shop/shop.css";
import "./marketing/marketing.css";
import "./email.css";

type Mode = "external" | "self";

function status(game: GameState): string {
  const m = game.company.mail, host = mailHost(game);
  if (m.kind === "none") return "None";
  if (host?.switching) return "Installing";
  return mailImpaired(game) ? "Mail delivery impaired" : "Delivering";
}

// Where the mail server could go: servers in a rack and the player's own VMs that run nothing yet.
function machines(game: GameState, softwareId: string): { id: string; name: string }[] {
  const servers = game.devices.filter((d) => modelById(d.model).server && d.rackId).map((d) => ({ id: d.id, name: devName(d) }));
  const vms = game.workloads.filter(isOwnVm).map((w) => ({ id: w.id, name: vmLabel(game, w).name }));
  return [...servers, ...vms].filter((m) => installBlock(game, m.id, softwareId) === null);
}

// The company's email: an external provider per seat, or a mail server of its own.
export function EmailSettings({ title = "Email" }: { title?: string }) {
  const { game, act } = useStore();
  const m = game.company.mail, year = yearOf(game.hour);
  const [mode, setMode] = useState<Mode>(m.kind === "self" ? "self" : "external");
  const [pick, setPick] = useState<string | null>(null);
  const provider = m.kind === "external" ? providerById(m.provider) : undefined, host = mailHost(game);
  const monthly = provider && m.kind === "external" ? seatsFor(game) * provider.price(year) : 0;
  const target = pick ?? softwareOf("mail").find((sw) => !sw.from || year >= sw.from)?.id ?? "postfixit";
  const where = machines(game, target);
  return (
    <>
      <h2>{title}</h2>
      <div className="email-body">
      <div className="settings-group">
        <div className="settings-line"><span>Service</span><span>{provider?.name ?? (m.kind === "self" ? softwareById(m.software).name : "None")}</span></div>
        <div className="settings-line settings-divide"><span>Status</span><span>{status(game)}</span></div>
        {m.kind === "external" && <div className="settings-line settings-divide"><span>Seats</span><span className="num">{m.seats}</span></div>}
        {m.kind === "external" && <div className="settings-line settings-divide"><span>Per month</span><span className="num">{euro(monthly)}</span></div>}
        {m.kind !== "none" && <div className="settings-line settings-divide"><span /><button className="btn" onClick={() => act(cancelMail)}>Cancel</button></div>}
      </div>
      <div className="seg email-mode" role="group" aria-label="Email hosting">
        <button aria-pressed={mode === "external"} onClick={() => setMode("external")}>External</button>
        <button aria-pressed={mode === "self"} onClick={() => setMode("self")}>Self-hosted</button>
      </div>
      {mode === "external" ? (
        <div className="email-cards">
          {MAIL_PROVIDERS.map((p) => {
            const own = m.kind === "external" && m.provider === p.id, later = year < p.from;
            return (
              <div key={p.id} className="shop-card">
                <div className="shop-name"><strong>{p.name}</strong></div>
                <dl className="shop-specs">
                  <div><dt>Per seat</dt><dd className="num">{euro(p.price(year))}</dd></div>
                  <div><dt>Seats</dt><dd className="num">{seatsFor(game)}</dd></div>
                  <div><dt>From</dt><dd className="num">{p.from}</dd></div>
                </dl>
                <div className="shop-buy">
                  <span className="grow" />
                  {own ? <span className="pill ok">Booked</span> : <button className="btn primary" disabled={later} onClick={() => act((s) => bookMail(s, p.id))}>Book</button>}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <>
          <div className="email-cards">
            {softwareOf("mail").map((sw) => {
              const own = m.kind === "self" && m.software === sw.id, later = !!sw.from && year < sw.from;
              return (
                <button key={sw.id} className="shop-card email-sw" aria-pressed={target === sw.id} disabled={later} onClick={() => setPick(sw.id)}>
                  <div className="shop-name"><strong><Mark id={sw.id} size={20} /> {sw.name}</strong></div>
                  <dl className="shop-specs">
                    <div><dt>License</dt><dd>Free</dd></div>
                    <div><dt>Install</dt><dd className="num">{sw.installHours} h</dd></div>
                    <div><dt>CPU</dt><dd className="num">{sw.controlPlane.vcpu} vCPU</dd></div>
                    <div><dt>RAM</dt><dd className="num">{sw.controlPlane.ramGb} GB</dd></div>
                    <div><dt>Disk</dt><dd className="num">{sw.controlPlane.diskGb} GB</dd></div>
                    <div><dt>From</dt><dd className="num">{sw.from}</dd></div>
                    {own && <div><dt>Status</dt><dd>In use</dd></div>}
                  </dl>
                </button>
              );
            })}
          </div>
          {host ? (
            <div className="settings-group">
              <div className="settings-line"><span>Mail server</span><span>{host.name}</span></div>
              {m.kind !== "self" && <div className="settings-line settings-divide"><span /><button className="btn primary" onClick={() => act(selectMailServer)}>Use</button></div>}
            </div>
          ) : (
            <div className="mkt-chips email-where" role="group" aria-label="Install on">
              {where.length === 0 && <span className="email-none">No machine is free for a mail server.</span>}
              {where.map((w) => <button key={w.id} className="mkt-chip" onClick={() => act((s) => installSoftware(s, w.id, target))}>{w.name}</button>)}
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}
