import { euroCents } from "../../sim/00-core/money";
import { dateOf } from "../../sim/00-core/time";
import type { Dict, Params } from "../lang";

type Mail = (p: Params) => string;
const MONTHS = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];

const hi = (p: Params) => (p.name ? `Olá ${p.name},` : "Olá,");
const SIGN: Mail[] = [
  (p) => `Com os melhores cumprimentos,\nA equipe da ${p.company}`,
  (p) => `Cumprimentos,\nSuporte ${p.company}\nsupport@${p.host}`,
  (p) => `Até já,\nO teu apoio ao cliente ${p.company}`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Exmos. Senhores,"), lead = to((p) => `Olá ${p.name},`);
const siteOf = (p: Params) => new URL(String(p.url)).hostname;
const site = (p: Params) => p.domain || p.service || "o teu site";
const svc = (p: Params) => p.hostname || p.service || "o teu serviço";
const day = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate()} de ${MONTHS[d.getUTCMonth()]} às ${String(d.getUTCHours()).padStart(2, "0")}:00`;
};
const setupFee = (p: Params) => (Number(p.setup) > 0 ? ` mais uma taxa de configuração única de ${euroCents(Number(p.setup))}` : "");
const hosting = (p: Params) => (p.domain ? `${p.line} para ${p.domain}` : p.line);
const plural = (n: unknown, one: string, many: string) => (Number(n) === 1 ? one : many);
const domainLine = (p: Params) => (Number(p.owned) ? `A transferência de ${p.domain} para nós está concluída, e a partir de agora tratamos das renovações.` : `Registámos ${p.domain} para ti.`);

const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Obrigado pelo aviso. Sabemos que ${svc(p)} está inacessível e os nossos técnicos estão a trabalhar nisso neste momento. Voltamos a escrever assim que estiver restabelecido.`,
    (p) => `Confirmamos a indisponibilidade de ${svc(p)}. A causa está a ser corrigida enquanto escrevemos, e terás notícias nossas assim que voltar a funcionar.`,
    (p) => `Desculpa a interrupção. ${svc(p)} está em baixo do nosso lado e a correção está a caminho. Não precisas de fazer nada.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} está novamente online e tudo funciona normalmente. Pedimos desculpa pela interrupção.`,
    (p) => `Boas notícias: o problema está resolvido e ${svc(p)} volta a responder. Obrigado pela paciência.`,
    (p) => `A indisponibilidade terminou e ${svc(p)} está novamente acessível. Diz-nos se algo ainda parecer errado.`,
  ],
  "tpl.askDetails": [
    () => "Obrigado pela tua mensagem. Podes contar-nos um pouco mais sobre o que vês, de preferência com a mensagem de erro exata e a hora a que aconteceu?",
    () => "Queremos ajudar-te com isto. Podes enviar-nos uma captura de ecrã ou o texto exato da mensagem que recebes?",
    () => "Para analisar isto como deve ser, precisamos de mais alguns detalhes. O que estavas a fazer quando aconteceu e o que viste?",
  ],
  "tpl.ftp": [
    (p) => `Liga-te com um cliente FTP como o FileZilla a ftp.${p.host} com os dados de acesso do painel e copia os teus ficheiros para a pasta htdocs de ${site(p)}. Ficam online de imediato.`,
    (p) => `Podes carregar as tuas páginas por FTP: o servidor é ftp.${p.host}, e o utilizador e a palavra-passe são os do teu painel. Tudo o que estiver na pasta htdocs aparece em ${site(p)}.`,
    (p) => `O caminho mais rápido é o FTP. Aponta o teu programa de FTP para ftp.${p.host}, entra com os dados do painel e larga os ficheiros em htdocs. ${site(p)} mostra-os logo.`,
  ],
  "tpl.mail": [
    (p) => `Introduz mail.${p.host} como servidor de entrada e de saída, com o teu endereço de e-mail completo como utilizador, porta 993 para IMAP e 587 para envio.`,
    (p) => `O nome do servidor para o correio de entrada e de saída é mail.${p.host}. Usa o teu endereço de e-mail completo como utilizador e a palavra-passe da caixa de correio.`,
    (p) => `No Outlook, escolhe IMAP e introduz mail.${p.host} nos dois servidores. O utilizador é o teu endereço completo${p.domain ? ` em ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Define ns1.${p.host} e ns2.${p.host} como servidores de nomes de ${site(p)} no teu registador. A alteração pode demorar até um dia a chegar a toda a gente.`,
    (p) => `No registador onde compraste ${site(p)}, substitui os servidores de nomes por ns1.${p.host} e ns2.${p.host}. Dentro de um dia o domínio mostra o teu site.`,
    (p) => `${p.domain ? `${p.domain} tem` : "O teu domínio tem"} de apontar para nós: introduz ns1.${p.host} e ns2.${p.host} como servidores de nomes no teu registador. Costuma demorar algumas horas, no máximo um dia.`,
  ],
  "tpl.panel": [
    (p) => `Enviámos uma nova palavra-passe do painel de controlo para o teu endereço de contacto. Podes entrar em panel.${p.host}.`,
    (p) => `Uma nova palavra-passe do painel está a caminho da tua caixa de entrada. A página de acesso é panel.${p.host}.`,
    (p) => `Repusemos o acesso ao teu painel de controlo e enviámos-te a nova palavra-passe por e-mail. Entra em panel.${p.host} e altera-a.`,
  ],
  "tpl.ssl": [
    (p) => `Podemos instalar um certificado SSL para ${site(p)}. Assim que o encomendares, o cadeado aparece em menos de uma hora e o aviso desaparece.`,
    (p) => `O aviso desaparece com um certificado SSL. Encomenda um para ${site(p)} e nós instalamo-lo.`,
    (p) => `${site(p)} precisa de um certificado SSL para mostrar o cadeado. Configuramo-lo assim que o encomendares.`,
  ],
  "tpl.ssh": [
    (p) => `Abre um cliente SSH como o PuTTYcat e liga-te a ${p.hostname || "o teu servidor"} como root. A palavra-passe está no e-mail de configuração que enviámos de ${p.host}.`,
    (p) => `Entras por SSH: liga-te a ${p.hostname || "o teu servidor"} com o utilizador root e a palavra-passe do e-mail de configuração.`,
    (p) => `Usa qualquer cliente SSH e liga-te a ${p.hostname || "o teu servidor"} como root. Se perdeste o e-mail de configuração com a palavra-passe, responde aqui e enviamos outro.`,
  ],
  "tpl.addon": [
    (p) => `Sim, pode partilhar o pacote. Adiciona o novo domínio no painel de controlo, em panel.${p.host}, em Domínios, e escolhe uma pasta para ele.`,
    (p) => `Não precisas de um segundo pacote. No painel de controlo, em panel.${p.host}, adiciona o domínio em Domínios e aponta-o para a sua própria pasta.`,
    (p) => `Podes usar o novo domínio na mesma hospedagem. Abre Domínios no painel de controlo, em panel.${p.host}, adiciona-o e escolhe uma pasta.`,
  ],
  "tpl.php": [
    (p) => `A versão de PHP de ${site(p)} escolhes tu no painel de controlo, em panel.${p.host}, em Definições de PHP. Aplica-se de imediato.`,
    (p) => `Abre as Definições de PHP no painel de controlo, em panel.${p.host}, e escolhe a versão mais recente. ${site(p)} usa-a logo.`,
    (p) => `No painel de controlo, em panel.${p.host}, as Definições de PHP permitem-te mudar de versão para ${site(p)}. Recomendamos a mais recente que os teus plugins suportem.`,
  ],
  offerOnce: [
    (p) => `Podemos atualizar ${site(p)} por ti. É um trabalho pontual de ${euroCents(Number(p.once))}, e não tens de fazer nada.`,
    (p) => `Ao software de ${site(p)} faltam atualizações de segurança. Instalamo-las por uma taxa única de ${euroCents(Number(p.once))}.`,
    (p) => `Tratamos com gosto da atualização de ${site(p)}. O preço único é de ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `Podemos manter ${site(p)} atualizado por ti a partir de agora. As atualizações geridas custam ${euroCents(Number(p.managed))} por mês, e instalamos cada correção de segurança no prazo de um dia.`,
    (p) => `Com as atualizações geridas a ${euroCents(Number(p.managed))} por mês, atualizamos o software de ${site(p)} assim que sai uma correção, para não teres de pensar nisso.`,
    (p) => `Propomos tratar das atualizações de ${site(p)} por ${euroCents(Number(p.managed))} por mês. Cada correção de segurança é instalada no prazo de um dia.`,
  ],
  free: [
    (p) => `Atualizámos gratuitamente o software de ${site(p)}. Tudo volta a correr na versão mais recente.`,
    (p) => `A atualização de ${site(p)} está feita e não há nada a pagar. O site corre na versão mais recente.`,
    (p) => `Tratámos nós da atualização de ${site(p)}. Desta vez é grátis, e o site está atualizado.`,
  ],
  clean: [
    (p) => `Limpámos ${site(p)} e repusemos a tua página inicial. Altera as tuas palavras-passe e mantém o software atualizado.`,
    (p) => `${site(p)} está novamente limpo e mostra a tua própria página inicial. Se atualizares o software e alterares as palavras-passe, continuará assim.`,
    (p) => `O teu site ${site(p)} voltou ao normal. Removemos os ficheiros do intruso; atualiza o software e escolhe palavras-passe novas.`,
  ],
  noBackup: [
    (p) => `Não temos nenhum backup de ${site(p)} para restaurar. Volta a carregar o site a partir da tua cópia e escolhe palavras-passe novas.`,
    (p) => `Infelizmente, não existe backup de ${site(p)} do nosso lado. Vais ter de o restaurar a partir dos teus próprios ficheiros e alterar as palavras-passe.`,
    (p) => `Não conseguimos restaurar ${site(p)} porque não existe backup. Reconstrói-o a partir da tua cópia e mantém o software atualizado.`,
  ],
  "tpl.explain": [
    () => "O segundo pagamento cobre a utilização do mês passado, que faturamos a posteriori. Não foste cobrado duas vezes.",
    () => "Há duas faturas porque a utilização é faturada no fim de cada mês, referente ao mês anterior. Ambas estão corretas, e nada foi cobrado duas vezes.",
    () => "Um pagamento é a fatura atual, o outro a utilização do mês passado, que faturamos a posteriori. A tua conta está em ordem.",
  ],
  "tpl.foundPayment": [
    () => "Encontrámos a tua transferência e lançámo-la na fatura. Podes ignorar o lembrete.",
    () => "Obrigado, o teu pagamento chegou e a fatura está paga. O lembrete saiu antes de o lançarmos.",
    () => "A tua transferência já está lançada na fatura. Não há nada em aberto, por isso o lembrete já não se aplica.",
  ],
  "tpl.resend": [
    () => "Enviámos-te uma cópia da fatura. Diz-nos se não chegar.",
    () => "Uma cópia da fatura está a caminho do teu endereço de contacto.",
    () => "Claro. Voltámos a enviar-te a fatura por e-mail, deve estar na tua caixa de entrada dentro de alguns minutos.",
  ],
  "tpl.extension": [
    () => "Sem problema, desta vez podes pagar a fatura duas semanas mais tarde. Os teus serviços ficam online.",
    () => "Adiámos duas semanas o vencimento da tua fatura. Nada mais muda.",
    () => "Está bem. Paga dentro de duas semanas após a data habitual, os teus serviços continuam a funcionar entretanto.",
  ],
  "tpl.newPrice": [
    (p) => `Os nossos custos subiram este ano, e o novo preço de ${svc(p)} permite-nos mantê-lo rápido e fiável.`,
    (p) => `Compreendemos que o aumento não seja bem-vindo. A energia e o hardware ficaram mais caros, e o novo preço mantém ${svc(p)} com a qualidade que conheces.`,
    (p) => `O novo preço de ${svc(p)} reflete os custos mais altos de energia e hardware. Também paga às pessoas que respondem a e-mails como este.`,
  ],
  "tpl.awaitPayment": [
    () => "Obrigado. Os teus serviços voltam a ficar online assim que o pagamento chegar.",
    () => "Obrigado pelo aviso. Assim que o pagamento chegar até nós, tudo é reativado automaticamente.",
    () => "Entendido. Os teus serviços voltam no momento em que o pagamento for registado do nosso lado.",
  ],
  "tpl.offer": [
    (p) => `Podemos dar mais recursos a ${svc(p)} sem tempo de inatividade. Os preços estão no resumo em anexo, responde e fazemos a mudança.`,
    (p) => `Mais recursos não são problema. O upgrade demora alguns minutos, ${svc(p)} fica online e os preços estão no anexo.`,
    (p) => `Obrigado por cresceres connosco. Anexámos os preços de mais recursos, e mudamos ${svc(p)} no mesmo dia em que responderes.`,
  ],
  "tpl.warn": [
    (p) => `${svc(p)} está a enviar tráfego abusivo que outras redes nos reportam. Resolve isto em 24 horas, caso contrário teremos de o suspender.`,
    (p) => `Recebemos denúncias de abuso sobre ${svc(p)}. Protege-o em 24 horas para evitar uma suspensão.`,
    (p) => `Outros fornecedores reportam ataques ou spam provenientes de ${svc(p)}. Provavelmente está comprometido. Limpa-o em 24 horas, ou suspendemo-lo.`,
  ],
  credit: [
    (p) => `Lamentamos o incómodo. Creditámos ${euroCents(Number(p.credit))} na tua conta, que serão descontados da tua próxima fatura.`,
    (p) => `Como pedido de desculpa, a tua próxima fatura é ${euroCents(Number(p.credit))} mais baixa. Obrigado por continuares connosco.`,
    (p) => `Adicionámos um crédito de ${euroCents(Number(p.credit))} à tua conta. É descontado automaticamente da tua próxima fatura.`,
  ],
  refund: [
    (p) => `Reembolsámos um mês, ${euroCents(Number(p.refund))}, na tua conta. Lamentamos o que aconteceu.`,
    (p) => `Vais receber um reembolso de ${euroCents(Number(p.refund))} por este mês. Aceita as nossas desculpas.`,
    (p) => `Emitimos o reembolso de um mês completo, ${euroCents(Number(p.refund))}. O dinheiro chega à tua conta em poucos dias.`,
  ],
  refuse: [
    () => "Analisámos o teu pedido com atenção. A interrupção está coberta pelas condições do teu contrato, por isso desta vez não podemos oferecer um reembolso.",
    () => "Obrigado pela tua mensagem. O teu nível de serviço cobre este caso, por isso não é possível um reembolso. Lamentamos o incómodo.",
    () => "Compreendemos a tua frustração, mas não podemos reembolsar este período. Aplicam-se aqui as condições do teu contrato.",
  ],
  revert: [
    (p) => `Repusemos o preço de ${svc(p)} no valor que pagavas antes. A alteração aplica-se a partir da tua próxima fatura.`,
    (p) => `Fazes bem em perguntar. ${svc(p)} volta ao preço anterior a partir da próxima fatura.`,
    (p) => `Revertemos a alteração de preço de ${svc(p)}. A tua próxima fatura voltará a mostrar o preço antigo.`,
  ],
  "retain.half": [
    () => "Lamentaríamos ver-te partir. Se ficares, o teu próximo mês custa metade, com tudo como está agora.",
    () => "Antes de partires, gostaríamos de te dar 50% de desconto no próximo mês. Responde se quiseres ficar.",
    () => "Valorizamos-te como cliente. Fica connosco e reduzimos a metade o teu próximo mês.",
  ],
  "retain.free": [
    () => "Lamentaríamos ver-te partir. Se ficares, o teu próximo mês é por nossa conta, com tudo como está agora.",
    () => "Antes de partires, gostaríamos de te oferecer um mês grátis para compensar o incómodo. Responde se quiseres ficar.",
    () => "Valorizamos-te como cliente. Fica connosco e o próximo mês não te custa nada.",
  ],
  "retain.discount": [
    (p) => `Lamentaríamos ver-te partir. Se ficares, damos-te 20% de desconto nos teus serviços durante ${p.months} ${plural(p.months, "mês", "meses")}.`,
    (p) => `Antes de partires, gostaríamos de te oferecer 20% de desconto durante ${p.months} ${plural(p.months, "mês", "meses")}. Responde se quiseres ficar.`,
    (p) => `Valorizamos-te como cliente. Fica connosco e o teu preço desce um quinto durante ${p.months} ${plural(p.months, "mês", "meses")}.`,
  ],
  "retain.upgrade": [
    () => "Lamentaríamos ver-te partir. Se ficares, passamos o teu serviço para o tamanho seguinte ao preço que pagas hoje.",
    () => "Antes de partires, gostaríamos de te dar mais recursos sem custo adicional. Responde se quiseres ficar.",
    () => "Valorizamos-te como cliente. Fica connosco e melhoramos o teu serviço gratuitamente.",
  ],
  "retain.fix": [
    (p) => `Lamentamos o incómodo. Vamos resolvê-lo em ${p.fixDays} ${plural(p.fixDays, "dia", "dias")} e voltamos a falar contigo nessa altura. Dá-nos a oportunidade de o corrigir.`,
    (p) => `Aceita as nossas desculpas. A nossa equipe está a tratar disso, e dentro de ${p.fixDays} ${plural(p.fixDays, "dia", "dias")} o teu serviço funcionará como deve.`,
    (p) => `Falhámos-te, e lamentamos. Dá-nos ${p.fixDays} ${plural(p.fixDays, "dia", "dias")} para resolver isto antes de decidires.`,
  ],
  "retain.move": [
    () => "Lamentamos o incómodo. Se ficares, mudamos o teu serviço para um servidor melhor no nosso datacenter e tratamos nós da mudança.",
    () => "Antes de partires, deixa-nos mudar o teu serviço para um servidor melhor. Organizamos a mudança para a altura que te der jeito.",
    () => "Valorizamos-te como cliente. Fica connosco e mudamos o teu serviço para um servidor mais recente sem custos.",
  ],
  cancel: [
    () => "Processámos o teu cancelamento. Os teus serviços terminam hoje e receberás uma fatura final. Obrigado por teres alojado connosco.",
    () => "O teu contrato está cancelado, como pediste. Descarrega tudo o que queres guardar, os serviços terminam hoje.",
    () => "Confirmamos o cancelamento dos teus serviços. Obrigado pelo tempo connosco, e boa sorte com o teu novo fornecedor.",
  ],
  unsuspend: [
    (p) => `Os teus serviços estão novamente online. Tens mais ${p.days} ${plural(p.days, "dia", "dias")} para pagar a fatura em aberto.`,
    (p) => `Reativámos tudo e prolongámos o prazo de pagamento em ${p.days} ${plural(p.days, "dia", "dias")}.`,
    (p) => `Os teus serviços voltam a funcionar. Liquida a fatura ${plural(p.days, "no próximo dia", `nos próximos ${p.days} dias`)}.`,
  ],
  keep: [
    () => "Compreendemos a situação, mas os teus serviços ficam suspensos até a fatura em aberto ser paga. Depois voltam automaticamente.",
    () => "Lamentamos, mas não podemos levantar a suspensão antes de o pagamento chegar. Assim que chegar, tudo volta de imediato.",
    () => "Por agora, os teus serviços continuam suspensos. Assim que a fatura for paga, são reativados sem mais passos.",
  ],
  forward: [
    (p) => `Agradecemos o vosso aviso sobre ${p.url}. Encaminhámo-lo ao nosso cliente e pedimos-lhe que responda.`,
    (p) => `Transmitimos o vosso aviso sobre ${p.url} ao cliente responsável pelo site.`,
    (p) => `O vosso aviso sobre ${p.url} foi encaminhado ao nosso cliente. Para qualquer outro assunto, contactem-no diretamente.`,
  ],
  takedown: [
    (p) => `Agradecemos o vosso aviso. O conteúdo em ${p.url} foi retirado do ar durante ${p.hours} ${plural(p.hours, "hora", "horas")} enquanto o nosso cliente o analisa.`,
    (p) => `Desativámos o acesso a ${p.url} durante ${p.hours} ${plural(p.hours, "hora", "horas")} e informámos o nosso cliente.`,
    (p) => `O material em ${p.url} está offline a partir de agora. O nosso cliente tem ${p.hours} ${plural(p.hours, "hora", "horas")} para responder ao vosso aviso.`,
  ],
  notOurs: [
    (p) => `Agradecemos o vosso aviso sobre ${p.url}. Este site não está na nossa rede, por isso não podemos intervir. Executem "whois ${siteOf(p)}" para encontrar o registador e depois whois ao endereço IP para onde o domínio aponta: o resultado indica o fornecedor de alojamento e o respetivo contacto para abusos.`,
    (p) => `Verificámos ${p.url}, e não está alojado na nossa rede. Uma consulta whois a ${siteOf(p)} mostra o registador, e uma consulta whois ao endereço IP do site mostra a rede que o aloja, normalmente com um endereço de abusos para onde escrever.`,
    (p) => `O site em ${p.url} não é nosso. Para encontrar o contacto certo, consultem ${siteOf(p)} com whois para o registador, e o seu endereço IP com whois para o departamento de abusos do fornecedor de alojamento.`,
  ],
  reject: [
    (p) => `Analisámos o vosso aviso sobre ${p.url}. Não cumpre os requisitos formais, por isso não tomaremos medidas.`,
    (p) => `Agradecemos a vossa mensagem sobre ${p.url}. Após análise, não vemos motivos para remover o conteúdo.`,
    (p) => `Estudámos o vosso aviso sobre ${p.url} e não podemos dar-lhe seguimento na forma atual.`,
  ],
  comply: [
    (p) => `Confirmamos a receção do vosso pedido sobre ${p.url}. Vamos dar-lhe seguimento e fornecer as informações pedidas dentro do prazo indicado.`,
    (p) => `O vosso pedido sobre ${p.url} foi recebido. Vamos colaborar e enviar as informações que solicitaram.`,
    (p) => `Vamos dar seguimento ao vosso pedido sobre ${p.url}. A nossa equipe está a preparar os registos solicitados.`,
  ],
  object: [
    (p) => `Recebemos o vosso pedido sobre ${p.url}. Opomo-nos a ele nesta forma e exigimos uma ordem judicial antes de divulgar dados ou remover conteúdo.`,
    (p) => `Relativamente a ${p.url}, não podemos dar seguimento sem uma ordem judicial. Responderemos, claro, prontamente a uma ordem desse tipo.`,
    (p) => `Declinamos respeitosamente o vosso pedido sobre ${p.url}. Os dados dos nossos clientes só são divulgados com base numa ordem judicial.`,
  ],
  "decline.notOffered": [
    (p) => `Obrigado pelo teu interesse em ${hosting(p)}. Infelizmente, de momento não oferecemos este produto em ${p.city}, por isso não podemos aceitar a tua encomenda.`,
    (p) => `Obrigado pela tua encomenda. Lamentamos, mas ${p.line} ainda não está disponível em ${p.city}. Esperamos poder ajudar-te no futuro.`,
    (p) => `Obrigado por teres pensado em nós. ${p.line} não faz parte da nossa oferta em ${p.city} por agora, por isso temos de recusar esta encomenda.`,
  ],
  "decline.noCapacity": [
    (p) => `Obrigado pela tua encomenda de ${hosting(p)}. Os nossos servidores em ${p.city} estão neste momento esgotados, por isso não conseguimos configurá-lo para ti.`,
    (p) => `Lamentamos, mas neste momento não temos capacidade livre em ${p.city} e não podemos aceitar a tua encomenda. Esperamos receber-te noutra ocasião.`,
    (p) => `Obrigado por nos escolheres. Infelizmente, ${p.city} está com a capacidade completa, e preferimos recusar a configurar mal ${p.line}.`,
  ],
  "decline.busy": [
    (p) => `Obrigado pelo teu interesse em ${hosting(p)}. De momento não aceitamos novas encomendas deste tipo.`,
    () => "Obrigado pela tua encomenda. Infelizmente, não podemos assumi-la neste momento. Desejamos-te muito sucesso com o teu projeto.",
    (p) => `Agradecemos o teu pedido de ${hosting(p)}, mas não o podemos aceitar neste momento.`,
  ],
  accept: [
    (p) => `Obrigado pela tua encomenda. ${hosting(p)} está configurado em ${p.city} e online desde ${day(p)}, por ${euroCents(Number(p.price))} por mês. Os teus dados de acesso seguem noutro e-mail.`,
    (p) => `Bem-vindo a bordo! Configurámos ${hosting(p)} em ${p.city} a ${day(p)}. O preço mensal é de ${euroCents(Number(p.price))}, e os teus dados de acesso estão a caminho.`,
    (p) => `A tua encomenda está concluída: ${hosting(p)} corre em ${p.city} desde ${day(p)} por ${euroCents(Number(p.price))} por mês. Receberás os dados de acesso em breve.`,
  ],
  failed: [
    (p) => `Obrigado pela tua encomenda. Tentámos configurar ${hosting(p)}, mas não foi possível concluir do nosso lado. Lamentamos, e cancelámos a encomenda.`,
    (p) => `Lamentamos: a configuração de ${hosting(p)} em ${p.city} falhou, por isso temos de cancelar a tua encomenda. Não foste cobrado.`,
    (p) => `Infelizmente, não conseguimos configurar ${hosting(p)} como encomendado. A encomenda está cancelada e nada será faturado.`,
  ],
  "order.quote": [
    (p) => `Obrigado pelo teu pedido de ${hosting(p)}. Podemos oferecê-lo por ${euroCents(Number(p.price))} por mês${setupFee(p)}. Diz-nos se te serve.`,
    (p) => `Aqui está a nossa oferta para ${hosting(p)} em ${p.city}: ${euroCents(Number(p.price))} por mês${setupFee(p)}. Configuramos tudo assim que confirmares.`,
    (p) => `Obrigado por entrares em contacto. Por ${hosting(p)} cobraríamos ${euroCents(Number(p.price))} por mês${setupFee(p)}. Diz-nos se queres avançar.`,
  ],
  "order.invoice": [
    (p) => `Confirmamos a tua encomenda de ${hosting(p)} por ${euroCents(Number(p.price))} por mês. Segue em anexo a fatura ${p.invoice} no valor de ${euroCents(Number(p.total))}. Configuramos tudo assim que for paga.`,
    (p) => `A tua encomenda está confirmada: ${hosting(p)} em ${p.city} por ${euroCents(Number(p.price))} por mês. Paga a fatura ${p.invoice} (${euroCents(Number(p.total))}) e começamos.`,
    (p) => `Obrigado, a encomenda está de pé. ${hosting(p)} custa ${euroCents(Number(p.price))} por mês; a primeira fatura, ${p.invoice}, ascende a ${euroCents(Number(p.total))}.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${domainLine(p)} Está online nos nossos servidores em ${p.city} desde ${day(p)}. Entra em panel.${p.host} com o utilizador ${String(p.domain).split(".")[0]}; a palavra-passe segue noutro e-mail. Carrega o teu site por FTP para ftp.${p.domain}.`
      : `O teu ${p.line} em ${p.city} corre desde ${day(p)}. Entra como root por SSH; o endereço e a palavra-passe seguem noutro e-mail.`),
    (p) => (p.domain
      ? `${domainLine(p)} O teu espaço web está pronto desde ${day(p)}. O painel de controlo está em panel.${p.host}, e as tuas caixas de correio estão configuradas em mail.${p.host}.`
      : `${p.line} está online em ${p.city} desde ${day(p)}. O teu acesso root está a caminho noutro e-mail.`),
    (p) => `Está tudo configurado: ${hosting(p)} corre em ${p.city} desde ${day(p)}.${p.domain ? ` ${domainLine(p)}` : ""} Os teus dados de acesso seguem noutro e-mail.`,
  ],
};
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.quote", "order.invoice", "order.live"];
const SENDER = ["forward", "takedown", "notOurs", "reject", "comply", "object"];

export default Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)]))) as Dict;
