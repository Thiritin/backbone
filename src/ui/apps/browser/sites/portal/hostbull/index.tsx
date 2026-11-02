import { t } from "../../../../../../i18n/en";
import { makeSkin } from "../shared/makeSkin";
import "./skin.css";

export const hostBullSkin = makeSkin({ cls: "sk-bull", nav: "side", labels: { products: t("shop-store.lblOrderPages"), quotes: t("shop-admin.estimates") }, stepsFrom: 2013 });
