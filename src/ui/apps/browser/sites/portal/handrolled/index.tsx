import { t } from "../../../../../../i18n/en";
import { makeSkin } from "../shared/makeSkin";
import "./skin.css";

export const handRolledSkin = makeSkin({ cls: "sk-hand", nav: "top", flat: true, noClient: true, labels: { products: t("shop-store.lblPlans") } });
