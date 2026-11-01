import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro, euroCents } from "../../../../../sim/00-core/money";
import { dateOf, yearOf } from "../../../../../sim/00-core/time";
import { bankById, bookingFee, monthlyFee, tanMethods, type Bank, type BankId, type TanMethod } from "../../../../../sim/10-catalog/banks";
import { LEGAL_FORMS } from "../../../../../sim/80-business/office";
import { annuity, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate } from "../../../../../sim/45-billing/billing";
import { cardSpent, groupIban, ibanEra, ownIban, spendable, WRONG_LIMIT, type Draft } from "../../../../../sim/46-finance/bank";
import type { GameState } from "../../../../../sim/50-state";
import { applyCard, applyOverdraft, openBankAccount, cancelTransfer, confirmTransfer, deleteStandingOrder, setTanMethod, startStandingOrder, startTransfer } from "../../../../../sim/90-actions/bank";
import { takeLoan } from "../../../../../sim/90-actions/billing";
import { readSession, writeSession } from "../../../../session";
import { useStore } from "../../../../store";
import "./bank-site.css";

type Go = (url: string) => void;
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const pct = (r: number) => `${(r * 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 })} %`;
const VIEWS = ["statement", "transfer", "orders", "card", "overdraft", "loans", "service"] as const;
type View = (typeof VIEWS)[number];

// One frame for every bank: the skin swaps colours, layout and era, the account's TAN method sets the transfer's last step.
export function BankSite({ game, id, path, go }: { game: GameState; id: BankId; path: string; go: Go }) {
  const bank = bankById(id)!;
  // Written at once: the navigation that follows a login mounts the page anew.
  const [login, setState] = useState(() => readSession(`bank.login.${id}`, false));
  const setLogin = (v: boolean) => { writeSession(`bank.login.${id}`, v); setState(v); };
  const own = game.bank?.id === id && login;
  const view = (VIEWS.find((v) => path.startsWith(`/banking/${v}`)) ?? "statement") as View;
  const query = new URLSearchParams(path.split("?")[1] ?? "");
  const home = `www.${bank.host}`;
  return (
    <div className={`bks bks-${bank.skin.frame} ${yearOf(game.hour) >= bank.skin.redesign ? "late" : "early"}`} style={{ "--bar": bank.skin.bar, "--accent": bank.skin.accent, "--bg": bank.skin.bg } as CSSProperties}>
      <header className="bks-head">
        <span className="bks-logo" aria-hidden>{bank.name.charAt(0).toUpperCase()}</span>
        <span className="bks-name">{bank.name}</span>
        <span className="bks-grow" />
        {own && <span className="bks-who">{t("bank.site.account", { number: game.bank!.number })}</span>}
        {own && <button className="bks-btn" onClick={() => { setLogin(false); go(`${home}/`); }}>{t("bank.site.logout")}</button>}
      </header>
      <div className="bks-cols">
        <nav className="bks-nav">
          {own
            ? VIEWS.map((v) => <a key={v} href="#" aria-current={v === view || undefined} onClick={(e) => { e.preventDefault(); go(`${home}/banking/${v}`); }}>{t(`bank.site.nav.${v}`)}</a>)
            : <a href="#" aria-current onClick={(e) => e.preventDefault()}>{t("bank.site.nav.login")}</a>}
        </nav>
        <main className="bks-main">
          {!own ? <Login game={game} bank={bank} onIn={() => { setLogin(true); if (!path.startsWith("/banking/")) go(`${home}/banking/statement`); }} onOpen={() => { setLogin(true); go(`${home}/banking/opened`); }} />
            : path.startsWith("/banking/opened") ? <Opened game={game} />
            : view === "statement" ? <Statement game={game} />
            : view === "transfer" ? <Transfer key={path} game={game} bank={bank} prefill={query} go={go} />
            : view === "orders" ? <Orders key={path} game={game} bank={bank} go={go} />
            : view === "card" ? <CardView game={game} bank={bank} />
            : view === "overdraft" ? <Overdraft game={game} bank={bank} />
            : view === "loans" ? <Loans game={game} />
            : <Service game={game} bank={bank} />}
        </main>
      </div>
      <footer className="bks-foot">{t("bank.site.footer", { name: bank.name, year: yearOf(game.hour) })}</footer>
    </div>
  );
}

