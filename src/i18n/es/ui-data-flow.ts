import type { Dict } from "../lang";

export default {
  "dataFlow.uninstall": () => "Desinstalar",
  "dataFlow.needsProgram": () => "Instala un programa de contabilidad para crear clientes y facturas.",
  "dataFlow.import": () => "Importar",
  "dataFlow.file": () => "Archivo",
  "dataFlow.created": () => "Creado",
  "dataFlow.imported": () => "Importado",
  "dataFlow.noFiles": () => "No hay archivos para importar.",
  "dataFlow.exportShop": () => "Exportar clientes y facturas",
  "dataFlow.downloadStatement": () => "Descargar extracto",
  "dataFlow.saved": (p) => `Guardado como ${p.name}`,
  "dataFlow.csv.head": () => "tipo;número;nombre;fecha;importe",
  "dataFlow.csv.customer": () => "cliente",
  "dataFlow.csv.invoice": () => "factura",
  "error.noShop": () => "No hay ningún sistema de tienda configurado.",
  "error.noBankAccount": () => "La empresa no tiene cuenta bancaria.",
  "error.nothingToExport": () => "No hay nada nuevo desde el último archivo.",
  "error.fileImported": () => "Este archivo ya está importado.",
} satisfies Dict;
