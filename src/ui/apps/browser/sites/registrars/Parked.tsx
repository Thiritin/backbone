import type { CSSProperties } from "react";
import { t } from "../../../../../i18n/en";
import { yearOf } from "../../../../../sim/00-core/time";
import { registrarById, registrarHost, type RegistrarId } from "../../../../../sim/10-catalog/registrars";
import { domainOf, nameServers } from "../../../../../sim/30-customers/registry";
import type { GameState } from "../../../../../sim/50-state";
import { REGISTRAR_HUE } from "./RegistrarPage";
import "./registrars.css";

// The partner's page for a domain parked on its name servers.
export function ParkedPage({ game, registrar, domain }: { game: GameState; registrar: RegistrarId; domain: string }) {
  const r = registrarById(registrar)!, d = domainOf(game, domain);
  return (
    <div className="rg rg-parked" style={{ "--hue": REGISTRAR_HUE[registrar] } as CSSProperties}>
      <span className="wm">{r.name}</span>
      <h1>{domain}</h1>
      <p>{t("registrarPanel.parkedAt", { domain, name: r.name })}</p>
      {d && (
        <dl>
          <dt>{t("registrarPanel.nameServers")}</dt>
          {nameServers(game, d).map((h) => <dd key={h} className="num">{h}</dd>)}
        </dl>
      )}
      <footer>© {yearOf(game.hour)} {registrarHost(r)}</footer>
    </div>
  );
}
