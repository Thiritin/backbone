import type { Dict } from "../lang";

export default {
  "error.backupStoreOffline": () => "O servidor de backup está inacessível.",
  "error.restoring": () => "Já existe uma restauração em andamento neste servidor.",
  "error.noPoint": () => "Este backup não contém o site.",
} satisfies Dict;
