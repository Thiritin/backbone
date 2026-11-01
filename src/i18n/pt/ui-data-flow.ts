import type { Dict } from "../lang";

export default {
  "dataFlow.uninstall": () => "Desinstalar",
  "dataFlow.needsProgram": () => "Instala um programa de contabilidade para criar clientes e faturas.",
  "dataFlow.import": () => "Importar",
  "dataFlow.file": () => "Ficheiro",
  "dataFlow.created": () => "Criado",
  "dataFlow.imported": () => "Importado",
  "dataFlow.noFiles": () => "Não há ficheiros para importar.",
  "dataFlow.exportShop": () => "Exportar clientes e faturas",
  "dataFlow.downloadStatement": () => "Descarregar extrato",
  "dataFlow.saved": (p) => `Guardado como ${p.name}`,
  "dataFlow.csv.head": () => "tipo;número;nome;data;valor",
  "dataFlow.csv.customer": () => "cliente",
  "dataFlow.csv.invoice": () => "fatura",
  "error.noShop": () => "Não há nenhum sistema de loja configurado.",
  "error.noBankAccount": () => "A empresa não tem conta bancária.",
  "error.nothingToExport": () => "Nada de novo desde o último ficheiro.",
  "error.fileImported": () => "Este ficheiro já foi importado.",
} satisfies Dict;
