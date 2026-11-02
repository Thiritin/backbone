import type { Dict } from "../lang";

export default {
  "error.backupStoreOffline": () => "Le serveur de sauvegarde est injoignable.",
  "error.restoring": () => "Une restauration est déjà en cours sur ce serveur.",
  "error.noPoint": () => "Cette sauvegarde ne contient pas le site.",
} satisfies Dict;
