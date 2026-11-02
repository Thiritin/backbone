import type { Dict } from "../lang";

export default {
  "shop-downloads.download": () => "Descargar",
  "shop-downloads.file": () => "Archivo",
  "shop-downloads.size": () => "Tamaño",
  "shop-downloads.mb": (p) => `${p.mb} MB`,
  "shop-downloads.licenceNeeded": () => "Se necesita una licencia válida para descargar.",
  "shop-downloads.upload": () => "Sube el archivo a tu espacio web y extráelo en el Administrador de archivos en la carpeta del subdominio del portal.",
  "shop-downloads.database": () => "Crea una base de datos MySQL con un usuario.",
  "shop-downloads.installer": (p) => `Abre ${p.url} y sigue el instalador.`,
  "shop-downloads.activate": (p) => `Activar ${p.name}`,
} satisfies Dict;
