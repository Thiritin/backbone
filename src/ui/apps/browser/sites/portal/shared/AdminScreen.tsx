import { t } from "../../../../../../i18n/en";
import type { Screen, ScreenName, ScreenProps } from "./nav";
import { Clients, ClientSummary } from "./Clients";
import { Invoices } from "./Invoices";
import { Quotes } from "./Quotes";
import { Settings } from "./Settings";
import { Orders } from "./Orders";
import { ProductEdit } from "./ProductEdit";
import { Products } from "./Products";
import { Servers } from "./Servers";
import { Modules } from "./Modules";
import { PaymentMethods } from "./Payments";
import { LicenceScreen, UpdatesScreen } from "./Licence";

export const SCREEN_LABEL: Partial<Record<ScreenName, string>> = {
  home: t("shop-admin.home"), products: t("shop-admin.products"), settings: t("shop-admin.settings"), servers: t("shop-admin.servers"),
  orders: t("shop-admin.pendingOrders"), clients: t("shop-admin.clients"), invoices: t("shop-admin.invoices"), quotes: t("shop-admin.quotes"),
  licence: t("shop-admin.licence"), updates: t("shop-admin.updates"),
};

function Home({ game, go }: ScreenProps) {
  const pending = game.tickets.filter((x) => x.kind === "order" && x.status === "open").length;
  const rows: [ScreenName, number][] = [["orders", pending], ["clients", game.customers.filter((c) => c.churnedAt === null).length], ["products", game.shop.products.length]];
  return (
    <dl className="pt-fields">
      {rows.map(([name, n]) => <div key={name}><dt><a href="#" onClick={(e) => { e.preventDefault(); go({ name }); }}>{SCREEN_LABEL[name]}</a></dt><dd className="num">{n}</dd></div>)}
    </dl>
  );
}

// The admin screen an address names; every shop system shows the same functions under its own navigation.
export function AdminScreen({ screen, ...props }: ScreenProps & { screen: Screen }) {
  switch (screen.name) {
    case "products": return <Products {...props} />;
    case "product": return <ProductEdit {...props} id={screen.id ?? ""} tab={screen.tab} />;
    case "settings": return <Settings {...props} />;
    case "servers": return <><Servers game={props.game} /><Modules game={props.game} /></>;
    case "orders": return <Orders {...props} />;
    case "clients": return <Clients {...props} />;
    case "client": return <ClientSummary {...props} id={screen.id ?? ""} tab={screen.tab} />;
    case "invoices": return <><Invoices {...props} /><PaymentMethods game={props.game} /></>;
    case "quotes": return <Quotes {...props} id={screen.id} />;
    case "licence": return <LicenceScreen {...props} />;
    case "updates": return <UpdatesScreen {...props} />;
    default: return <Home {...props} />;
  }
}
