// The install guide every shop system shares: the steps of its vendor's installation documentation, ticked from state.
// Every check is a read of the web space, the licences or the shop; a ticked step stays ticked (the rule of checklist.ts).
import { shopArchive } from "../10-catalog/archives";
import { shopSetup } from "../10-catalog/shop-setup";
import { shopById, type ShopId } from "../10-catalog/shops";
import { shopEra } from "../10-catalog/shop-licences";
import type { GameState } from "../50-state";
import { ALL_PRIVILEGES, webspaceOf, type Webspace } from "./webspace";
import { cronSet, defaultAdmin, filesIn, installDirIn, requirementsOf, shopSpace } from "./shop-files";

// The screen a step is done in.
export type GuideApp = "vendor" | "downloads" | "php" | "domains" | "files" | "databases" | "cron" | "installer" | "admin";
export interface GuideStep {
  id: string;
  // `install-guide.<id>`, filled from params.
  labelKey: string;
  params: Record<string, string>;
  done: boolean;
  optional?: boolean;
  app?: GuideApp;
}

interface Where { ws: Webspace; folder: string }
// The folders in the player's web spaces holding this shop's files; the installed one first.
function placed(s: GameState, id: ShopId): Where[] {
  const out: Where[] = [], at = shopSpace(s);
  if (at && at.id === id) out.push({ ws: at.ws, folder: at.folder });
  for (const o of s.ownWebspaces) {
    const ws = webspaceOf(s, o.id);
    if (!ws) continue;
    for (const p of Object.keys(ws.files)) {
      const folder = p.endsWith("/index.php") ? p.slice(0, -"/index.php".length) : "";
      if (folder && filesIn(ws, folder)?.id === id && !out.some((x) => x.ws === ws && x.folder === folder)) out.push({ ws, folder });
    }
  }
  return out;
}

interface Ctx { s: GameState; id: ShopId; version: string; at: Where[]; installed: boolean }
const spaces = (c: Ctx): Webspace[] => c.s.ownWebspaces.map((o) => webspaceOf(c.s, o.id)).filter((w): w is Webspace => !!w);
const hasDb = (c: Ctx) => spaces(c).some((w) => Object.keys(w.databases).length > 0);
const hasAllUser = (c: Ctx) => spaces(c).some((w) => Object.values(w.dbUsers).some((u) => Object.values(u.grants).some((g) => ALL_PRIVILEGES.every((p) => g.includes(p)))));

interface Def { app: GuideApp; optional?: boolean; params?: (c: Ctx) => Record<string, string>; check: (c: Ctx) => boolean }
const first = (c: Ctx) => c.at[0];
const reqOk = (c: Ctx, key?: "writable" | "config") => {
  const w = first(c);
  return !!w && requirementsOf(c.s, w.ws, w.folder, c.id, c.version).filter((r) => (key ? r.key === key : r.key === "php" || r.key === "ioncube")).every((r) => r.ok);
};

