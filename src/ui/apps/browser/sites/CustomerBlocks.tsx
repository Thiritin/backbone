import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { t } from "../../../../i18n/en";
import { LOCALE } from "../../../../i18n/lang";
import { euro } from "../../../../sim/00-core/money";

export interface BlockCtx {
  name: string; domain: string; year: number; seed: number; blurb: string;
  dark: boolean; setDark: (v: boolean) => void; cart: number; addToCart: () => void;
}

// A stable fake number for the site, so a page shows the same content on every visit.
const num = (c: BlockCtx, i: number, mod: number): number => Math.abs(Math.imul(c.seed ^ (i * 2654435761), 0x45d9f3b) >>> 7) % mod;
const initials = (name: string): string => name.split(/\s+/).map((w) => w[0] ?? "").join("").toUpperCase().slice(0, 3);
const first = (name: string): string => name.split(/\s+/)[0];
const weekday = (i: number): string => new Date(Date.UTC(2024, 0, 1 + i)).toLocaleDateString(LOCALE, { weekday: "short", timeZone: "UTC" });
const list = (key: string): string[] => t(key).split(",");
const BRANDS = ["Nordwerk", "Brightly", "Kesselhaus", "Bluefin", "Ostara", "Lumenko", "Fernweh", "Tidewell"];
const FIRST = ["Anna", "Ben", "Clara", "David", "Eva", "Felix", "Greta", "Hugo", "Ida", "Jonas"];
const LAST = ["Weber", "Novak", "Rossi", "Silva", "Martin", "Kowalski", "Berg", "Moreau"];
const person = (c: BlockCtx, i: number): string => `${FIRST[num(c, i, FIRST.length)]} ${LAST[num(c, i + 50, LAST.length)]}`;

const Section = ({ id, title, children }: { id: string; title?: string; children: ReactNode }) => (
  <section className={`cs-block cs-b-${id}`}>{title && <h2>{title}</h2>}{children}</section>
);

function Counter({ c }: { c: BlockCtx }) {
  const [n, setN] = useState(1000 + num(c, 1, 90000));
  useEffect(() => { const h = setInterval(() => setN((x) => x + 1), 4000); return () => clearInterval(h); }, []);
  return <Section id="counter"><p className="cs-counter">{t("site.block.counter.text", { n: String(n).padStart(6, "0") })}</p></Section>;
}

function Guestbook({ c }: { c: BlockCtx }) {
  const [entries, setEntries] = useState([{ who: person(c, 2), text: t("site.block.guestbook.entry") }]);
  const [draft, setDraft] = useState("");
  return (
    <Section id="guestbook" title={t("site.block.guestbook.title")}>
      <ul>{entries.map((e, i) => <li key={i}><b>{e.who}</b>: {e.text}</li>)}</ul>
      <form onSubmit={(e) => { e.preventDefault(); if (draft.trim()) setEntries([...entries, { who: t("site.block.guestbook.guest"), text: draft.trim() }]); setDraft(""); }}>
        <input value={draft} placeholder={t("site.block.guestbook.placeholder")} onChange={(e) => setDraft(e.target.value)} />
        <button>{t("site.block.guestbook.sign")}</button>
      </form>
    </Section>
  );
}

function Like({ c }: { c: BlockCtx }) {
  const [liked, setLiked] = useState(false);
  const n = 3 + num(c, 3, 400) + (liked ? 1 : 0);
  return (
    <Section id="like">
      <button aria-pressed={liked} onClick={() => setLiked(!liked)}>{t(liked ? "site.block.like.liked" : "site.block.like.like")}</button>
      <span>{t("site.block.like.count", { n })}</span>
    </Section>
  );
}

function Midi({ c }: { c: BlockCtx }) {
  const [on, setOn] = useState(true);
  const song = `${first(c.name).toLowerCase()}_theme.mid`;
  return (
    <Section id="midi">
      {on && <p>{t("site.block.midi.playing", { song })}</p>}
      <button onClick={() => setOn(!on)}>{t(on ? "site.block.midi.stop" : "site.block.midi.play")}</button>
    </Section>
  );
}

function Dismissable({ id, children }: { id: string; children: (close: () => void) => ReactNode }) {
  const [open, setOpen] = useState(true);
  return open ? <div className={`cs-block cs-overlay cs-b-${id}`}>{children(() => setOpen(false))}</div> : null;
}

function Newsletter() {
  const [done, setDone] = useState(false);
  return (
    <Section id="newsletter" title={t("site.block.newsletter.title")}>
      {done ? <p>{t("site.block.newsletter.done")}</p> : (
        <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <input type="email" placeholder={t("site.block.newsletter.email")} />
          <button>{t("site.block.newsletter.subscribe")}</button>
        </form>
      )}
    </Section>
  );
}