function Box({ title, children }: { title: string; children: ReactNode }) {
  return <section className="bks-box"><h2>{title}</h2>{children}</section>;
}

function Login({ game, bank, onIn, onOpen }: { game: GameState; bank: Bank; onIn: () => void; onOpen: () => void }) {
  const act = useStore((s) => s.act);
  const [number, setNumber] = useState(""), [pin, setPin] = useState(""), [failed, setFailed] = useState(false);
  const submit = () => {
    const ok = game.bank?.id === bank.id && number.trim() === game.bank.number && pin.trim() === game.bank.pin;
    setFailed(!ok);
    if (ok) onIn();
  };
  return (
    <>
      <Box title={t("bank.site.loginTitle")}>
        <form className="bks-form" onSubmit={(e) => { e.preventDefault(); submit(); }}>
          <label>{t("bank.site.number")}<input inputMode="numeric" value={number} onChange={(e) => setNumber(e.target.value)} /></label>
          <label>{t("bank.site.pin")}<input type="password" inputMode="numeric" value={pin} onChange={(e) => setPin(e.target.value)} /></label>
          <button className="bks-btn primary">{t("bank.site.login")}</button>
          {failed && <p className="bks-error">{t("bank.site.loginFailed")}</p>}
        </form>
      </Box>
      <Box title={t("bank.site.conditions")}>
        <table className="bks-table">
          <tbody>
            {Object.entries(LEGAL_FORMS).map(([form, label]) => {
              const fee = monthlyFee(bank, form), booking = bookingFee(bank, form);
              return (
                <tr key={form}>
                  <td>{t("bank.site.monthly", { form: label })}</td>
                  <td className="r">{fee === null ? "–" : booking ? t("bank.site.plusBooking", { fee: euroCents(fee), booking: euroCents(booking) }) : euroCents(fee)}</td>
                </tr>
              );
            })}
            <tr><td>{t("bank.site.transferTime")}</td><td className="r">{t(`bank.speed.${bank.speed}`)}</td></tr>
            <tr><td>{t("bank.site.tan")}</td><td className="r">{tanMethods(bank, yearOf(game.hour)).map((m) => t(`bank.tan.${m.label}`)).join(", ")}</td></tr>
            <tr><td>{t("bank.site.cardFee")}</td><td className="r">{euro(bank.card.yearly)}</td></tr>
            <tr><td>{t("bank.site.overdraftRate")}</td><td className="r">{bank.overdraft === null ? "–" : pct(bank.overdraft)}</td></tr>
          </tbody>
        </table>
        {!game.bank && <p><button className="bks-btn primary" onClick={() => { if (act(openBankAccount, bank.id).ok) onOpen(); }}>{t("bank.site.open")}</button></p>}
      </Box>
    </>
  );
}

// Shown once after opening: the details the player logs in with from then on.
function Opened({ game }: { game: GameState }) {
  const b = game.bank!;
  return (
    <Box title={t("bank.site.opened")}>
      <table className="bks-table">
        <tbody>
          <tr><td>{t("bank.site.number")}</td><td className="r num">{`${b.number} / ${bankById(b.id)!.code}`}</td></tr>
          {ibanEra(game) && <tr><td>{t("bank.site.iban")}</td><td className="r num">{groupIban(ownIban(game))}</td></tr>}
          <tr><td>{t("bank.site.pin")}</td><td className="r num">{b.pin}</td></tr>
        </tbody>
      </table>
    </Box>
  );
}