const DEFS: Record<string, Def> = {
  licence: { app: "vendor", check: (c) => c.installed || shopEra(c.id, c.s.hour).kind === "free" || c.s.licenses.some((k) => k.product === c.id) },
  download: { app: "downloads", params: (c) => ({ archive: shopArchive(c.id, c.version)?.name ?? "" }),
    check: (c) => c.installed || c.at.length > 0 || c.s.media.files.includes(shopArchive(c.id, c.version)?.name ?? "") },
  requirements: { app: "php", check: (c) => c.installed || reqOk(c) },
  folder: { app: "domains", check: (c) => c.installed || c.at.length > 0 || spaces(c).some((w) => Object.values(w.domains).some((d) => d.folder !== "public_html")) },
  upload: { app: "files", params: (c) => ({ archive: shopArchive(c.id, c.version)?.name ?? "" }),
    check: (c) => c.installed || c.at.length > 0 || spaces(c).some((w) => Object.values(w.files).some((f) => f.archive === shopArchive(c.id, c.version)?.name)) },
  extract: { app: "files", check: (c) => c.installed || c.at.length > 0 },
  rename: { app: "files", params: (c) => ({ config: shopSetup(c.id, c.version).config }),
    check: (c) => c.installed || (!!first(c) && reqOk(c, "config")) },
  permissions: { app: "files", params: (c) => ({ paths: shopSetup(c.id, c.version).writable.map(([p]) => p).join(", ") }),
    check: (c) => c.installed || (!!first(c) && reqOk(c, "writable")) },
  database: { app: "databases", check: (c) => c.installed || hasDb(c) },
  dbuser: { app: "databases", check: (c) => c.installed || hasAllUser(c) },
  installer: { app: "installer", check: (c) => c.installed },
  removeInstall: { app: "files", params: (c) => ({ dir: shopSetup(c.id, c.version).installDir ?? "" }),
    check: (c) => c.installed && !!first(c) && !installDirIn(first(c).ws, first(c).folder) },
  lockConfig: { app: "files", params: (c) => ({ config: shopSetup(c.id, c.version).config }),
    check: (c) => c.installed && !!first(c) && !requirementsOf(c.s, first(c).ws, first(c).folder, c.id, c.version).some((r) => r.key === "writable" && r.params.path === shopSetup(c.id, c.version).config && r.ok) },
  password: { app: "admin", check: (c) => c.installed && !defaultAdmin(c.s) },
  cron: { app: "cron", params: (c) => ({ scripts: (shopSetup(c.id, c.version).cron?.scripts ?? []).join(", ") }),
    check: (c) => c.installed && !!first(c) && cronSet(first(c).ws, first(c).folder, c.id, c.version) },
  setup: { app: "admin", check: (c) => c.installed && !!c.s.shop.setupDone },
  // The hosted shop: an account in the vendor's control panel.
  account: { app: "vendor", check: (c) => c.s.shop.variant === c.id && !!c.s.shop.install },
  products: { app: "admin", check: (c) => c.s.shop.products.length > 0 },
  hostedSetup: { app: "admin", check: (c) => !!c.s.shop.setupDone },
};

// The steps in the order the vendor's guide lists them, for the release's layout.
function planOf(id: ShopId, version: string): string[] {
  if (id === "orderBocks") return ["account", "products", "hostedSetup"];
  const sp = shopSetup(id, version);
  return [
    "licence", "download", "requirements", "folder", "upload", "extract",
    ...(sp.rename ? ["rename"] : []), ...(sp.writable.length ? ["permissions"] : []),
    "database", "dbuser", "installer",
    ...(id === "hostBull" ? ["password"] : []),
    ...(sp.installDir ? ["removeInstall"] : []), ...(sp.lock ? ["lockConfig"] : []),
    ...(sp.cron ? ["cron"] : []), "setup",
  ];
}

const OPTIONAL = new Set(["password"]);

// The guide of a shop at a release, each step with its state now.
export function guideOf(s: GameState, id: ShopId, version: string): GuideStep[] {
  const at = placed(s, id), installed = s.shop.variant === id && !!s.shop.install?.ws, ticked = s.shop.variant === id ? s.shop.ticked ?? [] : [];
  const c: Ctx = { s, id, version, at, installed };
  return planOf(id, version).map((step) => {
    const d = DEFS[step];
    return { id: step, labelKey: `install-guide.${step}`, params: { shop: shopById(id).name, ...d.params?.(c) }, done: ticked.includes(step) || d.check(c), app: d.app, ...(OPTIONAL.has(step) && { optional: true }) };
  });
}

// Latches the steps seen done, and notes the hour the cron job was seen set.
export function syncShopGuide(s: GameState): void {
  const id = s.shop.variant, v = s.shop.install?.version;
  if (!id || !v) return;
  const seen = guideOf(s, id, v).filter((x) => x.done).map((x) => x.id), ticked = s.shop.ticked ?? [];
  const at = shopSpace(s), ran = at && shopSetup(id, v).cron && cronSet(at.ws, at.folder, id, v) ? s.hour : s.shop.cronRanAt;
  if (seen.length !== ticked.length || ran !== s.shop.cronRanAt) s.shop = { ...s.shop, ticked: [...new Set([...ticked, ...seen])], ...(ran !== undefined && { cronRanAt: ran }) };
}
