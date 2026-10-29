import { euroCents } from "../sim/00-core/money";
import { dateOf } from "../sim/00-core/time";

type Params = Record<string, string | number>;
type Mail = (p: Params) => string;
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

const hi = (p: Params) => (p.name ? `Hello ${p.name},` : "Hello,");
const SIGN: Mail[] = [
  (p) => `Kind regards,\nThe ${p.company} team`,
  (p) => `Best regards,\n${p.company} Support\nsupport@${p.host}`,
  (p) => `Regards,\nYour ${p.company} customer care`,
];
const to = (greet: Mail) => (i: number, body: Mail): Mail => (p) => `${greet(p)}\n\n${body(p)}\n\n${SIGN[i](p)}`;
const customer = to(hi), sender = to(() => "Dear Sir or Madam,"), lead = to((p) => `Dear ${p.name},`);
const site = (p: Params) => p.domain || p.service || "your website";
const svc = (p: Params) => p.hostname || p.service || "your service";
const day = (p: Params) => {
  const d = dateOf(Number(p.hour));
  return `${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]} at ${String(d.getUTCHours()).padStart(2, "0")}:00`;
};
const hosting = (p: Params) => (p.domain ? `${p.line} for ${p.domain}` : p.line);

// Three wordings for each email the company sends; replies.ts picks one by the seed.
const MAILS: Record<string, [Mail, Mail, Mail]> = {
  "tpl.ack": [
    (p) => `Thank you for letting us know. We are aware that ${svc(p)} is unreachable and our technicians are working on it right now. We will write again as soon as it is back.`,
    (p) => `We can confirm the outage of ${svc(p)}. The cause is being fixed as we write, and you will hear from us the moment it is running again.`,
    (p) => `Sorry for the interruption. ${svc(p)} is down on our side and the fix is under way. There is nothing you need to change.`,
  ],
  "tpl.back": [
    (p) => `${svc(p)} is back online and everything is running normally again. We apologise for the interruption.`,
    (p) => `Good news: the problem is fixed and ${svc(p)} answers again. Thank you for your patience.`,
    (p) => `The outage is over and ${svc(p)} is reachable again. Please let us know if anything still looks wrong.`,
  ],
  "tpl.askDetails": [
    () => "Thank you for your message. Could you tell us a little more about what you see, ideally with the exact error message and the time it happened?",
    () => "We would like to help with this. Could you send us a screenshot or the exact wording of the message you get?",
    () => "To look into this properly, we need a few more details. What were you doing when it happened, and what did you see?",
  ],
  "tpl.ftp": [
    (p) => `Connect with an FTP client such as FileZilla to ftp.${p.host} using your panel login, then copy your files into the htdocs folder of ${site(p)}. They are live straight away.`,
    (p) => `You can upload your pages over FTP: the server is ftp.${p.host}, the user name and password are your panel login. Everything in the htdocs folder appears on ${site(p)}.`,
    (p) => `The quickest way is FTP. Point your FTP program at ftp.${p.host}, log in with your panel details and drop the files into htdocs. ${site(p)} shows them right away.`,
  ],
  "tpl.mail": [
    (p) => `Please enter mail.${p.host} as the incoming and outgoing server, with your full email address as the user name and port 993 for IMAP and 587 for sending.`,
    (p) => `The server name for both incoming and outgoing mail is mail.${p.host}. Use your full email address as the user name and your mailbox password.`,
    (p) => `In Outlook, choose IMAP and enter mail.${p.host} for both servers. The user name is your full address${p.domain ? ` at ${p.domain}` : ""}.`,
  ],
  "tpl.dns": [
    (p) => `Please set ns1.${p.host} and ns2.${p.host} as the name servers for ${site(p)} at your registrar. The change can take up to a day to reach everyone.`,
    (p) => `At the registrar where you bought ${site(p)}, replace the name servers with ns1.${p.host} and ns2.${p.host}. Within a day the domain shows your site.`,
    (p) => `${p.domain ? `${p.domain} needs` : "Your domain needs"} to point to us: enter ns1.${p.host} and ns2.${p.host} as name servers at your registrar. It usually takes a few hours, at most a day.`,
  ],
  "tpl.panel": [
    (p) => `We have sent a new password for the control panel to your contact address. You can log in at panel.${p.host}.`,
    (p) => `A new panel password is on its way to your inbox. The login page is panel.${p.host}.`,
    (p) => `We have reset your control panel login and emailed you the new password. Please log in at panel.${p.host} and change it.`,
  ],
  offerOnce: [
    (p) => `We can bring ${site(p)} up to date for you. It is a one-off job for ${euroCents(Number(p.once))}, and you do not have to do anything.`,
    (p) => `The software behind ${site(p)} is missing security updates. We will install them for a one-off fee of ${euroCents(Number(p.once))}.`,
    (p) => `We are happy to take care of the update for ${site(p)}. The one-off price is ${euroCents(Number(p.once))}.`,
  ],
  offerManaged: [
    (p) => `We can keep ${site(p)} up to date for you from now on. Managed updates cost ${euroCents(Number(p.managed))} a month, and we install every security release within a day.`,
    (p) => `With managed updates at ${euroCents(Number(p.managed))} a month, we update the software behind ${site(p)} as soon as a fix comes out, so you never have to think about it.`,
    (p) => `We offer to look after the updates for ${site(p)} for ${euroCents(Number(p.managed))} a month. Every security release is installed within a day.`,
  ],
  free: [
    (p) => `We updated the software behind ${site(p)} for you at no charge. Everything runs on the latest release again.`,
    (p) => `Your update for ${site(p)} is done, and there is nothing to pay. The site runs on the latest release.`,
    (p) => `We took care of the update for ${site(p)} for you. It is free this time, and the site is up to date.`,
  ],
  clean: [
    (p) => `We cleaned ${site(p)} and restored your homepage. Please change your passwords and keep the software up to date.`,
    (p) => `${site(p)} is clean again and shows your own homepage. Updating the software and changing your passwords will keep it that way.`,
    (p) => `Your site ${site(p)} is back to normal. We removed the intruder's files; please update the software and choose new passwords.`,
  ],
  "tpl.explain": [
    () => "The second payment covers last month's usage, which we invoice in arrears. You have not been charged twice.",
    () => "There are two invoices because usage is billed at the end of each month for the month before. Both are correct, and nothing was charged twice.",
    () => "One payment is the current invoice, the other last month's usage, which we bill in arrears. Your account is in order.",
  ],
  "tpl.resend": [
    () => "We have sent you a copy of the invoice. Please let us know if it does not arrive.",
    () => "A copy of the invoice is on its way to your contact address.",
    () => "Of course. We have emailed the invoice again, it should be in your inbox in a few minutes.",
  ],
  "tpl.extension": [
    () => "No problem, you can pay the invoice two weeks later this time. Your services stay online.",
    () => "We have moved the due date of your invoice back by two weeks. Nothing else changes.",
    () => "That is fine. Please pay within two weeks of the usual date, your services keep running in the meantime.",
  ],
  "tpl.newPrice": [
    (p) => `Our costs went up this year, and the new price for ${svc(p)} lets us keep it fast and reliable.`,
    (p) => `We understand the increase is unwelcome. Power and hardware prices rose, and the new price keeps ${svc(p)} at the quality you know.`,
    (p) => `The new price for ${svc(p)} reflects higher costs for power and hardware. It also pays for the people who answer emails like this one.`,
  ],
  "tpl.awaitPayment": [
    () => "Thank you. Your services come back online as soon as the payment arrives.",
    () => "Thank you for letting us know. Once the payment reaches us, everything is switched back on automatically.",
    () => "Understood. Your services return the moment the payment is booked on our side.",
  ],
  "tpl.offer": [
    (p) => `We can give ${svc(p)} more resources without downtime. The prices are in the attached overview, just reply and we will switch it.`,
    (p) => `More resources are no problem. The upgrade takes a few minutes, ${svc(p)} stays online, and you can see the prices in the attachment.`,
    (p) => `Thank you for growing with us. We have attached the prices of more resources, and we switch ${svc(p)} over the same day you reply.`,
  ],
  "tpl.warn": [
    (p) => `${svc(p)} is sending abuse traffic that other networks report to us. Please fix it within 24 hours, otherwise we have to suspend it.`,
    (p) => `We have received abuse reports about ${svc(p)}. Please secure it within 24 hours to avoid a suspension.`,
    (p) => `Other providers report attacks or spam coming from ${svc(p)}. It is probably compromised. Please clean it up within 24 hours, or we will suspend it.`,
  ],
  credit: [
    (p) => `We are sorry for the trouble. We have credited ${euroCents(Number(p.credit))} to your account, which comes off your next invoice.`,
    (p) => `As an apology, your next invoice is ${euroCents(Number(p.credit))} lower. Thank you for staying with us.`,
    (p) => `We have added a credit of ${euroCents(Number(p.credit))} to your account. It is deducted from your next invoice automatically.`,
  ],
  refund: [
    (p) => `We have refunded one month, ${euroCents(Number(p.refund))}, to your account. We are sorry this happened.`,
    (p) => `You will receive a refund of ${euroCents(Number(p.refund))} for this month. Please accept our apologies.`,
    (p) => `We have issued a full month's refund of ${euroCents(Number(p.refund))}. The money reaches your account within a few days.`,
  ],
  refuse: [
    () => "We have looked into your request carefully. The interruption is covered by your contract terms, so we cannot offer a refund this time.",
    () => "Thank you for your message. Your service level covers this case, so a refund is not possible. We are sorry for the inconvenience.",
    () => "We understand your frustration, but we are not able to refund this period. Your contract terms apply here.",
  ],
  revert: [
    (p) => `We have set the price of ${svc(p)} back to what you paid before. The change applies from your next invoice.`,
    (p) => `You are right to ask. ${svc(p)} goes back to its previous price from the next invoice.`,
    (p) => `We have reverted the price change for ${svc(p)}. Your next invoice shows the old price again.`,
  ],
  retain: [
    () => "We would be sorry to see you go. If you stay, your next month is on us, with everything as it is now.",
    () => "Before you leave, we would like to offer you a free month to make up for the trouble. Reply if you would like to stay.",
    () => "We value you as a customer. Stay with us and the next month costs you nothing.",
  ],
  cancel: [
    () => "We have processed your cancellation. Your services end today and you will receive a final invoice. Thank you for hosting with us.",
    () => "Your contract is cancelled as requested. Please download anything you want to keep, the services end today.",
    () => "We confirm the cancellation of your services. Thank you for the time with us, and good luck with your new host.",
  ],
  unsuspend: [
    (p) => `Your services are back online. You have ${p.days} more days to pay the open invoice.`,
    (p) => `We have switched everything back on and extended the payment deadline by ${p.days} days.`,
    (p) => `Your services run again. Please settle the invoice within the next ${p.days} days.`,
  ],
  keep: [
    () => "We understand the situation, but your services stay suspended until the open invoice is paid. They come back on automatically after that.",
    () => "We are sorry, but we cannot lift the suspension before the payment arrives. Once it does, everything returns right away.",
    () => "Your services remain suspended for now. As soon as the invoice is paid, they are switched back on without any further steps.",
  ],
  forward: [
    (p) => `Thank you for your notice about ${p.url}. We have forwarded it to our customer and asked them to respond.`,
    (p) => `We have passed your notice regarding ${p.url} on to the customer responsible for the site.`,
    (p) => `Your notice about ${p.url} has been forwarded to our customer. Please contact them directly for anything further.`,
  ],
  takedown: [
    (p) => `Thank you for your notice. The content at ${p.url} has been taken offline for ${p.hours} hours while our customer reviews it.`,
    (p) => `We have disabled access to ${p.url} for ${p.hours} hours and informed our customer.`,
    (p) => `The material at ${p.url} is offline as of now. Our customer has ${p.hours} hours to respond to your notice.`,
  ],
  reject: [
    (p) => `We have reviewed your notice about ${p.url}. It does not meet the formal requirements, so we will not take action.`,
    (p) => `Thank you for your message regarding ${p.url}. After review, we see no grounds to remove the content.`,
    (p) => `We have looked into your notice about ${p.url} and cannot act on it in its current form.`,
  ],
  comply: [
    (p) => `We confirm receipt of your request about ${p.url}. We are complying and will provide the requested information within the stated period.`,
    (p) => `Your request regarding ${p.url} has been received. We will cooperate and send the information you asked for.`,
    (p) => `We will comply with your request concerning ${p.url}. Our team is preparing the requested records.`,
  ],
  object: [
    (p) => `We have received your request about ${p.url}. We object to it in this form and ask for a court order before we disclose data or remove content.`,
    (p) => `With regard to ${p.url}, we cannot comply without a court order. We will of course respond to one promptly.`,
    (p) => `We respectfully decline your request concerning ${p.url}. Our customers' data is only released on the basis of a court order.`,
  ],
  "decline.notOffered": [
    (p) => `Thank you for your interest in ${hosting(p)}. Unfortunately, we do not offer this product in ${p.city} at the moment, so we cannot take on your order.`,
    (p) => `Thank you for your order. We are sorry, but ${p.line} is not available in ${p.city} yet. We hope to be able to help you in the future.`,
    (p) => `We appreciate you thinking of us. ${p.line} is not part of our offer in ${p.city} right now, so we have to decline this order.`,
  ],
  "decline.noCapacity": [
    (p) => `Thank you for your order of ${hosting(p)}. Our servers in ${p.city} are fully booked at the moment, so we cannot set it up for you.`,
    (p) => `We are sorry, but we have no free capacity in ${p.city} right now and cannot accept your order. We hope to welcome you another time.`,
    (p) => `Thank you for choosing us. Unfortunately, ${p.city} is at full capacity, and we would rather decline than set up ${p.line} badly.`,
  ],
  "decline.busy": [
    (p) => `Thank you for your interest in ${hosting(p)}. We are not taking on new orders of this kind at the moment.`,
    () => "Thank you for your order. Unfortunately, we cannot take it on at this time. We wish you every success with your project.",
    (p) => `We appreciate your request for ${hosting(p)}, but we are unable to accept it right now.`,
  ],
  accept: [
    (p) => `Thank you for your order. ${hosting(p)} is set up in ${p.city} and online since ${day(p)}, at ${euroCents(Number(p.price))} a month. Your login details follow in a separate email.`,
    (p) => `Welcome aboard! We have set up ${hosting(p)} in ${p.city} on ${day(p)}. The monthly price is ${euroCents(Number(p.price))}, and your access details are on their way.`,
    (p) => `Your order is complete: ${hosting(p)} runs in ${p.city} since ${day(p)} for ${euroCents(Number(p.price))} a month. You will receive the login details shortly.`,
  ],
  failed: [
    (p) => `Thank you for your order. We tried to set up ${hosting(p)}, but it could not be completed on our side. We are sorry, and we have cancelled the order.`,
    (p) => `We are sorry: the setup of ${hosting(p)} in ${p.city} failed, so we have to cancel your order. You have not been charged.`,
    (p) => `Unfortunately, we could not set up ${hosting(p)} as ordered. The order is cancelled and nothing will be invoiced.`,
  ],
  "order.account": [
    (p) => `Thank you for your order of ${hosting(p)}. We have opened a customer account for you and will send the order confirmation with your invoice shortly.`,
    (p) => `Welcome to ${p.company}! Your customer account is ready. The confirmation of ${hosting(p)} and the invoice follow in a moment.`,
    () => "Thank you for choosing us. Your customer account has been created, and we are preparing your order confirmation now.",
  ],
  "order.invoice": [
    (p) => `We confirm your order of ${hosting(p)} at ${euroCents(Number(p.price))} a month. Invoice ${p.invoice} over ${euroCents(Number(p.total))} is attached. We set everything up as soon as it is paid.`,
    (p) => `Your order is confirmed: ${hosting(p)} in ${p.city} for ${euroCents(Number(p.price))} a month. Please pay invoice ${p.invoice} (${euroCents(Number(p.total))}), and we will get started.`,
    (p) => `Thank you, the order stands. ${hosting(p)} costs ${euroCents(Number(p.price))} a month; the first invoice, ${p.invoice}, comes to ${euroCents(Number(p.total))}.`,
  ],
  "order.domain": [
    (p) => `Good news: ${p.domain} is registered in your name. It will point to your web space once that is set up.`,
    (p) => `We have registered ${p.domain} for you. It is yours for a year and renews with us.`,
    (p) => `${p.domain} is now registered for you. The web space follows next.`,
  ],
  "order.transfer": [
    (p) => `The transfer of ${p.domain} to us is complete. Nothing changes for you except who renews it.`,
    (p) => `${p.domain} has moved to us. We will take care of the renewals from now on.`,
    (p) => `We have taken over ${p.domain} from your previous provider. It will point to your new web space.`,
  ],
  "order.live": [
    (p) => (p.domain
      ? `${p.domain} is live on our servers in ${p.city} since ${day(p)}. Log in at panel.${p.host} with the user name ${String(p.domain).split(".")[0]}; the password follows in a separate email. Upload your site by FTP to ftp.${p.domain}.`
      : `Your ${p.line} in ${p.city} is running since ${day(p)}. Log in as root over SSH; the address and password follow in a separate email.`),
    (p) => (p.domain
      ? `Your web space for ${p.domain} is ready since ${day(p)}. The control panel is at panel.${p.host}, and your mailboxes are set up at mail.${p.host}.`
      : `${p.line} is up in ${p.city} since ${day(p)}. Your root login is on its way by separate email.`),
    (p) => `Everything is set up: ${hosting(p)} runs in ${p.city} since ${day(p)}. Your access details follow in a separate email.`,
  ],
};
const LEAD = ["decline.notOffered", "decline.noCapacity", "decline.busy", "accept", "failed", "order.account", "order.invoice", "order.domain", "order.transfer", "order.live"];
const SENDER = ["forward", "takedown", "reject", "comply", "object"];

// Outgoing emails; spread into en.
export const REPLIES_EN: Record<string, Mail> = Object.fromEntries(Object.entries(MAILS).flatMap(([what, bodies]) =>
  bodies.map((body, i) => [`reply.${what}.${i}`, (LEAD.includes(what) ? lead : SENDER.includes(what) ? sender : customer)(i, body)])));
export const REPLY_KINDS = Object.keys(MAILS);
