import type { ReactNode } from "react";
import { yearOf } from "../../../../../../sim/00-core/time";
import { shopById } from "../../../../../../sim/10-catalog/shops";
import { AdminScreen, SCREEN_LABEL } from "./AdminScreen";
import { ClientArea } from "./ClientArea";
import { screenArgs, screenOf, type ScreenName } from "./nav";
import { StoreFront } from "./StoreFront";
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
}

const ALL: ScreenName[] = ["home", "clients", "orders", "invoices", "products", "options", "servers"];

// One shop system's admin, store front and client area: the shared screens inside the system's own frame.
export function makeSkin(look: Look): Skin {
  const Frame = ({ game, variant, children, nav }: SkinProps & { children: ReactNode; nav?: ReactNode }) => (
    <div className={`portal shop ${look.cls} ${look.cls}-${eraOf(game.hour)} nav-${look.nav}`}>
      <header className="shop-head"><span className="shop-logo">{shopById(variant).name}</span></header>
      <div className="shop-body">{nav}<main className="shop-main">{children}</main></div>
    </div>
  );
  const Admin = (props: SkinProps) => {
    const { game, route, open } = props, screen = screenOf(route.query);
    const go = (s: Parameters<typeof screenArgs>[0]) => open("admin", {}, screenArgs(s));
    const current = screen.name === "product" ? "products" : screen.name === "client" ? "clients" : screen.name;
    const nav = (
      <nav className="shop-nav">
        {(look.screens ?? ALL).map((n) => <a key={n} href="#" className={current === n ? "on" : ""} onClick={(e) => { e.preventDefault(); go({ name: n }); }}>{look.labels?.[n] ?? SCREEN_LABEL[n]}</a>)}
      </nav>
    );
    return <Frame {...props} nav={nav}><AdminScreen game={game} screen={screen} go={go} toClient={(c) => open("client", {}, { c })} /></Frame>;
  };
  const Store = (props: SkinProps) => <Frame {...props}><StoreFront {...props} flat={look.flat} steps={look.stepsFrom !== undefined && yearOf(props.game.hour) >= look.stepsFrom} /></Frame>;
  const Client = (props: SkinProps) => <Frame {...props}><ClientArea game={props.game} customerId={props.route.query.get("c")} /></Frame>;
  return { Admin, Store, Client };
}
