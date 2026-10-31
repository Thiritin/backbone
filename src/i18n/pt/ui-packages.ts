import type { Dict } from "../lang";

export default {
  "error.packageProduct": () => "Esta instalação não vende esse produto.",
  "error.packageName": () => "Os nomes de pacote usam até 24 letras, dígitos, espaços, hífenes e sublinhados.",
  "error.packageTaken": () => "Já existe um pacote com este nome.",
  "error.packageSpec": () => "Indique um tamanho de CPU, RAM e disco acima de zero.",
  "error.packageLimit": () => "Uma instalação guarda no máximo 12 pacotes.",
  "error.packageInUse": () => "Há contas ativas que ainda usam este pacote.",
  "error.packageMissing": () => "Este pacote não existe no host escolhido.",
  "error.packageTooSmall": () => "O pacote é demasiado pequeno para o plano encomendado.",
  "error.username": () => "Os nomes de utilizador começam com uma letra e usam minúsculas e dígitos.",
  "error.usernameTaken": () => "Este nome de utilizador já está em uso.",
} satisfies Dict;
