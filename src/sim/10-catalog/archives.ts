// docs/design/web-hosting.md 4.1: the archives the player downloads, uploads and extracts, and the tree each one unpacks to.
import type { App } from "./apps";
import type { DeskId } from "./desks";
import type { ShopId } from "./shops";
import { versionInfo, versionsOf } from "./software-versions";

// A path relative to where the archive is extracted and its own size in MB; a trailing "/" marks a folder.
export type ArchiveEntry = [path: string, mb: number];
export interface Archive { name: string; mb: number; entries: ArchiveEntry[] }

export const ARCHIVE_EXT = /\.(zip|tar\.gz|tgz|tar|tar\.bz2)$/;
// Share of the unpacked size a compressed archive takes.
export const PACKED: Record<"zip" | "tar" | "gz" | "bz2", number> = { zip: 0.35, tar: 1, gz: 0.33, bz2: 0.3 };

// Shop systems unpack flat, so the archive goes straight into the folder the shop will run from; the layout follows the
// release's major. OrderBocks is hosted and has no archive.
const major = (id: ShopId, version: string): number => Number(versionInfo(id, version)?.major ?? version);
const SHOP_ARCHIVES: Partial<Record<ShopId, { slug: string; entries: (version: string) => ArchiveEntry[] }>> = {
  whmCache: { slug: "whmcache", entries: (v) => [["admin/", 6], ["attachments/", 0], ["downloads/", 0], ...(major("whmCache", v) >= 6 ? [["crons/", 0.3] as ArchiveEntry] : []), ["includes/", 9], ["install/", 2], ["modules/", 8], ["templates/", 5], ["templates_c/", 0], ["vendor/", 12], ["cart.php", 0.05], ["clientarea.php", 0.08], ["configuration.php.new", 0.001], ["index.php", 0.01]] },
  modemBill: { slug: "modembill", entries: (v) => major("modemBill", v) < 5
    ? [["admin/", 3], ["include/", 4], ["install_v4/", 1], ["templates/", 2], ["config.php.new", 0.001], ["index.php", 0.01]]
    : [["app-modernbill-admin/", 3], ["app-modernbill-order/", 1], ["lib-modernbill/", 4], ["lib-modernbill/include/", 0], ["lib-modernbill/include/config/", 0.01], ["install/", 1], ["templates/", 2], ["index.php", 0.01]] },
  clientExit: { slug: "clientexit", entries: () => [["install/", 2], ["library/", 10], ["modules/", 6], ["templates/", 4], ["uploads/", 0], ["config.php", 0.002], ["index.php", 0.01]] },
  blessta: { slug: "blessta", entries: (v) => [["app/", 8], ["config/", 0.05], ["core/", 6], ...(major("blessta", v) < 3 ? [["install/", 1] as ArchiveEntry] : []), ["plugins/", 4], ["vendors/", 14], ["uploads/", 0], [".htaccess", 0.001], ["index.php", 0.01]] },
  hostBull: { slug: "hostbull", entries: () => [["admin/", 7], ["includes/", 10], ["install/", 2], ["templates/", 6], ["templates_c/", 0], ["attachments/", 0], ["includes/config.php.new", 0.001], ["queue.php", 0.01], ["index.php", 0.01]] },
  ubersmyth: { slug: "ubersmyth", entries: () => [["admin/", 9], ["include/", 12], ["setup/", 2], ["client/", 3], ["config.ini.php.new", 0.001], ["cron.php", 0.01], ["index.php", 0.01]] },
  boxBillin: { slug: "boxbillin", entries: (v) => v.startsWith("0.")
    ? [["data/", 1], ["install/", 1], ["library/", 9], ["locale/", 2], ["modules/", 7], ["themes/", 3], ["vendor/", 12], ["cron.php", 0.01], ["config-sample.php", 0.002], [".htaccess", 0.001], ["index.php", 0.01]]
    : [["bb-library/", 9], ["bb-modules/", 7], ["bb-themes/", 3], ["bb-uploads/", 0], ["install/", 1], ["bb-config-sample.php", 0.002], ["cron.php", 0.01], [".htaccess", 0.001], ["index.php", 0.01]] },
};

