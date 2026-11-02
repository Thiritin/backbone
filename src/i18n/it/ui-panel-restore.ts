import type { Dict } from "../lang";

export default {
  "error.backupStoreOffline": () => "Il server di backup non è raggiungibile.",
  "error.restoring": () => "Su questo server è già in corso un ripristino.",
  "error.noPoint": () => "Questo backup non contiene il sito.",
} satisfies Dict;
