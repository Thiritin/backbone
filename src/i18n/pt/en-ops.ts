import type { Dict, Params } from "../lang";

const again = (p: Params) => (Number(p.round) > 1 ? "Este é o nosso segundo aviso, e o conteúdo continua online. " : "");
const second = (p: Params, subject: string) => (Number(p.round) > 1 ? `Segundo aviso: ${subject}` : subject);
const host = (p: Params) => String(p.url).replace(/^https:\/\/([^/]+).*$/, "$1");
const duration = (minutes: number): string =>
  minutes < 60 ? `${minutes} min` : minutes % 60 ? `${Math.floor(minutes / 60)} h ${minutes % 60} min` : `${minutes / 60} h`;

export default {
  "ticket.notice.movie.subject": (p) => second(p, `Violação de direitos de autor em ${host(p)}`),
  "ticket.notice.movie.text": (p) => `${again(p)}Em nome de ${p.sender}, encontrámos em ${p.url} uma cópia sem licença de um dos nossos filmes. Remove-a sem demora.`,
  "ticket.notice.music.subject": (p) => second(p, `Música pirata em ${host(p)}`),
  "ticket.notice.music.text": (p) => `${again(p)}${p.sender} detém os direitos das gravações oferecidas para download em ${p.url}. Remove-as sem demora.`,
  "ticket.notice.youtuber.subject": (p) => second(p, `Elimina ${host(p)} JÁ`),
  "ticket.notice.youtuber.text": (p) =>
    `${again(p)}Fala o TechTimo, 2,3 milhões de subscritores. A página ${p.url} diz que o meu vídeo ${p.video} é o pior unboxing do ano. Isso é difamação e provavelmente também violação de direitos de autor. Apaga o site inteiro hoje.`,
  "ticket.notice.phishing.subject": (p) => second(p, `Página de phishing em ${host(p)}`),
  "ticket.notice.phishing.text": (p) => `${again(p)}A página ${p.url} imita o início de sessão do banco online de ${p.sender} e recolhe as palavras-passe dos nossos clientes. Põe-na offline.`,
  "ticket.notice.spam.subject": (p) => second(p, `Spam a publicitar ${host(p)}`),
  "ticket.notice.spam.text": (p) => `${again(p)}A tua rede enviou 48.000 e-mails de spam na última hora, todos com uma ligação para ${p.url}. Trava o remetente, ou incluímos o teu intervalo de endereços na lista negra.`,
  "ticket.legal.data.subject": (p) => (Number(p.round) > 1 ? `Ordem judicial: dados de ${host(p)}` : `Pedido de dados de clientes: ${host(p)}`),
  "ticket.legal.data.text": (p) => Number(p.round) > 1
    ? `Um tribunal ordenou a entrega de todos os registos de subscritores e logs de ${p.url}. Responde antes do prazo, ou os agentes vão buscar o hardware pessoalmente.`
    : `No âmbito de uma investigação, solicitamos os registos de subscritores, os logs de acesso e os dados de pagamento de ${p.url}. Responde antes do prazo.`,
  "ticket.legal.takedown.subject": (p) => (Number(p.round) > 1 ? `Ordem judicial: retirar ${host(p)}` : `Ordem de remoção: ${host(p)}`),
  "ticket.legal.takedown.text": (p) => Number(p.round) > 1
    ? `Um tribunal ordenou que ${p.url} fosse posto offline. Responde antes do prazo, ou os agentes vão buscar o hardware pessoalmente.`
    : `O conteúdo de ${p.url} é alvo de uma investigação. Põe-no offline e confirma antes do prazo.`,
  "ticket.refund.outage.subject": () => "Reembolso pela indisponibilidade",
  "ticket.refund.outage.text": () => "O nosso site esteve offline durante horas. Pagamos por uma hospedagem que funcione, por isso esperamos que nos devolvas a mensalidade deste mês.",
  "ticket.refund.dataLoss.subject": () => "Perdemos todos os nossos dados",
  "ticket.refund.dataLoss.text": () => "Tudo o que tínhamos no teu servidor desapareceu. Queremos a mensalidade deste mês de volta, e uma explicação.",
  "outcome.forwarded": () => "Reencaminhado para o cliente",
  "outcome.takenDown": () => "Conteúdo removido",
  "outcome.rejected": () => "Aviso rejeitado",
  "outcome.ignored": () => "Ignorado",
  "outcome.complied": () => "Pedido satisfeito",
  "outcome.objected": () => "Oposição enviada",
  "outcome.seized": () => "Prazo ultrapassado, servidor apreendido",
  "outcome.refunded": () => "Um mês reembolsado",
  "outcome.refused": () => "Reembolso recusado",
  "ledger.refund": (p) => `Reembolso a ${p.customer}`,
  "error.notHosted": () => "Nenhum cliente usa este domínio.",
  "event.gridDark.title": () => "Falha de energia",
  "event.gridDark.text": (p) => `${p.location} esteve sem energia durante ${duration(Number(p.minutes))}.`,
  "event.gridCarried.title": () => "Falha da rede elétrica",
  "event.gridCarried.text": (p) => `${p.location} manteve-se online durante uma falha da rede de ${duration(Number(p.minutes))}.`,
  "event.feedDark.title": () => "Falha de alimentação",
  "event.feedDark.text": (p) => `A alimentação ${p.feed} de ${p.rack} falhou e os seus servidores ficaram sem energia durante ${duration(Number(p.minutes))}.`,
  "event.feedCarried.title": () => "Falha de alimentação",
  "event.feedCarried.text": (p) => `${p.rack} manteve-se online durante uma falha de ${duration(Number(p.minutes))} da alimentação ${p.feed}.`,
  "event.feedCascade.title": () => "Falha de alimentação",
  "event.feedCascade.text": (p) => `A alimentação ${p.feed} de ${p.rack} falhou e a outra alimentação não aguentou toda a carga e disparou. Todos os seus servidores ficaram sem energia durante ${duration(Number(p.minutes))}.`,
  "event.seized.title": () => "Servidor apreendido",
  "event.seized.text": (p) => `${p.agency} levou ${p.device} de ${p.location}.`,
  "event.seizedBack.title": () => "Servidor devolvido",
  "event.seizedBack.text": (p) => `${p.device} está de volta ao armazém em ${p.location}.`,
  "review.outage.bad": () => "Horas offline e nem uma palavra da parte deles. Nunca mais.",
  "review.outage.ok": () => "Houve uma indisponibilidade, mas resolveram-na.",
  "review.outage.good": () => "Até a única indisponibilidade foi bem gerida.",
  "review.dataLoss.bad": () => "Perderam todos os nossos ficheiros. Façam os vossos próprios backups.",
  "review.dataLoss.ok": () => "Perderam os nossos dados mas devolveram-nos o dinheiro. Sentimentos mistos.",
  "review.dataLoss.good": () => "Dados perdidos, mas compensaram.",
  "review.fast.bad": () => "Máquina rápida, suporte lento.",
  "review.fast.ok": () => "O servidor é rápido, o resto é mediano.",
  "review.fast.good": () => "O tick rate não caiu uma única vez. O melhor servidor de jogos que já alugámos.",
  "review.smooth.bad": () => "Funcionava, mas todos os outros contactos com eles foram um tormento.",
  "review.smooth.ok": () => "Nada a apontar quanto à disponibilidade. De resto, nada de especial.",
  "review.smooth.good": () => "Um mês inteiro sem soluços. Exatamente o que a hospedagem deve ser.",
} satisfies Dict;
