import type { Dict } from "../lang";

export default {
  "error.backupStoreOffline": () => "Der Backup-Server ist nicht erreichbar.",
  "error.restoring": () => "Auf diesem Server läuft bereits eine Wiederherstellung.",
  "error.noPoint": () => "Diese Sicherung enthält keine Kopie der Website.",
} satisfies Dict;
