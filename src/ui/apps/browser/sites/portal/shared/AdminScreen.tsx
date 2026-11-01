import { t } from "../../../../../../i18n/en";
import type { Screen, ScreenName, ScreenProps } from "./nav";
import { Clients, ClientSummary } from "./Clients";
import { Invoices } from "./Invoices";
import { Options } from "./Options";
import { Orders } from "./Orders";
import { ProductEdit } from "./ProductEdit";
import { Products } from "./Products";
import { Servers } from "./Servers";
import { LicenceScreen, UpdatesScreen } from "./Licence";

export const SCREEN_LABEL: Partial<Record<ScreenName, string>> = {
  home: t("shop-admin.home"), products: t("shop-admin.products"), options: t("shop-admin.options"), servers: t("shop-admin.servers"),
  orders: t("shop-admin.pendingOrders"), clients: t("shop-admin.clients"), invoices: t("shop-admin.invoices"),
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
    case "options": return <Options {...props} />;
    case "servers": return <Servers game={props.game} />;
    case "orders": return <Orders {...props} />;
    case "clients": return <Clients {...props} />;
    case "client": return <ClientSummary {...props} id={screen.id ?? ""} tab={screen.tab} />;
    case "invoices": return <Invoices {...props} />;
    case "licence": return <LicenceScreen {...props} />;
    case "updates": return <UpdatesScreen {...props} />;
    default: return <Home {...props} />;
  }
}