function Statement({ game }: { game: GameState }) {
  const b = game.bank!;
  // The balance after each booking, counted back from today's balance.
  let balance = game.cash;
  const rows = game.ledger.filter((e) => e.hour >= b.opened).reverse().slice(0, 60).map((e) => {
    const row = { e, balance };
    balance -= e.amount;
    return row;
  });
  return (
    <>
      <Box title={t("bank.site.nav.statement")}>
        <table className="bks-table">
          <tbody>
            <tr><td>{ibanEra(game) ? t("bank.site.iban") : t("bank.site.number")}</td><td className="r num">{ibanEra(game) ? groupIban(ownIban(game)) : `${b.number} / ${bankById(b.id)!.code}`}</td></tr>
            <tr><td>{t("bank.site.balance")}</td><td className={`r num${game.cash < 0 ? " neg" : ""}`}>{euroCents(game.cash)}</td></tr>
            <tr><td>{t("bank.site.available")}</td><td className="r num">{euroCents(spendable(game))}</td></tr>
          </tbody>
        </table>
      </Box>
      <table className="bks-table bks-rows">
        <thead><tr><th>{t("bank.site.date")}</th><th>{t("bank.site.text")}</th><th className="r">{t("bank.site.amount")}</th><th className="r">{t("bank.site.balance")}</th></tr></thead>
        <tbody>
          {rows.map(({ e, balance: after }, i) => (
            <tr key={i}><td className="num">{day(e.hour)}</td><td>{t(e.key, e.params)}</td><td className={`r num${e.amount < 0 ? " neg" : ""}`}>{euroCents(e.amount)}</td><td className="r num">{euroCents(after)}</td></tr>
          ))}
          {!rows.length && <tr><td colSpan={4}>{t("bank.site.noBookings")}</td></tr>}
        </tbody>
      </table>
    </>
  );
}

