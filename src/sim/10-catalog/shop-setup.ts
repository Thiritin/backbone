// docs/design/shop.md: how each shop system installs, by release: the folder its installer lives in, the config file, the
// paths it needs writable and the cron job that runs its billing.
import { versionInfo } from "./software-versions";
import type { ShopId } from "./shops";

// Write bits a path needs: every class (CHMOD 666 or 777), or just its owner.
export const WRITE_ALL = 0o222, WRITE_OWNER = 0o200;

export interface ShopSetup {
  // The folder the installer sits in, removed after the install; null while the installer is part of the app.
  installDir: string | null;
  // The file the installer writes the database credentials into, relative to the shop folder.
  config: string;
  // The archive ships the config as `<config>.new`; the installer refuses until it is renamed.
  rename: boolean;
  writable: [path: string, bits: number][];
  // Scripts the crontab must run, relative to the shop folder, and the longest interval in hours; null without a cron.
  cron: { scripts: string[]; hours: number } | null;
  // The vendor's guide asks the config file to be locked once the installer is done.
  lock: boolean;
}

const DAILY = 24, FIVE_MINUTES = 1;

export function shopSetup(id: ShopId, version: string): ShopSetup {
  const major = versionInfo(id, version)?.major ?? version, n = Number(major);
  switch (id) {
    case "whmCache":
      return { installDir: "install", config: "configuration.php", rename: true, lock: true,
        writable: [["configuration.php", WRITE_ALL], ["attachments", WRITE_ALL], ["downloads", WRITE_ALL], ["templates_c", WRITE_ALL]],
        cron: { scripts: [n >= 6 ? "crons/cron.php" : "admin/cron.php"], hours: n >= 7 ? FIVE_MINUTES : DAILY } };
    case "modemBill":
      return n < 5
        ? { installDir: "install_v4", config: "config.php", rename: true, lock: true, writable: [["config.php", WRITE_ALL]], cron: { scripts: ["include/scripts/"], hours: DAILY } }
        : { installDir: "install", config: "lib-modernbill/include/config/config.php", rename: false, lock: false,
          writable: [["lib-modernbill/include/config", WRITE_ALL], ["app-modernbill-order", WRITE_ALL]], cron: { scripts: ["lib-modernbill/"], hours: FIVE_MINUTES } };
    case "clientExit":
      return { installDir: "install", config: "config.php", rename: false, lock: false, writable: n < 5 ? [["config.php", WRITE_ALL]] : [], cron: { scripts: ["cron.php"], hours: FIVE_MINUTES } };
    case "blessta":
      return { installDir: n < 3 ? "install" : null, config: "config/blesta.php", rename: false, lock: false,
        writable: n < 3 ? [["config", WRITE_ALL], ["uploads", WRITE_ALL]] : [],
        cron: { scripts: [n < 3 ? "cron.php" : "index.php cron"], hours: FIVE_MINUTES } };
    case "hostBull":
      return { installDir: "install", config: "includes/config.php", rename: true, lock: true,
        writable: [["templates_c", WRITE_ALL], ["includes/config.php", WRITE_ALL]],
        cron: { scripts: n >= 2019 ? ["admin/cron.php", "queue.php"] : ["admin/cron.php"], hours: FIVE_MINUTES } };
    case "ubersmyth":
      return { installDir: "setup", config: "config.ini.php", rename: true, lock: true, writable: [["config.ini.php", WRITE_ALL]], cron: { scripts: ["cron.php"], hours: FIVE_MINUTES } };
    case "boxBillin":
      return String(major).startsWith("0.")
        ? { installDir: "install", config: "config.php", rename: false, lock: false, writable: [["data", WRITE_ALL]], cron: { scripts: ["cron.php"], hours: FIVE_MINUTES } }
        : { installDir: "install", config: "bb-config.php", rename: false, lock: false, writable: [["bb-uploads", WRITE_ALL]], cron: { scripts: ["cron.php"], hours: FIVE_MINUTES } };
    // Hosted: no files, database or cron of the player's.
    case "orderBocks":
      return { installDir: null, config: "", rename: false, lock: false, writable: [], cron: null };
  }
}
