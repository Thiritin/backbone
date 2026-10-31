import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import { LOCALE } from "../lang";

type Params = Record<string, string | number>;
const day = (hour: string | number) => dateOf(Number(hour)).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const FORM: Record<string, string> = { sole: "empresário em nome individual", partnership: "sociedade em nome coletivo", limited: "sociedade por quotas" };
const pay = (p: Params) => `Transfira ${euroCents(Number(p.amount))} até ${day(p.due)} para ${p.iban ? `o IBAN ${p.iban}` : `a conta ${p.account}, código do banco ${p.code}`}, com a referência ${p.number}.`;

export default {
  "doc.form.partnership": () => "Alteração de registo GA-2.pdf",
  "doc.form.limited": () => "Pacto social.pdf",
  "error.notRegistered": () => "A empresa ainda não está registada.",
  "error.legalFormDown": () => "Uma forma jurídica só pode mudar para uma superior.",
  "error.changePending": () => "Já está em curso uma mudança de forma jurídica.",
  "error.formSigned": () => "Este formulário já está assinado.",
  "error.mailAddress": () => "Introduz um endereço de email válido.",
  "error.unknownLetter": () => "Esta carta já não existe.",
  "ledger.tradeRegistration": () => "Taxa de registo da atividade",
  "ledger.tradeChange": () => "Taxa de alteração do registo",
  "ledger.notary": () => "Honorários notariais, pacto social",
  "ledger.registerEntry": () => "Taxa de inscrição no registo comercial",
  "ledger.chamber": (p) => `Quota base da câmara de comércio ${p.year}`,
  "sim.index.cat.government": () => "Administração pública",
  "sim.index.office": () => "Regista uma atividade ou muda a sua forma jurídica.",
  "browser-sites-1.ix.title": () => "Diretório Yahoy!",

  "letter.officeRegistered.subject": (p) => `Registo de atividade n.º GA ${p.number}`,
  "letter.officeRegistered.body": (p) => `Confirmamos o registo de ${p.name} com o número GA ${p.number}. ${pay(p)}`,
  "letter.officeChange.subject": () => "Alteração do registo de atividade",
  "letter.officeChange.body": (p) => `Confirmamos que ${p.name} está registada como ${FORM[p.form] ?? p.form} a partir de hoje. ${pay(p)}`,
  "letter.notaryInvoice.subject": (p) => `Fatura ${p.number}`,
  "letter.notaryInvoice.body": (p) => `Pela escritura do pacto social de ${p.name} e o seu depósito no registo comercial cobramos ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.registerEntry.subject": () => "Inscrição no registo comercial",
  "letter.registerEntry.body": (p) => `${p.name} foi inscrita no registo comercial como ${FORM[p.form] ?? p.form}. A inscrição produz efeitos a partir de hoje. A nossa fatura pela inscrição segue em separado.`,
  "letter.registerInvoice.subject": (p) => `Fatura ${p.number}`,
  "letter.registerInvoice.body": (p) => `Pela inscrição de ${p.name} no registo comercial cobramos ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.chamberFee.subject": (p) => `Quota de associado ${p.year}`,
  "letter.chamberFee.body": (p) => `Como atividade registada, ${p.name} é membro da câmara de comércio. Com ${p.staff} funcionários, a sua quota base para ${p.year} é de ${euroCents(Number(p.amount))}. ${pay(p)}`,

  "ticket.mail.bounce.subject": () => "Mensagem não entregue devolvida ao remetente",
  "ticket.mail.bounce.text": (p) => `A sua mensagem para ${p.to} não foi entregue. O endereço não existe.`,
  "ticket.mail.noForm.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.noForm.text": () => "Obrigado pela sua mensagem. Não encontrámos nenhum pedido em anexo. Anexe o formulário assinado.",
  "ticket.mail.wrongDesk.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.wrongDesk.text": () => "Obrigado pela sua mensagem. Este pedido não é da nossa competência. Envie-o para o endereço indicado no formulário.",
  "ticket.mail.unsigned.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.unsigned.text": () => "Obrigado pelo seu pedido. O formulário não está assinado. Assine-o e envie-o novamente.",
  "ticket.mail.capital.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.capital.text": (p) => `Obrigado pelo pacto social assinado. Uma sociedade por quotas precisa de um capital social de ${euro(Number(p.amount))} na sua conta antes de a podermos registar. Envie o pacto novamente quando o capital estiver disponível.`,
  "ticket.mail.notaryFiled.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.notaryFiled.text": (p) => `Obrigado pelo pacto social assinado de ${p.name}. Vamos depositá-lo no registo comercial no prazo de ${p.days} dias úteis. O registo confirmará a inscrição por carta.`,
  "ticket.mail.officeReceived.subject": (p) => `RE: ${p.subject}`,
  "ticket.mail.officeReceived.text": (p) => `Recebemos a alteração do registo de ${p.name}. Vai receber a nossa confirmação por carta no prazo de ${p.days} dias úteis.`,
} satisfies Dict;
