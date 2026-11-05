import { useSessionState } from "../session";
import { t } from "../../i18n/en";
import { atDesk, inLetterbox, type Letter as Post } from "../../sim/40-support/letters";
import { readLetter } from "../../sim/90-actions/paperwork";
import { scanLetter } from "../../sim/90-actions/post";
import { playerAt } from "../../sim/60-infra/handwork";
import { useFocus, useStore } from "../store";
import { officeAddress } from "../../sim/60-infra/properties";
import { paperDay } from "./FormDoc";
import { payUrl } from "./books/PayablesTab";
import { supplierBrand } from "./preview/SupplierInvoice";
import { LETTERHEADS } from "../art/letterheads";
import "./paper.css";

// Letters at the desk, newest first, under the ones still waiting in the letterbox; a bill carries a Pay button like the Books payables.
export function PostApp() {
  const game = useStore((s) => s.game), act = useStore((s) => s.act), openApp = useStore((s) => s.openApp);
  const [sel, setSel] = useSessionState<string | null>("post.sel", null);
  const letters = [...atDesk(game)].reverse(), boxed = [...inLetterbox(game)].reverse(), l = letters.find((x) => x.id === sel);
  const bill = l?.payable ? game.payables.find((p) => p.id === l.payable) : undefined;
  const here = playerAt(game).id;
  const open = (id: string, read: boolean) => { setSel(id); if (!read) act(readLetter, id); };
  // The next-step card selects the first unpaid bill.
  useFocus("Post", (f) => {
    const bill = f.kind === "bill" && letters.find((x) => game.payables.some((p) => p.id === x.payable && p.paidAt === null));
    if (bill) open(bill.id, bill.read);
  });
  return (
    <div className="post">
      <div className="post-list" role="list">
        {letters.map((x) => (
          <button key={x.id} role="listitem" className={`post-row${x.id === sel ? " active" : ""}${x.read ? "" : " unread"}`} onClick={() => open(x.id, x.read)}>
            <strong>{x.from}</strong>
            <span>{t(`letter.${x.topic}.subject`, x.params)}</span>
            <small className="num">{paperDay(x.at)}</small>
          </button>
        ))}
        {boxed.length > 0 && (
          <div className="post-box" role="group" aria-label={t("paperwork.post.box")}>
            <div className="post-group"><span>{t("paperwork.post.box")}</span><span className="num">{boxed.length}</span></div>
            {boxed.map((x) => (
              <div key={x.id} role="listitem" className="post-row boxed">
                <strong>{x.from}</strong>
                <small className="num">{game.locations.find((o) => o.id === x.box)?.name} {paperDay(x.at)}</small>
                {here === x.box && <button className="btn" onClick={() => openApp("Post", { kind: "letterbox", id: x.box! })}>{t("paperwork.post.toBox")}</button>}
              </div>
            ))}
          </div>
        )}
        {!letters.length && !boxed.length && <div className="post-none">{t("paperwork.post.empty")}</div>}
      </div>
      {l && (
        <div className="paper-scroll">
          <div className="letter-actions">
            {l.scanned ? <span>{t("paperwork.post.scanned")}</span> : <button className="btn" onClick={() => act(scanLetter, l.id)}>{t("paperwork.post.scan")}</button>}
            {l.link && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: l.link! })}>{t("paperwork.post.open")}</button>}
            {bill && <button className="btn" onClick={() => openApp("Preview", { kind: "payable", id: bill.id })}>{t(`purchase.doc.${bill.doc ?? "invoice"}`)}</button>}
            {bill && (bill.paidAt !== null ? <span>{t("bank.pay.paid")}</span>
              : game.bank && <button className="btn" onClick={() => openApp("Browser", { kind: "url", id: payUrl(game, bill) })}>{t("bank.pay.pay")}</button>)}
          </div>
          <div className="letter-fit">
            <Letter letter={l} company={game.company.name} owner={game.registration?.owner} />
          </div>
        </div>
      )}
    </div>
  );
}

// One A4 page laid out after DIN 5008 form B: letterhead, window address, reference block, fold and punch marks, footer.
export function Letter({ letter: l, company, owner }: { letter: Post; company: string; owner?: string }) {
  const game = useStore((s) => s.game), h = LETTERHEADS[l.from], brand = supplierBrand(l.from), p = l.params, a = officeAddress(game);
  const paid = !!l.payable && game.payables.find((x) => x.id === l.payable)?.paidAt != null;
  const ref = p.number ?? (p.reg ? `GA ${p.reg}` : null);
  const bank = p.iban ? `IBAN ${p.iban}` : p.account ? `${t("paperwork.letter.account")} ${p.account} · ${t("paperwork.letter.code")} ${p.code}` : null;
  return (
    <article className={`letter${h?.serif ? " serif" : ""}`}>
      <i className="letter-mark fold1" /><i className="letter-mark punch" /><i className="letter-mark fold2" />
      <header className="letter-head">
        <span className="letter-logo">{h ? h.mark : brand.logo}</span>
        <div><strong style={h ? undefined : { color: brand.color }}>{h?.org ?? l.from}</strong>{h && <span>{t(h.dept)}</span>}</div>
      </header>
      <div className="letter-window">
        {h && <small>{[h.org, h.street, h.city].join(" · ")}</small>}
        <address>{[company, owner, a.street, `${a.zip} ${a.city}`].filter(Boolean).map((x) => <span key={x}>{x}</span>)}</address>
      </div>
      <dl className="letter-info">
        {ref && <><dt>{t("paperwork.letter.ourRef")}</dt><dd>{ref}</dd></>}
        {h && <><dt>{t("paperwork.letter.phone")}</dt><dd>{h.phone}</dd></>}
        <dt>{t("paperwork.letter.date")}</dt><dd>{paperDay(l.at)}</dd>
      </dl>
      <div className="letter-body">
        <h1>{t(`letter.${l.topic}.subject`, p)}</h1>
        <p>{t("paperwork.letter.greeting")}</p>
        <p>{t(`letter.${l.topic}.body`, p)}</p>
        <p>{t("paperwork.letter.closing")}</p>
        {paid && <p className="letter-paid">{t("paperwork.letter.paid")}</p>}
        {h?.signer ? <p className="letter-sign"><span className="paper-ink">{h.signer}</span>{h.signer}</p> : <p className="letter-machine">{t("paperwork.letter.machine")}</p>}
      </div>
      {h && (
        <footer className="letter-foot">
          <div><span>{h.org}</span><span>{h.street}</span><span>{h.city}</span></div>
          <div><span>{t("paperwork.letter.phone")} {h.phone}</span><span>{h.web}</span></div>
          {bank && <div><span>{t("paperwork.letter.bank")}</span><span>{bank}</span></div>}
        </footer>
      )}
    </article>
  );
}
