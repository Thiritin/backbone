import type { Dict } from "./lang";

export default {
  "shop-downloads.download": () => "Download",
  "shop-downloads.file": () => "File",
  "shop-downloads.size": () => "Size",
  "shop-downloads.mb": (p) => `${p.mb} MB`,
  "shop-downloads.licenceNeeded": () => "A valid licence is required to download.",
  "shop-downloads.upload": () => "Upload the archive to your web space and extract it in the File Manager into the folder of the portal subdomain.",
  "shop-downloads.database": () => "Create a MySQL database and a user for it.",
  "shop-downloads.installer": (p) => `Open ${p.url} and follow the installer.`,
  "shop-downloads.activate": (p) => `Activate ${p.name}`,
} satisfies Dict;
