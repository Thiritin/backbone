import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import type { ShopId } from "../../../../../sim/10-catalog/shops";
import { shopArchive } from "../../../../../sim/10-catalog/archives";
import type { GameState } from "../../../../../sim/50-state";
import { downloadableRelease } from "../../../../../sim/80-business/shop";
import { downloadMbps } from "../../../../../sim/90-actions/media";
import { startDownload, useProgress } from "../../../../downloads";
import { useStore } from "../../../../store";
import "./shop-download.css";

// The vendor's archive as a row with file name, size and Download button; a vendor without a release for the player says a licence is needed.
export function ShopDownload({ game, id }: { game: GameState; id: ShopId }) {
  const release = downloadableRelease(game, id), file = release ? shopArchive(id, release.version) : null;
  const p = useProgress(file?.name ?? ""), online = useStore((s) => downloadMbps(s.game) > 0);
  if (!release || !file) return <p className="sd-locked">{t("shop-downloads.licenceNeeded")}</p>;
  const has = game.media.files.includes(file.name);
  const label = has ? t("browser-sites-2.downloaded") : p !== null ? t("browser-sites-2.downloading", { pct: Math.floor(p * 100) }) : online ? t("shop-downloads.download") : t("browser-sites-2.noInternet");
  return (
    <table className="sd-table">
      <thead><tr><th>{t("shop-downloads.file")}</th><th>{t("shop-downloads.size")}</th><th /></tr></thead>
      <tbody>
        <tr>
          <td className="num">{file.name}</td>
          <td className="num">{t("shop-downloads.mb", { mb: file.mb.toLocaleString(LOCALE, { maximumFractionDigits: 1 }) })}</td>
          <td><button type="button" className="sd-btn" disabled={has || p !== null || !online} onClick={() => startDownload(file.name)}>{label}</button></td>
        </tr>
      </tbody>
    </table>
  );
}

// The three steps after the download: upload and extract, database, web installer.
export function InstallSteps({ game }: { game: GameState }) {
  const url = `portal.${game.company.domain || "example.com"}/install/`;
  return (
    <>
      <li>{t("shop-downloads.upload")}</li>
      <li>{t("shop-downloads.database")}</li>
      <li>{t("shop-downloads.installer", { url })}</li>
    </>
  );
}
