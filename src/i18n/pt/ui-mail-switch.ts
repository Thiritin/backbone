import type { Dict } from "../lang";

export default {
  "mailswitch.title": () => "Ainda neste fornecedor",
  "mailswitch.mail": (p) => (Number(p.n) === 1 ? "1 mensagem não foi importada no novo fornecedor." : `${p.n} mensagens não foram importadas no novo fornecedor.`),
  "mailswitch.roles": () => "Uma caixa aqui ainda é a caixa principal ou recebe correio de vendas, suporte ou abuso.",
  "mailswitch.collectors": (p) => (Number(p.n) === 1 ? "1 caixa ainda recolhe correio daqui." : `${p.n} caixas ainda recolhem correio daqui.`),
  "mailswitch.source": () => "Endereço anterior",
  "mailswitch.password": () => "Palavra-passe",
  "mailswitch.target": () => "Na caixa",
  "mailswitch.start": () => "Iniciar importação",
  "mailswitch.from": () => "De",
  "mailswitch.to": () => "Para",
  "mailswitch.status": () => "Estado",
  "mailswitch.running": (p) => `Em curso até ${p.date}`,
  "mailswitch.done": (p) => (Number(p.n) === 1 ? "1 mensagem importada" : `${p.n} mensagens importadas`),
} satisfies Dict;
