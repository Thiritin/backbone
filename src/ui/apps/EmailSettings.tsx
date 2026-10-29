import { useState } from "react";
import { euro } from "../../sim/00-core/money";
import { yearOf } from "../../sim/00-core/time";
import { softwareById, softwareOf } from "../../sim/10-catalog/platforms";
import type { GameState } from "../../sim/50-state";
import { FREEMAIL, mailHost, mailImpaired, MAIL_PROVIDERS, providerById, salesAddress, seatsFor } from "../../sim/80-business/mail";
import { bookMail, cancelMail, selectMailServer } from "../../sim/90-actions/mail";
import { useStore } from "../store";
import { Mark } from "./products/parts";
import "./shop/shop.css";
import "./marketing/marketing.css";
import "./email.css";

type Mode = "external" | "self";

function status(game: GameState): string {
  if (mailHost(game)?.switching) return "Installing";
  return mailImpaired(game) ? "Mail delivery impaired" : "Delivering";
}

// The company's email: free Notmail, an external provider per seat, or a mail server of its own.
export function EmailSettings({ title = "Email" }: { title?: string }) {
  const { game, act, openApp } = useStore();
  const m = game.company.mail, year = yearOf(game.hour);
  const [mode, setMode] = useState<Mode>(m.kind === "self" ? "self" : "external");
  const provider = m.kind === "external" ? providerById(m.provider) : undefined, host = mailHost(game);
  const monthly = provider && m.kind === "external" ? seatsFor(game) * provider.price(year) : 0;
  return (
    <>
      <h2>{title}</h2>
      <div className="email-body">
      <div className="settings-group">
        <div className="settings-line"><span>Service</span><span>{provider?.name ?? (m.kind === "self" ? softwareById(m.software).name : FREEMAIL)}</span></div>
        <div className="settings-line settings-divide"><span>Status</span><span>{status(game)}</span></div>
        <div className="settings-line settings-divide"><span>Address</span><span>{salesAddress(game)}</span></div>
        {m.kind === "external" && <div className="settings-line settings-divide"><span>Seats</span><span className="num">{m.seats}</span></div>}
        {m.kind === "external" && <div className="settings-line settings-divide"><span>Per month</span><span className="num">{euro(monthly)}</span></div>}
        {m.kind !== "free" && <div className="settings-line settings-divide"><span /><button className="btn" onClick={() => act(cancelMail)}>Cancel</button></div>}
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
                  {own ? <span className="pill ok">Booked</span> : <button className="btn primary" disabled={later} onClick={() => act(bookMail, p.id)}>Book</button>}
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
                <div key={sw.id} className={`shop-card email-sw${later ? " later" : ""}`}>
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
                </div>
              );
            })}
          </div>
          {host ? (
            <div className="settings-group">
              <div className="settings-line"><span>Mail server</span><span>{host.name}</span></div>
              {m.kind !== "self" && <div className="settings-line settings-divide"><span /><button className="btn primary" onClick={() => act(selectMailServer)}>Use</button></div>}
            </div>
          ) : (
            <div className="settings-group">
              <div className="settings-line"><span>Install a mail server from the Add Software tile of a server in Locations.</span><button className="btn" onClick={() => openApp("Locations")}>Open</button></div>
            </div>
          )}
        </>
      )}
      </div>
    </>
  );
}
