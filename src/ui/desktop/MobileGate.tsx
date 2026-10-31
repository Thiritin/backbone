import { t } from "../../i18n/en";
export const isMobile = matchMedia("(hover: none) and (pointer: coarse)").matches;

export function MobileGate() {
  return (
    <div className="mobile-gate">
      <img src="favicon.svg" alt="" width={64} height={64} />
      <h1>{t("desktop.mobile.title")}</h1>
      <p>{t("desktop.mobile.text")}</p>
      <a href="https://discord.gg/e8nTAV8Yk7" target="_blank" rel="noopener">{t("desktop.mobile.discord")}</a>
    </div>
  );
}
