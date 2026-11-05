import type { ReactNode } from "react";
import { yearOf } from "../../../../../../sim/00-core/time";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { AdminScreen, SCREEN_LABEL, titleOf } from "./AdminScreen";
import type { DashKind } from "./Dashboard";
import { ClientArea } from "./ClientArea";
import { navOf, screenArgs, screenOf, type ScreenName } from "./nav";
import { StoreFront } from "./StoreFront";
import { VersionFooter } from "./Licence";
import { eraOf } from "../whmCache/Admin";
import type { Skin, SkinProps } from "../skins";
import "../portal.css";

export interface Look {
  flat?: boolean;
  // First game year of the stepper (Choose, Configure, Review) on the order pages.
  stepsFrom?: number;
  // Class of the skin, styled by its skin.css and the era suffix early, mid or late.
  cls: string;
  nav: "side" | "top";
  // Admin screens in menu order, and the names this system gives them.
  screens?: ScreenName[];
  labels?: Partial<Record<ScreenName, string>>;
  // Start page widgets of the real product, and a small mark in front of each menu entry.
  dash?: DashKind;
  icon?: (n: ScreenName) => ReactNode;
  market?: "exec" | "box";
  // Which era class applies, where the system's looks follow something other than the game year.
  era?: (p: { hour: number; major: string }) => string;
}

const ALL: ScreenName[] = ["home", "clients", "orders", "invoices", "quotes", "products", "servers", "settings", "emails", "marketplace", "licence", "updates"];

// One shop system's admin, store front and client area: the shared screens inside the system's own frame.
export function makeSkin(look: Look): Skin {
  const Frame = ({ game, variant, major, children, nav }: SkinProps & { children: ReactNode; nav?: ReactNode }) => (
    <div className={`portal pshop ${look.cls} ${look.cls}-${look.era ? look.era({ hour: game.hour, major }) : eraOf(game.hour)} nav-${look.nav}`}>
      <header className="shop-head"><span className="shop-logo">{shopById(variant).name}</span></header>
      <div className="ps-body">{nav}<main className="ps-main">{children}</main></div>
      <VersionFooter game={game} variant={variant} />
    </div>
  );
  const Admin = (props: SkinProps) => {
    const { game, route, open } = props, screen = screenOf(route.query);
    const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
    const screens = look.screens ?? ALL, current = screens.includes(screen.name) ? screen.name : navOf(screen.name);
    const nav = (
      <nav className="shop-nav">
        {screens.map((n) => <a key={n} href="#" title={look.labels?.[n] ?? SCREEN_LABEL[n]} className={current === n ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: n }); }}>{look.icon?.(n)}{look.labels?.[n] ?? SCREEN_LABEL[n]}</a>)}
      </nav>
    );
    const title = titleOf(screen);
    return <Frame {...props} nav={nav}>{title && <h1 className="ps-title">{title}</h1>}<AdminScreen game={game} screen={screen} dash={look.dash} market={look.market} label={(n) => look.labels?.[n] ?? SCREEN_LABEL[n] ?? n} go={go} toClient={(c) => open("client", {}, { c })} browse={props.browse} /></Frame>;
  };
  const Store = (props: SkinProps) => <Frame {...props}><StoreFront {...props} flat={look.flat} steps={look.stepsFrom !== undefined && yearOf(props.game.hour) >= look.stepsFrom} /></Frame>;
  const Client = (props: SkinProps) => <Frame {...props}><ClientArea game={props.game} customerId={props.route.query.get("c")} /></Frame>;
  return { Admin, Store, Client };
}