function Transfer({ game, bank, prefill, go, standing }: { game: GameState; bank: Bank; prefill: URLSearchParams; go: Go; standing?: boolean }) {
  const act = useStore((s) => s.act);
  const b = game.bank!, iban = ibanEra(game);
  const [name, setName] = useState(prefill.get("name") ?? "");
  const [account, setAccount] = useState(prefill.get("account") ?? "");
  const [code, setCode] = useState(prefill.get("code") ?? "");
  const [amount, setAmount] = useState(prefill.get("amount") ?? "");
  const [reference, setReference] = useState(prefill.get("reference") ?? "");
  const [tan, setTan] = useState("");
  const [orderDay, setOrderDay] = useState("1");
  const title = t(standing ? "bank.site.newOrder" : "bank.site.nav.transfer"), again = `www.${bank.host}/banking/${standing ? "orders" : "transfer"}`;
  const [sent, setSent] = useState(false);
  if (game.hour < b.lockedUntil) return <Box title={title}><p className="bks-error">{t("bank.site.locked", { date: day(b.lockedUntil) })}</p></Box>;
  if (sent && !b.pending) {
    return (
      <Box title={title}>
        <p className="bks-ok">{t(standing ? "bank.site.orderSaved" : "bank.site.sent")}</p>
        <button className="bks-btn" onClick={() => go(again)}>{t(standing ? "bank.site.newOrder" : "bank.site.newTransfer")}</button>
      </Box>
    );
  }
  if (b.pending) {
    const p = b.pending, d = p.draft;
    return (
      <Box title={t("bank.site.confirm")}>
        <table className="bks-table">
          <tbody>
            <tr><td>{t("bank.site.payee")}</td><td>{d.name}</td></tr>
            <tr><td>{iban ? t("bank.site.iban") : t("bank.site.payeeAccount")}</td><td className="num">{iban ? groupIban(d.account) : `${d.account} / ${d.code}`}</td></tr>
            <tr><td>{t("bank.site.amount")}</td><td className="num">{euroCents(d.amount)}</td></tr>
            <tr><td>{t("bank.site.reference")}</td><td>{d.reference}</td></tr>
            {p.day !== undefined && <tr><td>{t("bank.site.orderDay")}</td><td className="num">{p.day}</td></tr>}
          </tbody>
        </table>
        <form className="bks-form" onSubmit={(e) => { e.preventDefault(); if (act(confirmTransfer, tan).ok) setSent(true); setTan(""); }}>
          {b.tan === "itan" && <label>{t("bank.site.tanNo", { n: String(p.index! + 1).padStart(3, "0") })}<input inputMode="numeric" autoFocus value={tan} onChange={(e) => setTan(e.target.value)} /></label>}
          {b.tan === "mtan" && <label>{t("bank.site.mtan")}<input inputMode="numeric" autoFocus value={tan} onChange={(e) => setTan(e.target.value)} /></label>}
          {b.wrong > 0 && <p className="bks-error">{t("bank.site.wrongLeft", { n: WRONG_LIMIT - b.wrong })}</p>}
          <div className="bks-row">
            <button className="bks-btn primary">{b.tan === "itan" || b.tan === "mtan" ? t("bank.site.send") : t(`bank.site.confirm.${b.tan}`)}</button>
            <button type="button" className="bks-btn" onClick={() => act(cancelTransfer)}>{t("bank.site.cancel")}</button>
          </div>
        </form>
      </Box>
    );
  }
  const draft = (): Draft => ({ name, account, ...(iban ? {} : { code }), amount: Number(amount.replace(",", ".")), reference, ...(prefill.get("payable") && { payableId: prefill.get("payable")! }) });
  return (
    <Box title={title}>
      <form className="bks-form" onSubmit={(e) => { e.preventDefault(); if (standing) act(startStandingOrder, draft(), Number(orderDay)); else act(startTransfer, draft()); }}>
        <label>{t("bank.site.payee")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        {iban
          ? <label>{t("bank.site.iban")}<input className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>
          : <>
            <label>{t("bank.site.payeeAccount")}<input inputMode="numeric" className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>
            <label>{t("bank.site.code")}<input inputMode="numeric" className="num" value={code} onChange={(e) => setCode(e.target.value)} /></label>
          </>}
        <label>{t("bank.site.amount")}<input inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        <label>{t("bank.site.reference")}<input value={reference} maxLength={140} onChange={(e) => setReference(e.target.value)} /></label>
        {standing && <label>{t("bank.site.orderDay")}<input type="number" min={1} max={28} className="num" value={orderDay} onChange={(e) => setOrderDay(e.target.value)} /></label>}
        <button className="bks-btn primary">{t("bank.site.next")}</button>
      </form>
    </Box>
  );
}

function Loans({ game }: { game: GameState }) {
  const act = useStore((s) => s.act);
  const [years, setYears] = useState(LOAN_YEARS[2]);
  const limit = Math.floor(loanAvailable(game)), rate = loanRate(game), blocked = game.hour < game.loansBlockedUntil;
  const min = bankById(game.bank!.id)!.loans.min;
  const amounts = blocked ? [] : [...LOAN_AMOUNTS.filter((a) => a <= limit), ...(limit > 0 && !LOAN_AMOUNTS.includes(limit) ? [limit] : [])].filter((a) => a >= min);
  return (
    <Box title={t("bank.site.nav.loans")}>
      <div className="bks-row">
        <label>{t("bank.site.term")}
          <select value={years} onChange={(e) => setYears(Number(e.target.value))}>
            {LOAN_YEARS.map((y) => <option key={y} value={y}>{t("misc2.year", { n: y })}</option>)}
          </select>
        </label>
        <span className="bks-grow" />
        <span>{t("misc2.available", { amount: euro(blocked ? 0 : limit) })}</span>
      </div>
      <table className="bks-table bks-rows">
        <thead><tr><th className="r">{t("bank.site.amount")}</th><th className="r">{t("misc2.interestRate")}</th><th className="r">{t("misc2.instalment")}</th><th className="r">{t("misc2.totalInterest")}</th><th /></tr></thead>
        <tbody>
          {amounts.map((a) => {
            const pay = annuity(a, rate, years * 12);
            return (
              <tr key={a}>
                <td className="r num">{euro(a)}</td><td className="r num">{pct(rate)}</td><td className="r num">{euroCents(pay)}</td><td className="r num">{euroCents(pay * years * 12 - a)}</td>
                <td className="r"><button className="bks-btn" onClick={() => act(takeLoan, a, years)}>{t("misc2.takeLoan")}</button></td>
              </tr>
            );
          })}
          {!amounts.length && <tr><td colSpan={5}>{blocked ? t("misc2.lendsAgain", { date: day(game.loansBlockedUntil) }) : t("misc2.limitUsed")}</td></tr>}
        </tbody>
      </table>
    </Box>
  );
}

function Service({ game, bank }: { game: GameState; bank: Bank }) {
  const act = useStore((s) => s.act);
  return (
    <Box title={t("bank.site.nav.service")}>
      <form className="bks-form" onSubmit={(e) => e.preventDefault()}>
        <label>{t("bank.site.tan")}
          <select value={game.bank!.tan} onChange={(e) => act(setTanMethod, e.target.value as TanMethod)}>
            {tanMethods(bank, yearOf(game.hour)).map((m) => <option key={m.method} value={m.method}>{t(`bank.tan.${m.label}`)}</option>)}
          </select>
        </label>
      </form>
    </Box>
  );
}

function CardView({ game, bank }: { game: GameState; bank: Bank }) {
  const act = useStore((s) => s.act), card = game.bank!.card;
  return (
    <Box title={t("bank.site.nav.card")}>
      <table className="bks-table">
        <tbody>
          <tr><td>{t("bank.site.cardFee")}</td><td className="r num">{euro(bank.card.yearly)}</td></tr>
          {card && game.hour < card.readyAt && <tr><td>{t("bank.site.appliedOn")}</td><td className="r num">{day(card.appliedAt)}</td></tr>}
          {card && game.hour >= card.readyAt && <>
            <tr><td>{t("bank.site.limit")}</td><td className="r num">{euro(card.limit)}</td></tr>
            <tr><td>{t("bank.site.cardSpent")}</td><td className="r num">{euroCents(cardSpent(game))}</td></tr>
            <tr><td>{t("bank.site.available")}</td><td className="r num">{euroCents(card.limit - cardSpent(game))}</td></tr>
          </>}
        </tbody>
      </table>
      {!card && <button className="bks-btn primary" onClick={() => act(applyCard)}>{t("bank.site.apply")}</button>}
    </Box>
  );
}

function Overdraft({ game, bank }: { game: GameState; bank: Bank }) {
  const act = useStore((s) => s.act), b = game.bank!;
  return (
    <Box title={t("bank.site.nav.overdraft")}>
      <table className="bks-table">
        <tbody>
          <tr><td>{t("bank.site.overdraftRate")}</td><td className="r num">{bank.overdraft === null ? "–" : pct(bank.overdraft)}</td></tr>
          <tr><td>{t("bank.site.limit")}</td><td className="r num">{euro(b.overdraft)}</td></tr>
          {b.overdraftAt !== null && <tr><td>{t("bank.site.decidedOn")}</td><td className="r num">{day(b.overdraftAt)}</td></tr>}
        </tbody>
      </table>
      {bank.overdraft !== null && b.overdraftAt === null && <button className="bks-btn primary" onClick={() => act(applyOverdraft)}>{b.overdraft ? t("bank.site.reapply") : t("bank.site.apply")}</button>}
    </Box>
  );
}

function Orders({ game, bank, go }: { game: GameState; bank: Bank; go: Go }) {
  const act = useStore((s) => s.act), orders = game.bank!.standingOrders;
  return (
    <>
      <table className="bks-table bks-rows">
        <thead><tr><th>{t("bank.site.payee")}</th><th>{t("bank.site.reference")}</th><th className="r">{t("bank.site.orderDay")}</th><th className="r">{t("bank.site.amount")}</th><th /></tr></thead>
        <tbody>
          {orders.map((o) => (
            <tr key={o.id}><td>{o.name}</td><td>{o.reference}</td><td className="r num">{o.day}</td><td className="r num">{euroCents(o.amount)}</td>
              <td className="r"><button className="bks-btn" onClick={() => act(deleteStandingOrder, o.id)}>{t("bank.site.delete")}</button></td></tr>
          ))}
          {!orders.length && <tr><td colSpan={5}>{t("bank.site.noOrders")}</td></tr>}
        </tbody>
      </table>
      <br />
      <Transfer game={game} bank={bank} prefill={new URLSearchParams()} go={go} standing />
    </>
  );
}