// App archives as the projects ship them; WordPass and Drupel unpack into a folder of their own, Joomlah unpacks flat.
const APP_ARCHIVES: Partial<Record<App, Archive>> = {
  wordpass: pack("wordpass-latest.tar.gz", "gz", [["wordpass/", 0], ["wordpass/wp-admin/", 9], ["wordpass/wp-content/", 6], ["wordpass/wp-includes/", 15], ["wordpass/index.php", 0.001], ["wordpass/wp-config-sample.php", 0.003], ["wordpass/wp-login.php", 0.04], ["wordpass/license.txt", 0.02], ["wordpass/readme.html", 0.01]]),
  joomlah: pack("joomlah-latest-full.zip", "zip", [["administrator/", 16], ["components/", 3], ["images/", 1], ["installation/", 3], ["libraries/", 18], ["media/", 12], ["templates/", 2], ["index.php", 0.002], ["htaccess.txt", 0.003]]),
  drupel: pack("drupel-latest.tar.gz", "gz", [["drupel/", 0], ["drupel/core/", 42], ["drupel/modules/", 0.01], ["drupel/sites/", 0.05], ["drupel/sites/default/", 0], ["drupel/sites/default/default.settings.php", 0.03], ["drupel/themes/", 0.01], ["drupel/index.php", 0.001], ["drupel/.htaccess", 0.008]]),
};

function pack(name: string, kind: keyof typeof PACKED, entries: ArchiveEntry[]): Archive {
  return { name, mb: +(entries.reduce((a, [, mb]) => a + mb, 0) * PACKED[kind]).toFixed(2), entries };
}

// The archive a shop vendor hands out for one version, such as whmcache_5.0.zip.
export function shopArchive(id: ShopId, version: string): Archive | null {
  const def = SHOP_ARCHIVES[id];
  return def ? pack(`${def.slug}_${version}.zip`, "zip", def.entries(version)) : null;
}
export const appArchive = (app: App): Archive | null => APP_ARCHIVES[app] ?? null;

// The shop system and release a vendor archive holds.
export function shopOfArchive(name: string): { id: ShopId; version: string } | null {
  for (const id of Object.keys(SHOP_ARCHIVES) as ShopId[]) {
    const v = versionsOf(id).find((x) => shopArchive(id, x.version)!.name === name);
    if (v) return { id, version: v.version };
  }
  return null;
}

// The self-hosted desks as their projects ship them. OsTickit puts the web root under upload/ and its sample config under
// include/ (named ost-config.sample.php before 1.7); FreeScoot is a Laravel app whose web root is public/.
export type SelfDeskId = Extract<DeskId, "ostickit" | "freescoot">;
export const sampleConfig = (version: string): string => (Number(version.split(".")[1]) < 7 ? "ost-config.sample.php" : "ost-sampleconfig.php");
const DESK_ARCHIVES: Record<SelfDeskId, (v: string) => Archive> = {
  ostickit: (v) => pack(`osTickit-v${v}.zip`, "zip", [
    ["upload/", 0], ["upload/api/", 0.2], ["upload/assets/", 2], ["upload/css/", 0.6], ["upload/images/", 1.5], ["upload/include/", 14],
    [`upload/include/${sampleConfig(v)}`, 0.003], ["upload/js/", 3], ["upload/kb/", 0.05], ["upload/pages/", 0.01], ["upload/scp/", 2.5],
    ["upload/setup/", 1.2], ["upload/index.php", 0.002], ["upload/open.php", 0.003], ["upload/view.php", 0.002], ["upload/tickets.php", 0.004],
    ["scripts/", 0.1],
  ]),
  freescoot: (v) => pack(`freescoot-${v}.zip`, "zip", [
    ["app/", 4], ["bootstrap/", 0.05], ["bootstrap/cache/", 0], ["config/", 0.2], ["database/", 0.6], ["Modules/", 0], ["overrides/", 1],
    ["public/", 0], ["public/css/", 1.5], ["public/js/", 4], ["public/img/", 1], ["public/.htaccess", 0.001], ["public/index.php", 0.002],
    ["resources/", 6], ["routes/", 0.05], ["storage/", 0], ["vendor/", 48], [".env.example", 0.001], ["artisan", 0.002],
  ]),
};
export const deskArchive = (id: SelfDeskId, version: string): Archive => DESK_ARCHIVES[id](version);
export const isSelfDesk = (id: string): id is SelfDeskId => id in DESK_ARCHIVES;

// The desk and release a vendor archive holds.
export function deskOfArchive(name: string): { id: SelfDeskId; version: string } | null {
  for (const id of Object.keys(DESK_ARCHIVES) as SelfDeskId[]) {
    const v = versionsOf(id).find((x) => deskArchive(id, x.version).name === name);
    if (v) return { id, version: v.version };
  }
  return null;
}

export function archiveNamed(name: string): Archive | null {
  const app = Object.values(APP_ARCHIVES).find((a) => a.name === name), shop = app ? null : shopOfArchive(name), desk = app || shop ? null : deskOfArchive(name);
  return app ?? (shop && shopArchive(shop.id, shop.version)) ?? (desk && deskArchive(desk.id, desk.version));
}
