import { euroCents } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "error.portTaken": () => "O software desta máquina já usa uma das suas portas.",
  "error.wrongOs": () => "Este software não corre no sistema operacional desta máquina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "máquina" : "máquinas"}`,
  "ledger.licenceRenewal": (p) => `Assinatura ${p.name}, chave ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Assinatura ${p.name} renovada`,
  "ticket.mail.licenceRenewed.text": (p) => `A sua assinatura ${p.name} foi renovada por mais um mês. ${p.count === 1 ? "1 chave" : `${p.count} chaves`}, ${euroCents(Number(p.amount))} cobrados.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Assinatura ${p.name} expirada`,
  "ticket.mail.licenceLapsed.text": (p) => `Não foi possível cobrar a renovação da sua chave ${p.name} ${p.key}. A licença expirou e será renovada assim que o pagamento for efetuado.`,
  "ledger.licenseOnce": (p) => `Licença ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
} satisfies Dict;
