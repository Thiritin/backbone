import { Bot, GitPullRequest } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import type { CSSProperties, KeyboardEvent, ReactNode } from "react";
import { createPortal } from "react-dom";
import { MODELS, modelById, PATCH_BRAND, SERVER_BRANDS, SWITCH_BRAND, type DeviceModel } from "../../sim/10-catalog/hardware";
import { APPS } from "../apps/registry";
import { DeviceSvg, type Lamp, type PortLamp } from "../art/fronts";
import { Logo } from "../art/logos";
import { PAGES, type Block, type Inline } from "./intro-text";
import "./intro.css";

const PATCH = MODELS.find((m) => m.kind === "patch")!;
const SERVER = MODELS.find((m) => m.kind === "server" && m.height === 1)!;
const SWITCH = modelById("sw-24");

const lit = (m: DeviceModel, n: number) => m.ports.map((_, i): PortLamp => (i < n ? "ok" : "off"));

function Device({ model, brand, name, state = "ok", n = 3 }: { model: DeviceModel; brand: string; name: string; state?: Lamp; n?: number }) {
  return <DeviceSvg model={model} brand={brand} name={name} state={state} ports={lit(model, n)} w={200} u={14} />;
}

function Rack() {
  return (
    <div className="intro-rack">
      <Device model={PATCH} brand={PATCH_BRAND} name="" n={4} />
      <Device model={SWITCH} brand={SWITCH_BRAND} name="sw1" n={4} />
      <Device model={SERVER} brand={SERVER_BRANDS[0]} name="web1" />
      <Device model={SERVER} brand={SERVER_BRANDS[1]} name="db1" />
    </div>
  );
}

// An original pear silhouette: rounded body, upright stem and one detached leaf.
function PearMark() {
  return (
    <svg className="intro-pear" viewBox="0 0 64 64" width="72" height="72">
      <path d="M32 16c-5.5 0-7.5 4.5-7.5 10 0 4.5-3 7.5-6 11-3.5 4-4.5 8.5-3.5 13 1.8 7 8.5 10 17 10s15.2-3 17-10c1-4.5 0-9-3.5-13-3-3.5-6-6.5-6-11 0-5.5-2-10-7.5-10z" fill="currentColor" />
      <path d="M32 16c0-4 .8-7 2.6-10" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" />
      <path d="M37.5 9.5c2.5-4.5 7.5-6 12-4.5-2 4.5-7 6.5-12 4.5z" fill="currentColor" />
    </svg>
  );
}

const ART: Record<string, ReactNode> = {
  Welcome: <><span className="intro-house"><Logo provider={null} size={56} /></span><Rack /></>,
  "Pear One": <PearMark />,
  "Automate, then regret it": <><Bot className="intro-glyph" /><div className="intro-rack"><Device model={SERVER} brand={SERVER_BRANDS[2]} name="cust7" state="bad" n={0} /></div></>,
  "Open source": <><GitPullRequest className="intro-glyph" /><Bot className="intro-glyph" /></>,
};

const text = (parts: Inline[]) => parts.map((p, i) => (p.href ? <a key={i} href={p.href} target="_blank" rel="noreferrer">{p.text}</a> : p.style === "b" ? <strong key={i}>{p.text}</strong> : p.style === "s" ? <s key={i}>{p.text}</s> : p.text));

function BlockView({ b }: { b: Block }) {
  if (b.kind === "p") return <p className={b.fine ? "intro-fine" : undefined}>{text(b.text)}</p>;
  if (b.kind === "table") {
    return <dl className="intro-glossary">{b.rows.map(([t, d], i) => <div key={i}><dt>{text(t)}</dt><dd>{text(d)}</dd></div>)}</dl>;
  }
  return (
    <ul className="intro-apps">
      {APPS.filter((a) => !a.hidden).map((a) => (
        <li key={a.name}>
          <span className="dock-tile intro-tile" style={{ "--tile": a.tile } as CSSProperties}><a.icon /></span>
          <span><strong>{a.name}</strong>{a.about}</span>
        </li>
      ))}
    </ul>
  );
}

const FOCUSABLE = "button:not(:disabled), [href], [tabindex]:not([tabindex='-1'])";

export function Intro({ onClose }: { onClose: () => void }) {
  const [n, setN] = useState(0);
  const [dir, setDir] = useState("fwd");
  const sheet = useRef<HTMLDivElement>(null);
  const next = useRef<HTMLButtonElement>(null);
  // A menu item unmounts as its menu closes, so focus returns to the menu's trigger instead.
  const [opener] = useState(() => {
    const a = document.activeElement as HTMLElement | null;
    return a?.closest(".mb-menu")?.querySelector<HTMLElement>(".mb-item") ?? a;
  });
  const last = PAGES.length - 1;
  const page = PAGES[n];

  useEffect(() => {
    next.current?.focus();
    const guard = (e: FocusEvent) => { if (!sheet.current?.contains(e.target as Node)) next.current?.focus(); };
    document.addEventListener("focusin", guard);
    return () => { document.removeEventListener("focusin", guard); opener?.focus(); };
  }, [opener]);

  useEffect(() => {
    const a = document.activeElement;
    if (!a || a === document.body || a.matches(":disabled")) next.current?.focus();
  }, [n]);

  const go = (to: number) => {
    if (to < 0 || to > last) return;
    setDir(to < n ? "back" : "fwd");
    setN(to);
  };

  // Handled here and stopped, so the desktop's own shortcuts (Space pauses) never see these keys.
  const key = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Escape") onClose();
    else if (e.key === "ArrowRight") go(n + 1);
    else if (e.key === "ArrowLeft") go(n - 1);
    else if (e.key === "Tab") {
      const els = [...sheet.current!.querySelectorAll<HTMLElement>(FOCUSABLE)];
      const at = els.indexOf(document.activeElement as HTMLElement);
      if (e.shiftKey ? at <= 0 : at === els.length - 1) {
        e.preventDefault();
        els[e.shiftKey ? els.length - 1 : 0].focus();
      }
    }
  };

  return createPortal(
    <div className="intro-backdrop" onPointerDown={(e) => e.stopPropagation()} onMouseDown={(e) => e.target === e.currentTarget && e.preventDefault()} onKeyDown={key}>
      <div ref={sheet} className="intro" tabIndex={-1} role="dialog" aria-modal="true" aria-labelledby="intro-title">
        <div key={n} className={`intro-page ${dir}`}>
          {ART[page.title] && <div className="intro-art" aria-hidden="true">{ART[page.title]}</div>}
          <h2 id="intro-title">{page.title}</h2>
          <div className="intro-body">{page.blocks.map((b, i) => <BlockView key={i} b={b} />)}</div>
        </div>
        <footer className="intro-foot">
          <button className="btn ghost" onClick={onClose}>Close</button>
          <div className="intro-dots">
            {PAGES.map((p, i) => (
              <button key={i} aria-label={p.title} aria-current={i === n ? "step" : undefined} onClick={() => go(i)} />
            ))}
          </div>
          <div className="intro-nav">
            <button className="btn" disabled={n === 0} onClick={() => go(n - 1)}>Back</button>
            <button ref={next} className="btn primary" onClick={() => (n === last ? onClose() : go(n + 1))}>{n === last ? "Done" : "Next"}</button>
          </div>
        </footer>
      </div>
    </div>,
    document.querySelector(".desktop")!,
  );
}
