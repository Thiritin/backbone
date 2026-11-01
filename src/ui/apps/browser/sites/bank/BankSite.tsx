import { useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../../i18n/en";
import { LOCALE } from "../../../../../i18n/lang";
import { euro, euroCents } from "../../../../../sim/00-core/money";
import { dateOf, hourOf, yearOf } from "../../../../../sim/00-core/time";
import { bankById, monthlyFee, plansFor, tanMethods, type Bank, type BankId, type Plan, type PlanId, type TanMethod } from "../../../../../sim/10-catalog/banks";
import { annuity, LOAN_AMOUNTS, LOAN_YEARS, loanAvailable, loanRate } from "../../../../../sim/45-billing/billing";
import { cardSpent, groupIban, iban as toIban, ibanEra, ownIban, spendable, WRONG_LIMIT, type Draft, type Payee } from "../../../../../sim/46-finance/bank";
import type { GameState } from "../../../../../sim/50-state";
import { applyCard, applyOverdraft, openBankAccount, cancelTransfer, confirmTransfer, deletePayee, deleteStandingOrder, savePayee, setPlan, setTanMethod, startStandingOrder, startTransfer, switchBank } from "../../../../../sim/90-actions/bank";
import { takeLoan } from "../../../../../sim/90-actions/billing";
import { readSession, writeSession } from "../../../../session";
import { noAutofill } from "../../../../no-autofill";
import "./bank-site.css";
import { useFieldAct, usePageAct } from "../../pageAct";

type Go = (url: string) => void;
const day = (hour: number) => dateOf(hour).toLocaleDateString(LOCALE, { day: "2-digit", month: "2-digit", year: "numeric", timeZone: "UTC" });
const pct = (r: number) => `${(r * 100).toLocaleString(LOCALE, { maximumFractionDigits: 2 })} %`;
const VIEWS = ["statement", "transfer", "orders", "payees", "card", "overdraft", "loans", "service"] as const;
type View = (typeof VIEWS)[number];
// A payee saved before IBAN is sent to its IBAN once IBAN applies.
const payeeAccount = (p: Payee, iban: boolean) => (iban && p.code ? toIban(p.code, p.account) : p.account);

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
            : view === "payees" ? <Payees game={game} bank={bank} go={go} />
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

// The bank's plans with the fee for the company's form; last renders the row's pick or state.
function Plans({ game, bank, last }: { game: GameState; bank: Bank; last: (p: Plan, serves: boolean) => ReactNode }) {
  const form = game.registration?.form ?? "sole", serving = plansFor(bank, form);
  return (
    <table className="bks-table bks-rows">
      <thead><tr><th>{t("bank.site.planName")}</th><th className="r">{t("bank.site.planFee")}</th><th className="r">{t("bank.site.freeBookings")}</th><th className="r">{t("bank.site.perBooking")}</th><th className="r">{t("bank.site.planCard")}</th><th /></tr></thead>
      <tbody>
        {bank.plans.map((p) => (
          <tr key={p.id}>
            <td>{p.name}</td>
            <td className="r num">{euroCents(monthlyFee(bank, p.id, form))}</td>
            <td className="r num">{p.booking ? p.free : t("bank.site.allFree")}</td>
            <td className="r num">{p.booking ? euroCents(p.booking) : "–"}</td>
            <td className="r">{p.card === "double" ? t("bank.site.cardDouble") : p.card ? t("bank.site.cardIncluded") : t("bank.site.cardYearly", { fee: euro(bank.card.yearly) })}</td>
            <td className="r">{last(p, serving.includes(p))}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function Login({ game, bank, onIn, onOpen }: { game: GameState; bank: Bank; onIn: () => void; onOpen: () => void }) {
  const act = usePageAct();
  const [number, setNumber] = useState(""), [pin, setPin] = useState(""), [failed, setFailed] = useState(false);
  const [plan, setPlanPick] = useState<PlanId | undefined>(() => plansFor(bank, game.registration?.form ?? "sole")[0]?.id);
  const other = !!game.bank && game.bank.id !== bank.id;
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
          <label>{t("bank.site.pin")}<input type="password" inputMode="numeric" value={pin} {...noAutofill} onChange={(e) => setPin(e.target.value)} /></label>
          <button className="bks-btn primary">{t("bank.site.login")}</button>
          {failed && <p className="bks-error">{t("bank.site.loginFailed")}</p>}
        </form>
      </Box>
      <Box title={t("bank.site.conditions")}>
        <table className="bks-table">
          <tbody>
            <tr><td>{t("bank.site.transferTime")}</td><td className="r">{t(`bank.speed.${bank.speed}`)}</td></tr>
            <tr><td>{t("bank.site.tan")}</td><td className="r">{tanMethods(bank, yearOf(game.hour)).map((m) => t(`bank.tan.${m.label}`)).join(", ")}</td></tr>
            <tr><td>{t("bank.site.cardFee")}</td><td className="r">{euro(bank.card.yearly)}</td></tr>
            <tr><td>{t("bank.site.overdraftRate")}</td><td className="r">{bank.overdraft === null ? "–" : pct(bank.overdraft)}</td></tr>
            <tr><td>{t("bank.site.loanRate")}</td><td className="r">{bank.loans.factor ? pct(loanRate(game, bank.id)) : "–"}</td></tr>
          </tbody>
        </table>
      </Box>
      <Box title={t("bank.site.plans")}>
        <Plans game={game} bank={bank} last={(p, serves) => (game.bank && !other ? null
          : <input type="radio" name="plan" aria-label={p.name} disabled={!serves} checked={plan === p.id} onChange={() => setPlanPick(p.id)} />)} />
        {(!game.bank || other) && plan && <p><button className="bks-btn primary" onClick={() => {
          if ((other ? act(switchBank, bank.id, plan) : act(openBankAccount, bank.id, plan)).ok) onOpen();
        }}>{other ? t("bank.site.switch", { bank: bank.name }) : t("bank.site.open")}</button></p>}
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

// Shown under the field the bank turned down, or under the form.
const FIELD: Record<string, string> = { "error.payeeName": "name", "error.payeeAccount": "account", "error.badAmount": "amount", "error.noCash": "amount" };

function Transfer({ game, bank, prefill, go, standing }: { game: GameState; bank: Bank; prefill: URLSearchParams; go: Go; standing?: boolean }) {
  const [act, error] = useFieldAct();
  const at = error ? FIELD[error] ?? "form" : null, note = (field: string) => at === field && <p className="bks-error" role="alert">{t(error!)}</p>;
  const b = game.bank!, iban = ibanEra(game);
  const [name, setName] = useState(prefill.get("name") ?? "");
  const [account, setAccount] = useState(prefill.get("account") ?? "");
  const [code, setCode] = useState(prefill.get("code") ?? "");
  const [amount, setAmount] = useState(prefill.get("amount") ?? "");
  const [reference, setReference] = useState(prefill.get("reference") ?? "");
  const [tan, setTan] = useState("");
  const [orderDay, setOrderDay] = useState("1");
  const [keep, setKeep] = useState(false);
  const payees = b.payees ?? [];
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
          {note("form")}
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
      <form className="bks-form" onSubmit={(e) => { e.preventDefault(); const r = standing ? act(startStandingOrder, draft(), Number(orderDay)) : act(startTransfer, draft()); if (r.ok && keep) act(savePayee, { name, account, ...(iban ? {} : { code }) }); }}>
        {payees.length > 0 && (
          <label>{t("bank.site.pickPayee")}
            <select value="" onChange={(e) => { const p = payees.find((x) => x.id === e.target.value); if (!p) return; setName(p.name); setAccount(payeeAccount(p, iban)); setCode(p.code ?? ""); }}>
              <option value="" />
              {payees.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </label>
        )}
        <label>{t("bank.site.payee")}<input value={name} onChange={(e) => setName(e.target.value)} /></label>
        {note("name")}
        {iban
          ? <><label>{t("bank.site.iban")}<input className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>{note("account")}</>
          : <>
            <label>{t("bank.site.payeeAccount")}<input inputMode="numeric" className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>
            <label>{t("bank.site.code")}<input inputMode="numeric" className="num" value={code} onChange={(e) => setCode(e.target.value)} /></label>
            {note("account")}
          </>}
        <label>{t("bank.site.amount")}<input inputMode="decimal" className="num" value={amount} onChange={(e) => setAmount(e.target.value)} /></label>
        {note("amount")}
        <label>{t("bank.site.reference")}<input value={reference} maxLength={140} onChange={(e) => setReference(e.target.value)} /></label>
        <label>{t("bank.site.savePayee")}<input type="checkbox" checked={keep} onChange={(e) => setKeep(e.target.checked)} /></label>
        {standing && <label>{t("bank.site.orderDay")}<input type="number" min={1} max={28} className="num" value={orderDay} onChange={(e) => setOrderDay(e.target.value)} /></label>}
        {note("form")}
        <button className="bks-btn primary">{t("bank.site.next")}</button>
      </form>
    </Box>
  );
}

function Payees({ game, bank, go }: { game: GameState; bank: Bank; go: Go }) {
  const act = usePageAct(), iban = ibanEra(game), payees = game.bank!.payees ?? [];
  const [name, setName] = useState(""), [account, setAccount] = useState(""), [code, setCode] = useState(""), [saved, setSaved] = useState(false);
  const transfer = (p: Payee) => go(`www.${bank.host}/banking/transfer?${new URLSearchParams({ name: p.name, account: payeeAccount(p, iban), ...(p.code && !iban && { code: p.code }) })}`);
  const save = () => { if (act(savePayee, { name, account, ...(iban ? {} : { code }) }).ok) { setName(""); setAccount(""); setCode(""); setSaved(true); } };
  return (
    <>
      <table className="bks-table bks-rows">
        <thead><tr><th>{t("bank.site.payee")}</th><th>{iban ? t("bank.site.iban") : t("bank.site.payeeAccount")}</th><th /></tr></thead>
        <tbody>
          {payees.map((p) => (
            <tr key={p.id}><td>{p.name}</td><td className="num">{iban ? groupIban(payeeAccount(p, iban)) : `${p.account} / ${p.code}`}</td>
              <td className="r"><button className="bks-btn" onClick={() => transfer(p)}>{t("bank.site.nav.transfer")}</button> <button className="bks-btn" onClick={() => act(deletePayee, p.id)}>{t("bank.site.delete")}</button></td></tr>
          ))}
          {!payees.length && <tr><td colSpan={3}>{t("bank.site.noPayees")}</td></tr>}
        </tbody>
      </table>
      <br />
      <Box title={t("bank.site.newPayee")}>
        <form className="bks-form" onSubmit={(e) => { e.preventDefault(); save(); }}>
          <label>{t("bank.site.payee")}<input value={name} onChange={(e) => { setName(e.target.value); setSaved(false); }} /></label>
          {iban
            ? <label>{t("bank.site.iban")}<input className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>
            : <>
              <label>{t("bank.site.payeeAccount")}<input inputMode="numeric" className="num" value={account} onChange={(e) => setAccount(e.target.value)} /></label>
              <label>{t("bank.site.code")}<input inputMode="numeric" className="num" value={code} onChange={(e) => setCode(e.target.value)} /></label>
            </>}
          <button className="bks-btn primary">{t("bank.site.savePayee")}</button>
          {saved && <p className="bks-ok">{t("bank.site.payeeSaved")}</p>}
        </form>
      </Box>
    </>
  );
}

function Loans({ game }: { game: GameState }) {
  const act = usePageAct();
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
  const act = usePageAct(), b = game.bank!, d = dateOf(game.hour);
  const first = day(hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() + 1, 1))));
  const old = b.previous, oldName = old ? bankById(old.id)!.name : "";
  return (
    <>
    <Box title={t("bank.site.plans")}>
      <Plans game={game} bank={bank} last={(p, serves) => p.id === b.planNext ? t("bank.site.planFrom", { date: first })
        : p.id === b.plan && !b.planNext ? t("bank.site.current")
        : serves ? <button className="bks-btn" onClick={() => act(setPlan, p.id)}>{t("bank.site.choose")}</button> : "–"} />
    </Box>
    {!!old?.standingOrders.length && (
      <Box title={t("bank.site.oldOrders", { bank: oldName })}>
        <table className="bks-table bks-rows">
          <thead><tr><th>{t("bank.site.payee")}</th><th>{t("bank.site.reference")}</th><th className="r">{t("bank.site.orderDay")}</th><th className="r">{t("bank.site.amount")}</th></tr></thead>
          <tbody>{old.standingOrders.map((o) => <tr key={o.id}><td>{o.name}</td><td>{o.reference}</td><td className="r num">{o.day}</td><td className="r num">{euroCents(o.amount)}</td></tr>)}</tbody>
        </table>
      </Box>
    )}
    {!!old?.mandates.length && <Box title={t("bank.site.oldMandates", { bank: oldName })}><ul>{old.mandates.map((m) => <li key={m}>{m}</li>)}</ul></Box>}
    <Box title={t("bank.site.nav.service")}>
      <form className="bks-form" onSubmit={(e) => e.preventDefault()}>
        <label>{t("bank.site.tan")}
          <select value={game.bank!.tan} onChange={(e) => act(setTanMethod, e.target.value as TanMethod)}>
            {tanMethods(bank, yearOf(game.hour)).map((m) => <option key={m.method} value={m.method}>{t(`bank.tan.${m.label}`)}</option>)}
          </select>
        </label>
      </form>
    </Box>
    </>
  );
}

function CardView({ game, bank }: { game: GameState; bank: Bank }) {
  const act = usePageAct(), card = game.bank!.card;
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
  const act = usePageAct(), b = game.bank!;
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
  const act = usePageAct(), orders = game.bank!.standingOrders;
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