function Contact() {
  const [sent, setSent] = useState(false);
  return (
    <Section id="contactForm" title={t("site.block.contactForm.title")}>
      {sent ? <p>{t("site.block.contactForm.sent")}</p> : (
        <form onSubmit={(e) => { e.preventDefault(); setSent(true); }}>
          <input placeholder={t("site.block.contactForm.name")} />
          <input type="email" placeholder={t("site.block.contactForm.email")} />
          <textarea placeholder={t("site.block.contactForm.message")} />
          <button>{t("site.block.contactForm.send")}</button>
        </form>
      )}
    </Section>
  );
}

function Appointment() {
  const [done, setDone] = useState(false);
  return (
    <Section id="appointment" title={t("site.block.appointment.title")}>
      {done ? <p>{t("site.block.appointment.done")}</p> : (
        <form onSubmit={(e) => { e.preventDefault(); setDone(true); }}>
          <label>{t("site.block.appointment.date")} <input type="date" /></label>
          <button>{t("site.block.appointment.request")}</button>
        </form>
      )}
    </Section>
  );
}

const Hours = ({ id, c }: { id: string; c: BlockCtx }) => (
  <Section id={id} title={t(`site.block.${id}.title`)}>
    <table><tbody>{[0, 1, 2, 3, 4, 5, 6].map((d) => (
      <tr key={d}><th>{weekday(d)}</th><td>{d === 6 || (d === 5 && num(c, 4, 2)) ? t("site.block.hours.closed") : `${8 + num(c, 5, 3)}:00 - ${17 + num(c, 6, 3)}:00`}</td></tr>
    ))}</tbody></table>
  </Section>
);

