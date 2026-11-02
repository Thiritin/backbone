import type { Dict } from "../lang";

export default {
  "shop-downloads.download": () => "Download",
  "shop-downloads.file": () => "Datei",
  "shop-downloads.size": () => "Größe",
  "shop-downloads.mb": (p) => `${p.mb} MB`,
  "shop-downloads.licenceNeeded": () => "Für den Download ist eine gültige Lizenz erforderlich.",
  "shop-downloads.upload": () => "Laden Sie das Archiv in Ihren Webspace hoch und entpacken Sie es im Dateimanager in den Ordner der Portal-Subdomain.",
  "shop-downloads.database": () => "Legen Sie eine MySQL-Datenbank mit einem Benutzer an.",
  "shop-downloads.installer": (p) => `Rufen Sie ${p.url} auf und folgen Sie dem Installationsassistenten.`,
  "shop-downloads.activate": (p) => `${p.name} aktivieren`,
} satisfies Dict;
