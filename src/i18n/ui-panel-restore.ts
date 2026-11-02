import type { Dict } from "./lang";

export default {
  "error.backupStoreOffline": () => "The backup server is not reachable.",
  "error.restoring": () => "A restore is already running on this server.",
  "error.noPoint": () => "This backup holds no copy of the site.",
} satisfies Dict;
