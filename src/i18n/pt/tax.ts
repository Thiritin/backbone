import type { Dict } from "../lang";
import { euro, euroCents } from "../../sim/00-core/money";
import { day, period } from "../tax";

type Params = Record<string, string | number>;
const pay = (p: Params) => `Transfira ${euroCents(Number(p.amount))} até ${day(p.due)} para ${p.iban ? `o IBAN ${p.iban}` : `a conta ${p.account}, código do banco ${p.code}`}, com a referência ${p.number}.`;
const PERIOD: Record<string, string> = {"month": "entrega uma declaração periódica de IVA todos os meses, até ao dia 10 do mês seguinte", "quarter": "entrega uma declaração periódica de IVA todos os trimestres, até ao dia 10 do mês seguinte ao trimestre", "year": "deixa de entregar declarações periódicas e acerta o IVA na declaração anual", "none": "não cobra IVA nem entrega declarações periódicas"};
const TAXNAME: Record<string, string> = {"sole": "imposto sobre o rendimento", "partnership": "imposto sobre o rendimento", "limited": "imposto sobre as sociedades"};

export default {
  "letter.taxQuestionnaire.subject": () => "Questionário de registo fiscal",
  "letter.taxQuestionnaire.body": (p) => `O serviço de comércio informou-nos de que ${p.name} iniciou uma atividade. Preencha o questionário de registo fiscal no DOHLE, em www.dohle.de/erfassung/. Uma empresa cuja faturação fique abaixo de ${euro(Number(p.limit))} por ano pode usar o regime de pequena empresa e não cobra IVA.`,
  "letter.taxNumber.subject": (p) => `O seu número fiscal ${p.number}`,
  "letter.taxNumber.body": (p) => `${p.name} está registada connosco com o número fiscal ${p.number}. Indique-o em todas as declarações e cartas. ${p.period === "none" ? "Como pequena empresa não cobra IVA nem entrega declarações periódicas." : "Entregue a declaração periódica de IVA de cada mês até ao dia 10 do mês seguinte."}`,
  "sim.index.dohle": () => "Entregar declarações fiscais online.",
  "error.taxNoQuestionnaire": () => "O questionário das Finanças ainda não chegou.",
  "error.taxAnswered": () => "O questionário já foi enviado.",
  "error.taxRevenue": () => "Introduza a faturação prevista.",
  "error.taxSmallLimit": () => "A faturação prevista excede o limite do regime de pequena empresa.",
  "letter.taxSurcharge.subject": () => "Coima por entrega tardia",
  "letter.taxSurcharge.body": (p) => `Número fiscal ${p.taxNo}. A declaração periódica de IVA de ${period(p)} devia ter sido entregue até ${day(p.deadline)} e não a recebemos. Fixamos uma coima por entrega tardia de ${euroCents(Number(p.amount))}. ${pay(p)}`,
  "letter.vatEstimate.subject": (p) => `Estimativa do IVA de ${period(p)}`,
  "letter.vatEstimate.body": (p) => `Número fiscal ${p.taxNo}. A declaração periódica de IVA de ${period(p)} continua por entregar, pelo que estimámos o IVA em ${euroCents(Number(p.amount))}. A entrega da declaração substitui esta estimativa. ${pay(p)}`,
  "letter.taxSmallEnd.subject": () => "Fim do regime de pequena empresa",
  "letter.taxSmallEnd.body": (p) => `A faturação de ${p.name} no ano passado foi de ${euro(Number(p.revenue))}, acima do limite de ${euro(Number(p.limit))}. A partir de 1 de janeiro de ${p.year} a empresa cobra IVA e entrega declarações periódicas.`,
  "letter.taxPeriod.subject": (p) => `Período de IVA ${p.year}`,
  "letter.taxPeriod.body": (p) => `A partir de 1 de janeiro de ${p.year}, ${p.name} ${PERIOD[p.period] ?? p.period}.`,
  "ledger.vatReturn": (p) => `Declaração periódica de IVA ${period(p)}`,
  "ledger.vatEstimate": (p) => `Estimativa de IVA ${period(p)}`,
  "ledger.taxSurcharge": (p) => `Coima por entrega tardia ${period(p)}`,
  "error.taxNumber": () => "A empresa ainda não tem número fiscal.",
  "error.taxReturn": () => "Esta declaração não existe.",
  "error.taxNotSmall": () => "A empresa não usa o regime de pequena empresa.",
  "error.taxReturnFiled": () => "Esta declaração já foi entregue.",
  "ticket.mail.dohleId.subject": () => "O seu registo no DOHLE",
  "ticket.mail.dohleId.text": (p) => `Obrigado pelo registo com o número fiscal ${p.number}. O seu ID de ativação é ${p.id}. O código de ativação segue por correio. Introduza ambos em www.dohle.de/registrieren/ para receber o ficheiro de certificado.`,
  "letter.dohleCode.subject": () => "O seu código de ativação DOHLE",
  "letter.dohleCode.body": (p) => `Para o seu registo com o número fiscal ${p.number}, o código de ativação é ${p.code}. Introduza-o com o ID de ativação do nosso e-mail em www.dohle.de/registrieren/.`,
  "error.dohleCert": () => "O ficheiro de certificado DOHLE não foi encontrado no ambiente de trabalho.",
  "error.dohleTaxNumber": () => "O número fiscal não corresponde.",
  "error.dohleMail": () => "Introduza o endereço de e-mail da empresa.",
  "error.dohleNoCode": () => "O código de ativação ainda não chegou.",
  "error.dohleCode": () => "O ID ou o código de ativação está errado.",
  "letter.taxReminder.subject": (p) => `Declaração de impostos ${p.year}`,
  "letter.taxReminder.body": (p) => `Número fiscal ${p.taxNo}. Lembramos que a declaração de ${p.name} relativa a ${p.year} deve ser entregue até ${day(p.deadline)}. Entregue-a no DOHLE.`,
  "letter.taxEstimate.subject": (p) => `Liquidação oficiosa ${p.year}`,
  "letter.taxEstimate.body": (p) => `Número fiscal ${p.taxNo}. A declaração de ${p.name} relativa a ${p.year} não foi entregue, pelo que estimámos o imposto em ${euroCents(Number(p.amount))}. Entregá-la até ao fim do próximo ano substitui esta estimativa. ${pay(p)}`,
  "letter.taxAssessment.subject": (p) => `Nota de liquidação ${p.year}`,
  "letter.taxAssessment.body": (p) => `Número fiscal ${p.taxNo}. Fixamos o ${TAXNAME[p.form] ?? TAXNAME.sole} de ${p.name} relativo a ${p.year}, sobre um lucro tributável de ${euroCents(Number(p.profit))}, em ${euroCents(Number(p.tax))}.${Number(p.carry) > 0 ? ` Um prejuízo de ${euroCents(Number(p.carry))} transita para o ano seguinte.` : ""}${Number(p.fee) > 0 ? ` A coima por atraso de ${p.months} meses é de ${euroCents(Number(p.fee))}.` : ""}${Number(p.credit) > 0 ? ` Já pago sobre a nossa estimativa: ${euroCents(Number(p.credit))}.` : ""} ${p.refund === undefined ? pay(p) : Number(p.refund) > 0 ? `Reembolsamos ${euroCents(Number(p.refund))} na sua conta.` : "Não há pagamento a efetuar."}`,
  "ledger.vatYear": (p) => `Declaração anual de IVA ${p.year}`,
  "ledger.taxLate": (p) => `Coima por atraso ${p.year}`,
  "ledger.taxCredit": (p) => `Crédito da estimativa ${p.year}`,
  "ledger.taxEstimate": (p) => `Imposto estimado ${p.year}`,
  "error.taxYearClosed": () => "A estimativa deste ano é definitiva.",
} satisfies Dict;
