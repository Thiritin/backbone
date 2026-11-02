import type { Dict } from "../lang";

const s = (n: string | number, one: string, many: string) => (Number(n) === 1 ? one : many);

export default {
  "ledger.registrarSignup": (p) => `Inscrição em ${p.name}`,
  "ledger.registrar": (p) => `Taxa de parceiro em ${p.name}`,
  "ledger.certificates": (p) => `${p.count} ${s(p.count, "certificado SSL", "certificados SSL")} em ${p.name}`,
  "ledger.domains": (p) => `${p.count} ${s(p.count, "domínio", "domínios")} em ${p.name}`,
  "ledger.companyMail": (p) => `E-mail da empresa: ${p.name}, ${p.seats} ${s(p.seats, "caixa de correio", "caixas de correio")}`,
  "error.unknownRegistrar": () => "Este parceiro de registo não existe.",
  "error.registrarLater": () => "Este parceiro de registo ainda não está no mercado.",
  "error.registrarCurrent": () => "Já tens um contrato com este parceiro.",
  "error.transferBusy": () => "Os domínios ainda estão a ser transferidos para o parceiro atual.",
  "error.needsRegistrar": () => "Assina primeiro um contrato com um parceiro de registo.",
  "error.registrarOther": () => "Os teus domínios estão registados noutro parceiro.",
  "error.domainInvalid": () => "Usa de 3 a 40 letras, algarismos ou hífenes antes de um TLD que os registos vendam.",
  "error.nsInvalid": () => "Introduz dois nomes de host diferentes, como ns1.example.de.",
  "error.companyDomainOwned": () => "A empresa já tem um domínio.",
  "error.noTransfer": () => "Não há domínios à espera de transferência.",
  "error.unknownMailProvider": () => "Este fornecedor de e-mail não existe.",
  "error.mailProviderLater": () => "Este fornecedor de e-mail ainda não está no mercado.",
  "error.noMailServer": () => "Não há nenhum servidor de e-mail instalado.",
  "error.noMailService": () => "A empresa já usa e-mail gratuito.",
  "error.oneMailServer": () => "A empresa tem um servidor de e-mail.",
  "event.domainsTransferred.title": () => "Domínios transferidos",
  "event.domainsTransferred.text": (p) => `${p.count} ${s(p.count, "domínio é gerido", "domínios são geridos")} agora por ${p.name}.`,
  "event.registrarTier.title": () => "Melhor tarifa de parceiro",
  "event.registrarTier.text": (p) => `Com ${p.domains} domínios, ${p.name} passa a faturar os teus domínios no escalão seguinte.`,
} satisfies Dict;
