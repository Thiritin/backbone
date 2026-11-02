import type { Dict } from "../lang";

export default {
  "error.backupStoreOffline": () => "El servidor de copias de seguridad no es accesible.",
  "error.restoring": () => "Ya hay una restauración en curso en este servidor.",
  "error.noPoint": () => "Esta copia de seguridad no contiene el sitio.",
} satisfies Dict;
