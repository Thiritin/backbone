import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE, type Dict } from "../lang";

const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });

export default {
  "error.portTaken": () => "O software desta máquina já usa uma das suas portas.",
  "error.wrongOs": () => "Este software não corre no sistema operacional desta máquina.",
  "ledger.windoors": (p) => `Windoors Server, ${p.count} ${p.count === 1 ? "máquina" : "máquinas"}`,
  "ledger.licenceRenewal": (p) => `Assinatura ${p.name}, chave ${p.key}`,
  "ticket.mail.licenceRenewed.subject": (p) => `Assinatura ${p.name} renovada`,
  "ticket.mail.licenceRenewed.text": (p) => `A sua assinatura ${p.name} foi renovada por mais um mês. ${p.count === 1 ? "1 chave" : `${p.count} chaves`}, ${euroCents(Number(p.amount))} cobrados.`,
  "ticket.mail.licenceLapsed.subject": (p) => `Assinatura ${p.name} expirada`,
  "ticket.mail.licenceLapsed.text": (p) => `Não foi possível cobrar a renovação da sua chave ${p.name} ${p.key}. A licença expirou e será renovada assim que o pagamento for efetuado.`,
  "ticket.mail.licenceEditionChange.subject": (p) => `Alteração da sua licença ${p.name}`,
  "ticket.mail.licenceEditionChange.text": (p) => `Deixámos de vender a edição ${p.from}. Na próxima renovação, a sua chave ${p.name} ${p.key} será renovada como ${p.to} por ${euroCents(Number(p.amount))} por mês.`,
  "ledger.licenseOnce": (p) => `Licença ${p.name}, ${p.machine}`,
  "ledger.balancer": (p) => `${p.name}, ${p.cluster}`,
  "ledger.appSuite": (p) => `VMwhere App Suite, ${p.cluster}`,
  "software.support.updatesEnded": () => "Atualizações encerradas",
  "software.support.securityEnded": () => "Atualizações de segurança encerradas",
  "ticket.mail.securityEnding.subject": (p) => `${p.software} ${p.version}: fim das atualizações de segurança`,
  "ticket.mail.securityEnding.text": (p) => `As atualizações de segurança de ${p.software} ${p.version} terminam em ${day(p.until)}. Após essa data deixamos de publicar correções de vulnerabilidades para esta versão.`,
} satisfies Dict;
