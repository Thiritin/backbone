import { shopById } from "../../../../../../sim/10-catalog/shops";
import { mailImpaired, salesAddress } from "../../../../../../sim/80-business/mail";
import { finishShopSetup } from "../../../../../../sim/90-actions/portal";
import { t } from "../../../../../../i18n/en";
import { useStore } from "../../../../../store";
import { CompanyStep, DoneStep, NumberingStep, SetupWizard, type SetupStep } from "../../../../setup/SetupWizard";
import type { Screen, ScreenName, ScreenProps } from "./nav";
import { CycleDiscounts } from "./Settings";
import { Products } from "./Products";
import { Servers } from "./Servers";
import { PaymentMethods } from "./Payments";
import { GoLive } from "./GoLive";

// The shop's first-run wizard; the step sits in the address so a product opened from it comes back to the same step.
export function ShopSetup({ screen, ...props }: ScreenProps & { screen: Screen }) {
  const act = useStore((s) => s.act);
  const { game, go } = props;
  const finish = (name: ScreenName = "home") => { act(finishShopSetup); go({ name }); };
  const done: [ScreenName, string][] = [["products", "shop-admin.products"], ["orders", "shop-admin.pendingOrders"], ["clients", "shop-admin.clients"], ["servers", "shop-admin.servers"]];
  const steps: SetupStep[] = [
    { id: "company", label: t("setup.step.company"), body: <><CompanyStep game={game} currency /><NumberingStep game={game} /></> },
    { id: "discounts", label: t("shop-admin.cycleDiscounts"), body: <CycleDiscounts game={game} /> },
    { id: "products", label: t("shop-admin.products"), body: <Products {...props} /> },
    { id: "servers", label: t("shop-admin.servers"), body: <Servers game={game} /> },
    { id: "payments", label: t("payment-methods.title"), body: <PaymentMethods game={game} /> },
    { id: "mail", label: t("setup.step.mail"), body: (
      <dl className="setup-fields">
        <div><dt>{t("setup.mail.sender")}</dt><dd>{salesAddress(game)}</dd></div>
        <div><dt>{t("setup.mail.delivery")}</dt><dd>{t(mailImpaired(game) ? "setup.mail.failed" : "setup.mail.working")}</dd></div>
      </dl>
    ) },
    { id: "golive", label: t("setup.golive.title"), body: <GoLive game={game} /> },
    { id: "done", label: t("setup.step.done"), body: <DoneStep links={done.map(([name, key]) => [t(key), () => finish(name)])} /> },
  ];
  return <SetupWizard program={shopById(game.shop.variant!).name} steps={steps} step={screen.tab} onStep={(tab) => go({ name: screen.name, tab })} onClose={() => finish()} />;
}
