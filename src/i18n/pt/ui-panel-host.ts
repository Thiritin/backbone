import type { Dict } from "../lang";

export default {
  "error.holdPayment": () => "A fatura desta conta ainda não foi paga.",
  "error.holdReason": () => "Escolhe um motivo válido.",
  "error.oversellCap": () => "Este host ultrapassaria o seu limite de overselling.",
  "error.licenceCap": () => "A tua licença não permite mais contas.",
  "error.licenceExpired": () => "A tua licença expirou.",
  "event.updateBroke.title": () => "Falha na atualização",
  "event.updateBroke.text": (p) => `A atualização de ${p.cluster} correu mal e os clientes ficam offline mais algumas horas.`,
} satisfies Dict;
