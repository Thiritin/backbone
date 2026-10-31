import { euro } from "../../sim/00-core/money";
import type { Dict } from "../lang";

export default {
  "event.breach.title": () => "Dados de clientes roubados",
  "event.breach.text": (p) => `Atacantes copiaram os dados de clientes de ${p.host} e exigem ${euro(Number(p.ransom))} em ${p.hours} horas.`,
  "event.breachPress.title": () => "Violação de dados na imprensa",
  "event.breachPress.text": (p) => `Sites de tecnologia noticiam que dados de clientes de ${p.host} estão à venda online. ${Number(p.customers) === 1 ? "Um cliente foi afetado" : `${p.customers} clientes foram afetados`}.`,
  "event.breachFine.title": () => "Coima de proteção de dados",
  "event.breachFine.text": (p) => `A autoridade de proteção de dados aplicou à empresa uma coima de ${euro(Number(p.amount))} pela violação em ${p.host}.`,
  "ticket.extortion.data.subject": () => "Os dados dos teus clientes estão à venda",
  "ticket.extortion.data.text": (p) =>
    `Temos os dados de clientes de ${p.host} e colocámo-los à venda online. Envia ${euro(Number(p.ransom))} em 72 horas e retiramos o anúncio. Depois disso, quem oferecer mais leva tudo.`,
  "ledger.ransom": (p) => `Resgate por ${p.host}`,
  "ledger.fine": (p) => `Coima de proteção de dados por ${p.host}`,
  "outcome.ransomPaid": () => "Resgate pago",
  "outcome.ransomRefused": () => "Resgate recusado",
} satisfies Dict;
