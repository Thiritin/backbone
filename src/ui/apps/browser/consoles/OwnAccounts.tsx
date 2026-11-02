import { useState } from "react";
import { t } from "../../../../i18n/en";
import { companyDomain } from "../../../../sim/30-customers/domains";
import type { GameState } from "../../../../sim/50-state";
import type { Cluster } from "../../../../sim/60-infra/cluster";
import { accountFor, ownWebspacesOn } from "../../../../sim/60-infra/webspace";
import { createOwnWebspace, removeOwnWebspace } from "../../../../sim/90-actions/webspace";
import { usePageAct } from "../pageAct";

// An account for the company's own domain, made the way an admin does it on their own server.
export function OwnAccountForm({ game, c, className = "cx-form" }: { game: GameState; c: Cluster; className?: string }) {
  const act = usePageAct(), [domain, setDomain] = useState(companyDomain(game)), [user, setUser] = useState<string | null>(null);
  const username = user ?? accountFor(domain);
  return (
    <form className={className} onSubmit={(e) => { e.preventDefault(); if (act(createOwnWebspace, c.id, domain, username).ok) setUser(null); }}>
      <fieldset className="cx-group">
        <legend>{t("webspace.own.title")}</legend>
        <label className="cx-field">{t("pkg.domain")}<input value={domain} onChange={(e) => setDomain(e.target.value)} /></label>
        <label className="cx-field">{t("pkg.username")}<input value={username} onChange={(e) => setUser(e.target.value)} /></label>
      </fieldset>
      <div className="cx-tools"><button className="cx-btn primary" type="submit">{t("pkg.create")}</button></div>
    </form>
  );
}

// The company's own accounts on the host; onLogin opens the account's customer side where the panel has one.
export function OwnAccountRows({ game, c, onLogin }: { game: GameState; c: Cluster; onLogin?: (id: string) => void }) {
  const act = usePageAct(), own = ownWebspacesOn(game, c.id);
  if (!own.length) return null;
  return (
    <>
      <h2>{t("webspace.own.list")}</h2>
      <table className="cx-table">
        <thead><tr><th>{t("pkg.domain")}</th><th>{t("pkg.username")}</th><th /></tr></thead>
        <tbody>
          {own.map((o) => (
            <tr key={o.id}>
              <td>{o.domain}</td><td>{o.account}</td>
              <td>
                {onLogin && <button className="cx-btn" onClick={() => onLogin(o.id)}>{t("readouts.cp.loginAs")}</button>}
                <button className="cx-btn" onClick={() => act(removeOwnWebspace, o.id)}>{t("host.cpanic.terminate")}</button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </>
  );
}