const BLOCKS: Record<string, (c: BlockCtx) => ReactNode> = {
  about: (c) => <Section id="about" title={t("site.block.about.title")}><p>{t(c.blurb)}</p></Section>,
  photos: (c) => (
    <Section id="photos" title={t("site.block.photos.title")}>
      <div className="cs-grid">{[0, 1, 2, 3].map((i) => <figure key={i} style={{ "--ph": num(c, 10 + i, 360) } as CSSProperties}><figcaption>{t("site.block.photos.caption", { year: c.year - i })}</figcaption></figure>)}</div>
    </Section>
  ),
  guestbook: (c) => <Guestbook c={c} />,
  familyNews: (c) => <Section id="familyNews" title={t("site.block.familyNews.title")}><p>{t("site.block.familyNews.text", { n: 2 + num(c, 7, 12) })}</p></Section>,
  counter: (c) => <Counter c={c} />,
  marquee: (c) => <Section id="marquee"><p><span>{t("site.block.marquee.text", { name: c.name })}</span></p></Section>,
  construction: () => <Section id="construction"><p>{t("site.block.construction.text")}</p></Section>,
  webring: () => (
    <Section id="webring" title={t("site.block.webring.title")}>
      <p><a>&laquo; {t("site.block.webring.prev")}</a> | <a>{t("site.block.webring.random")}</a> | <a>{t("site.block.webring.next")} &raquo;</a></p>
    </Section>
  ),
  bestViewed: () => <Section id="bestViewed"><p>{t("site.block.bestViewed.text")}</p></Section>,
  midi: (c) => <Midi c={c} />,
  links: (c) => (
    <Section id="links" title={t("site.block.links.title")}>
      <ul>{[0, 1, 2].map((i) => <li key={i}><a>www.{BRANDS[num(c, 20 + i, BRANDS.length)].toLowerCase()}-{c.year - i}.com</a></li>)}</ul>
    </Section>
  ),
  widgets: (c) => (
    <Section id="widgets" title={t("site.block.widgets.title")}>
      <ul>{[0, 1, 2, 3].map((i) => <li key={i}><a>{new Date(Date.UTC(c.year, 11 - i * 2, 1)).toLocaleDateString(LOCALE, { month: "long", year: "numeric", timeZone: "UTC" })}</a> ({1 + num(c, 30 + i, 9)})</li>)}</ul>
    </Section>
  ),
  tagCloud: (c) => (
    <Section id="tagCloud" title={t("site.block.tagCloud.title")}>
      <p>{list("site.block.tagCloud.tags").map((tag, i) => <a key={tag} style={{ fontSize: `${10 + num(c, 40 + i, 12)}px` }}>{tag} </a>)}</p>
    </Section>
  ),
  like: (c) => <Like c={c} />,
  rss: () => <Section id="rss"><p><a>{t("site.block.rss.text")}</a></p></Section>,
  blogPosts: (c) => (
    <Section id="blogPosts" title={t("site.block.blogPosts.title")}>
      <article><h3>{t("site.block.blogPosts.post", { name: c.name })}</h3><time>{new Date(Date.UTC(c.year, num(c, 8, 12), 1 + num(c, 9, 28))).toLocaleDateString(LOCALE, { timeZone: "UTC" })}</time> <a>{t("site.block.blogPosts.more")}</a></article>
    </Section>
  ),
  flashIntro: (c) => <Section id="flashIntro"><p>{t("site.block.flashIntro.loading", { n: 40 + num(c, 11, 59) })}</p><button>{t("site.block.flashIntro.skip")}</button></Section>,
  hero: (c) => <Section id="hero"><h2>{c.name}</h2><button>{t("site.block.hero.cta")}</button></Section>,
  cookieBanner: () => <Dismissable id="cookieBanner">{(close) => <><span>{t("site.block.cookieBanner.text")}</span><button onClick={close}>{t("site.block.cookieBanner.ok")}</button></>}</Dismissable>,
  social: () => <Section id="social" title={t("site.block.social.title")}><p>{["Faceblock", "Twiddler", "Instaglam"].map((x) => <a key={x}>{x}</a>)}</p></Section>,
  newsletter: () => <Newsletter />,
  testimonials: (c) => (
    <Section id="testimonials" title={t("site.block.testimonials.title")}>
      <blockquote>{t("site.block.testimonials.quote")}<cite>{person(c, 12)}</cite></blockquote>
    </Section>
  ),
  team: (c) => (
    <Section id="team" title={t("site.block.team.title")}>
      <div className="cs-grid">{[0, 1, 2].map((i) => <figure key={i}><b>{i === 0 ? c.name : person(c, 13 + i)}</b><figcaption>{t(i === 0 ? "site.block.team.founder" : "site.block.team.staff")}</figcaption></figure>)}</div>
    </Section>
  ),
  darkToggle: (c) => (
    <Section id="darkToggle"><label><input type="checkbox" checked={c.dark} onChange={(e) => c.setDark(e.target.checked)} /> {t("site.block.darkToggle.label")}</label></Section>
  ),
  chatBubble: () => <Dismissable id="chatBubble">{(close) => <><span>{t("site.block.chatBubble.text")}</span><button onClick={close}>{t("site.block.chatBubble.open")}</button></>}</Dismissable>,
  cookieWall: (c) => (
    <Dismissable id="cookieWall">{(close) => (
      <div><h2>{t("site.block.cookieWall.title")}</h2><p>{t("site.block.cookieWall.text", { n: 100 + num(c, 14, 800) })}</p>
        <button onClick={close}>{t("site.block.cookieWall.accept")}</button> <button onClick={close}>{t("site.block.cookieWall.reject")}</button></div>
    )}</Dismissable>
  ),
  pricing: (c) => (
    <Section id="pricing" title={t("site.block.pricing.title")}>
      <div className="cs-grid">{["basic", "pro", "business"].map((p, i) => <figure key={p}><b>{t(`site.block.pricing.${p}`)}</b><figcaption>{t("site.block.pricing.month", { price: euro((i + 1) * (9 + num(c, 15, 20))) })}</figcaption></figure>)}</div>
    </Section>
  ),
  appBadges: () => <Section id="appBadges" title={t("site.block.appBadges.title")}><p><a>App Shop</a> <a>Ploy Store</a></p></Section>,
  roster: (c) => (
    <Section id="roster" title={t("site.block.roster.title")}>
      <ul>{[0, 1, 2, 3, 4].map((i) => <li key={i}>[{initials(c.name)}] {i === 0 ? first(c.name) : `${FIRST[num(c, 60 + i, FIRST.length)]}${num(c, 70 + i, 99)}`}</li>)}</ul>
    </Section>
  ),
  matches: (c) => (
    <Section id="matches" title={t("site.block.matches.title")}>
      <table><tbody>{[0, 1, 2].map((i) => { const a = num(c, 80 + i, 16), b = num(c, 90 + i, 16); return (
        <tr key={i}><td>[{initials(c.name)}] - [{initials(BRANDS[num(c, 100 + i, BRANDS.length)])}X]</td><td>{a}:{b}</td><td>{t(a >= b ? "site.block.matches.won" : "site.block.matches.lost")}</td></tr>
      ); })}</tbody></table>
    </Section>
  ),
  serverAddr: (c) => <Section id="serverAddr" title={t("site.block.serverAddr.title")}><p><code>{c.domain}:27015</code></p><p>{t("site.block.serverAddr.players", { n: num(c, 16, 17), max: 16 })}</p></Section>,
  teamspeak: (c) => <Section id="teamspeak" title={t("site.block.teamspeak.title")}><p><code>ts.{c.domain}</code> {t("site.block.teamspeak.online", { n: num(c, 17, 12) })}</p></Section>,
  projects: (c) => (
    <Section id="projects" title={t("site.block.projects.title")}>
      <ul>{[0, 1, 2].map((i) => <li key={i}><b>{first(c.name).toLowerCase()}-{["tools", "engine", "bot"][i]}</b> {t("site.block.projects.done", { n: 60 + num(c, 18 + i, 39) })}</li>)}</ul>
    </Section>
  ),
  badges: (c) => (
    <Section id="badges"><p>
      <span className="cs-badge"><i>{t("site.block.badges.build")}</i><b>{t("site.block.badges.passing")}</b></span>
      <span className="cs-badge"><i>{t("site.block.badges.version")}</i><b>v{num(c, 21, 4)}.{num(c, 22, 10)}</b></span>
    </p></Section>
  ),
  blog: (c) => <Section id="blog" title={t("site.block.blog.title")}><p>{t("site.block.blog.entry", { n: 10 + num(c, 23, 300) })}</p></Section>,
  services: () => <Section id="services" title={t("site.block.services.title")}><ul>{list("site.block.services.items").map((x) => <li key={x}>{x}</li>)}</ul></Section>,
  hours: (c) => <Hours id="hours" c={c} />,
  map: (c) => <Section id="map" title={t("site.block.map.title")}><div className="cs-map" style={{ "--px": `${20 + num(c, 24, 60)}%` } as CSSProperties} /><a>{t("site.block.map.route")}</a></Section>,
  contactForm: () => <Contact />,
  priceList: (c) => (
    <Section id="priceList" title={t("site.block.priceList.title")}>
      <table><tbody>{list("site.block.services.items").map((x, i) => <tr key={x}><td>{x}</td><td>{euro(30 + num(c, 25 + i, 120))}</td></tr>)}</tbody></table>
    </Section>
  ),
  caseStudies: (c) => (
    <Section id="caseStudies" title={t("site.block.caseStudies.title")}>
      <div className="cs-grid">{[0, 1].map((i) => <figure key={i}><figcaption>{t("site.block.caseStudies.item", { client: BRANDS[num(c, 26 + i, BRANDS.length)] })}</figcaption></figure>)}</div>
    </Section>
  ),
  clientLogos: (c) => <Section id="clientLogos" title={t("site.block.clientLogos.title")}><p>{[0, 1, 2, 3].map((i) => <b key={i}>{BRANDS[(num(c, 28, BRANDS.length) + i) % BRANDS.length]}</b>)}</p></Section>,
  letsTalk: () => <Section id="letsTalk" title={t("site.block.letsTalk.title")}><button>{t("site.block.letsTalk.cta")}</button></Section>,
  consultHours: (c) => <Hours id="consultHours" c={c} />,
  appointment: () => <Appointment />,
  privacy: () => <Section id="privacy" title={t("site.block.privacy.title")}><p>{t("site.block.privacy.text")}</p></Section>,
  productGrid: (c) => (
    <Section id="productGrid" title={t("site.block.productGrid.title")}>
      <div className="cs-grid">{[0, 1, 2].map((i) => <figure key={i} style={{ "--ph": num(c, 31 + i, 360) } as CSSProperties}>
        <b>{initials(c.name)} {BRANDS[num(c, 34 + i, BRANDS.length)]}</b><figcaption>{euro(10 + num(c, 37 + i, 190))}</figcaption>
        <button onClick={c.addToCart}>{t("site.block.productGrid.add")}</button>
      </figure>)}</div>
    </Section>
  ),
  cart: (c) => <Section id="cart"><p>{t("site.block.cart.label", { n: c.cart })}</p></Section>,
  checkout: () => <Section id="checkout"><p>{t("site.block.checkout.text", { price: euro(50) })}</p><button>{t("site.block.checkout.cta")}</button></Section>,
  sale: (c) => <Section id="sale"><p>{t("site.block.sale.text", { n: 10 + 5 * num(c, 40, 8) })}</p></Section>,
  press: (c) => <Section id="press" title={t("site.block.press.title")}><ul><li>{t("site.block.press.item", { name: c.name, year: c.year - 1 })}</li></ul></Section>,
  investors: (c) => <Section id="investors" title={t("site.block.investors.title")}><p>{t("site.block.investors.share")} <b>{euro(20 + num(c, 41, 180))}</b></p></Section>,
  careers: (c) => <Section id="careers" title={t("site.block.careers.title")}><p>{t("site.block.careers.open", { n: 2 + num(c, 42, 40) })}</p></Section>,
  handshake: () => <Section id="handshake"><figure><figcaption>{t("site.block.handshake.caption")}</figcaption></figure></Section>,
};

export const CustomerBlock = ({ id, c }: { id: string; c: BlockCtx }) => <>{BLOCKS[id]?.(c) ?? null}</>;
