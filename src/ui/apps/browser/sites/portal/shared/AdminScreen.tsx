import { useStore } from "../../../../../store";
import { finishShopSetup } from "../../../../../../sim/90-actions/portal";
import { Dashboard, type DashKind } from "./Dashboard";
import { PBtn } from "./ui";
import { t } from "../../../../../../i18n/en";
import type { Screen, ScreenName, ScreenProps } from "./nav";
import { Clients, ClientSummary } from "./Clients";
import { Invoices } from "./Invoices";
import { Quotes } from "./Quotes";
import { Settings, type SettingsTab } from "./Settings";
import { ShopSetup } from "./Setup";
import { OrderDetail, Orders } from "./Orders";
import { ServiceDetail } from "./Service";
import { Emails } from "./Emails";
import { ProductEdit } from "./ProductEdit";
import { ProductCreate, Products } from "./Products";
import { Servers } from "./Servers";
import { Marketplace } from "./Marketplace";
import { LicenceScreen, UpdatesScreen } from "./Licence";

export const SCREEN_LABEL: Partial<Record<ScreenName, string>> = {
  home: t("shop-admin.home"), products: t("shop-admin.products"), settings: t("shop-admin.settings"), servers: t("shop-admin.servers"),
  orders: t("shop-admin.pendingOrders"), clients: t("shop-admin.clients"), invoices: t("shop-admin.invoices"), quotes: t("shop-admin.quotes"),
  emails: t("shop-mail.emails"), marketplace: t("shop-market.title"), licence: t("shop-admin.licence"), updates: t("shop-admin.updates"),
};

// The admin screen an address names; every shop system shows the same functions under its own navigation.
export function AdminScreen({ screen, wizard, dash, label, ...props }: ScreenProps & { screen: Screen; wizard?: boolean; dash?: DashKind; label?: (n: ScreenName) => string }) {
  if (screen.name === "setup") return <ShopSetup screen={screen} {...props} />;
  switch (screen.name) {
    case "products": return <Products {...props} />;
    case "product": if (screen.id === "new" || screen.id === "new-group") return <ProductCreate {...props} group={screen.id === "new-group"} />;
      return <ProductEdit {...props} id={screen.id ?? ""} tab={screen.tab} />;
    case "settings": return <Settings {...props} tab={(screen.tab as SettingsTab) ?? "general"} />;
    case "gateways": return <Settings {...props} tab="gateways" />;
    case "import": return <Settings {...props} tab="import" />;
    case "servers": return <Servers game={props.game} />;
    case "marketplace": return <Marketplace game={props.game} go={props.go} tab={screen.tab === "gateways" ? "gateways" : "modules"} />;
    case "orders": return <Orders {...props} />;
    case "order": return <OrderDetail {...props} id={screen.id ?? ""} />;
    case "service": return <ServiceDetail {...props} id={screen.id ?? ""} />;
    case "clients": return <Clients {...props} />;
    case "client": return <ClientSummary {...props} id={screen.id ?? ""} tab={screen.tab} />;
    case "invoices": return <Invoices {...props} />;
    case "quotes": return <Quotes {...props} id={screen.id} />;
    case "emails": return <Emails {...props} />;
    case "licence": return <LicenceScreen {...props} />;
    case "updates": return <UpdatesScreen {...props} />;
    default: return <><SetupPanel {...props} show={!!wizard} /><Dashboard {...props} dash={dash} label={label} /></>;
  }
}

// The first-login panel of the systems that opened the setup wizard on the first sign-in.
function SetupPanel({ game, go, show }: ScreenProps & { show: boolean }) {
  const act = useStore((s) => s.act);
  if (!show || game.shop.setupDone !== false) return null;
  return (
    <div className="pt-wizard" role="region" aria-label={t("setup.title")}>
      <strong>{t("shop-admin.d.wizardText")}</strong>
      <PBtn primary onClick={() => go({ name: "setup" })}>{t("setup.title")}</PBtn>
      <PBtn onClick={() => act(finishShopSetup)}>{t("shop-admin.d.dismiss")}</PBtn>
    </div>
  );
}

// The title of a create page, which sits under its list in the menu.
export const titleOf = (s: Screen): string | undefined => (s.name === "product" && s.id === "new" ? t("shop-admin.createProduct") : s.name === "product" && s.id === "new-group" ? t("shop-admin.createGroup") : undefined);
