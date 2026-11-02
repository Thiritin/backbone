import type { ComponentType } from "react";
import { t } from "../../../../../i18n/en";
import type { DeskId } from "../../../../../sim/10-catalog/desks";
import { deskHosts } from "../../../../../sim/40-support/desk-records";
import { held, inDesk } from "../../../../../sim/40-support/desk-work";
import type { Ticket } from "../../../../../sim/40-support/tickets";
import type { GameState } from "../../../../../sim/50-state";
import { deskPath, parseDesk, type DeskRoute } from "../../../../../sim/80-business/deskroutes";
import { FreshduskSite } from "./freshdusk/FreshduskSite";
import { OsTickitSite } from "./ostickit/OsTickitSite";
import { ZenduskSite } from "./zendusk/ZenduskSite";

export interface DeskSiteProps { game: GameState; host: string; route: DeskRoute; go: (url: string) => void }
// A desk's own web software: its pages, the path of its staff home and of a ticket's staff page.
export interface DeskApp { Site: ComponentType<DeskSiteProps>; staff: string; ticket: (t: Ticket) => string }

export const DESK_APPS: Partial<Record<DeskId, DeskApp>> = {
  ostickit: { Site: OsTickitSite, staff: deskPath("ostickit", "scp"), ticket: (tk) => deskPath("ostickit", "staffTicket", { n: tk.ref ?? "" }) },
  zendusk: { Site: ZenduskSite, staff: deskPath("zendusk", "agent"), ticket: (tk) => deskPath("zendusk", "ticket", { n: tk.ref ?? "" }) },
  freshdusk: { Site: FreshduskSite, staff: deskPath("freshdusk", "dashboard"), ticket: (tk) => deskPath("freshdusk", "ticket", { n: tk.ref ?? "" }) },
};

// support.<domain> or a tenant address: the installed desk's app on that path, or the server's not-found page.
export function DeskSite({ game, id, host, path, go }: { game: GameState; id: DeskId; host: string; path: string; go: (url: string) => void }) {
  const app = DESK_APPS[id], route = app && parseDesk(id, path);
  if (!app || !route) return <DeskNotFound path={path} />;
  return <app.Site game={game} host={host} route={route} go={go} />;
}

export function DeskNotFound({ path }: { path: string }) {
  return (
    <div className="br-error">
      <h1>{t("desk.site.notFound")}</h1>
      <p>{t("desk.site.notFoundText", { path: path.split("?")[0] })}</p>
    </div>
  );
}

// Where the Support tile and a ticket notification lead once the desk's app exists: the staff home, or the ticket's page
// for a ticket the desk holds. Null keeps them in the Support window.
export function deskUrl(s: GameState, focus?: { kind: string; id: string }): string | null {
  const app = s.desk && DESK_APPS[s.desk.id], host = deskHosts(s)[0];
  if (!app || !host) return null;
  if (!focus) return host + app.staff;
  const tk = focus.kind === "ticket" ? s.tickets.find((x) => x.id === focus.id) : undefined;
  return tk && inDesk(tk) && held(tk) ? host + app.ticket(tk) : null;
}
