import { useState, type ReactNode } from "react";
import { euroPrice } from "../../../../../sim/00-core/money";
import { SOFTWARE, type Software } from "../../../../../sim/10-catalog/platforms";
import { licensingAt, SERVER_OS, serverOsAt, serverOsById, type LicenseEra, type LicenseKind, type ServerOs, type ServerOsId } from "../../../../../sim/10-catalog/server-os";
import { yearOf } from "../../../../../sim/00-core/time";
import { useStore } from "../../../../store";
import { downloadMbps } from "../../../../../sim/90-actions/media";
import { startDownload, useProgress } from "../../../../downloads";
import type { Look, Site } from "../../../../../sim/10-catalog/sites";
import "./software.css";

// docs/design/software.md, 8.3: the pieces every software and OS site lays out in its own look.
export type SitePage = "home" | "features" | "pricing" | "download";
export interface Product { id: string; name: string; site: Site; sw?: Software; os?: ServerOs }
export interface SiteProps { p: Product; look: Look; page: SitePage; year: number; go: (path: string) => void }

export const productOf = (kind: "software" | "os", id: string): Product | null => {
  const sw = kind === "software" ? SOFTWARE.find((x) => x.id === id) : undefined, os = kind === "os" ? SERVER_OS.find((x) => x.id === id) : undefined;
  const x = sw ?? os;
  return x ? { id: x.id, name: x.name, site: x.site, sw, os } : null;
};

const PAGES: SitePage[] = ["home", "features", "pricing", "download"];
export const pageOf = (path: string): SitePage => PAGES.find((x) => x === path.split(/[/?#]/)[1]) ?? "home";
const pathOf = (page: SitePage) => (page === "home" ? "/" : `/${page}`);
const gui = (p: Product) => p.sw?.install.kind === "gui";

export function Nav({ p, page, go, className, labels }: Pick<SiteProps, "p" | "page" | "go"> & { className?: string; labels?: Partial<Record<SitePage, string>> }) {
  const name: Record<SitePage, string> = { home: "Home", features: "Features", pricing: "Pricing", download: gui(p) ? "Install" : "Download", ...labels };
  return (
    <nav className={className}>
      {PAGES.map((x) => (
        <a key={x} href={`#${x}`} aria-current={x === page ? "page" : undefined} onClick={(e) => { e.preventDefault(); go(pathOf(x)); }}>{name[x]}</a>
      ))}
    </nav>
  );
}

export const Link = ({ to, go, className, children }: { to: SitePage; go: SiteProps["go"]; className?: string; children: ReactNode }) => (
  <a href={`#${to}`} className={className} onClick={(e) => { e.preventDefault(); go(pathOf(to)); }}>{children}</a>
);

export const Features = ({ p, className }: { p: Product; className?: string }) => (
  <ul className={className}>{p.site.features.map((f) => <li key={f}>{f}</li>)}</ul>
);

const UNIT: Record<LicenseKind, string> = { free: "", once: "per CPU socket, paid once", account: "per web space a month", server: "per server a month", core: "per physical core a month" };
const OS_UNIT: Record<LicenseKind, string> = { ...UNIT, once: "per machine, paid once", core: "per core or vCPU a month" };
const price = (era: LicenseEra, unit: Record<LicenseKind, string>) => (era.kind === "free" ? "Free" : `${euroPrice(era.fee)} ${unit[era.kind]}`);

// The license of the game year as the catalog has it, and the Windoors license where the software runs on nothing else.
export function Pricing({ p, className }: { p: Product; className?: string }) {
  const year = useStore((s) => yearOf(s.game.hour));
  const windoorsFee = () => price(licensingAt(serverOsById("windoors"), year), OS_UNIT);
  const rows: [string, string][] = p.os ? [[p.os.name, price(licensingAt(p.os, year), OS_UNIT)]] : [[p.name, price(licensingAt(p.sw!, year), UNIT)]];
  const windoors = p.sw && p.sw.os.length === 1 && p.sw.os[0] === "windoors";
  return (
    <div className={className}>
      <table>
        <thead><tr><th>Edition</th><th>License</th></tr></thead>
        <tbody>{rows.map(([a, b]) => <tr key={a}><td>{a}</td><td className="num">{b}</td></tr>)}</tbody>
      </table>
      {windoors && <p className="sws-note">{p.name} runs on Windoors Server, which costs {windoorsFee()} on top.</p>}
    </div>
  );
}

const IMAGE: Record<ServerOsId, (version: string) => string> = { lunix: (v) => `Debiant ${v} netinst`, windoors: (v) => `Windoors Server ${v}` };
export const isoFile = (id: ServerOsId, year: number) => `${IMAGE[id](serverOsAt(id, year).version).toLowerCase().replaceAll(" ", "-")}.iso`;

function IsoButton({ id, has }: { id: ServerOsId; has: boolean }) {
  const p = useProgress(id), online = useStore((s) => downloadMbps(s.game) > 0);
  const label = has ? "Downloaded" : p !== null ? `Downloading ${Math.floor(p * 100)}%` : online ? "Download ISO" : "No internet connection";
  return <button type="button" className="sws-iso" disabled={has || p !== null || !online} onClick={() => startDownload(id)}>{label}</button>;
}

// The install commands with a Copy button for the real clipboard; GUI software and operating systems say where they install from.
export function Commands({ p, year, className }: { p: Product; year: number; className?: string }) {
  const [copied, setCopied] = useState(false);
  const media = useStore((s) => s.game.media);
  if (p.os) {
    const id = p.os.id, out = p.os.versions.filter((v) => v.from <= year).reverse(), has = media.images.includes(id);
    return (
      <div className={className}>
        <p>Download the ISO and write it to the USB stick in Finder to boot a server from it, or mount it in a virtual machine, to install {IMAGE[id](serverOsAt(id, year).version)}.</p>
        <table>
          <thead><tr><th>Release</th><th>Since</th><th /></tr></thead>
          <tbody>{out.map((v) => (
            <tr key={v.version}>
              <td>{p.os!.name} {v.version}{v.name && ` ${v.name}`}</td><td className="num">{v.from}</td>
              <td><IsoButton id={id} has={has} /></td>
            </tr>
          ))}</tbody>
        </table>
        {id === "lunix" && <p>The default user name after installation is <code>root</code>.</p>}
      </div>
    );
  }
  if (gui(p)) return <div className={className}><p>{p.name} installs from the Windoors Server desktop.</p></div>;
  const text = p.sw!.install.commands.join("\n");
  // The clipboard API needs a secure page and permission; a selected textarea copies where it is refused.
  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const area = document.createElement("textarea");
      area.value = text;
      document.body.append(area);
      area.select();
      const ok = document.execCommand("copy");
      area.remove();
      if (!ok) return;
    }
    setCopied(true);
  };
  return (
    <div className={className}>
      <div className="sws-cmd">
        <pre>{text}</pre>
        <button type="button" onClick={copy}>{copied ? "Copied" : "Copy"}</button>
      </div>
    </div>
  );
}

// The page body below a site's own header and hero.
export function Body({ p, page, year, go, className }: SiteProps & { className?: string }) {
  if (page === "features") return <section className={className}><h2>Features</h2><Features p={p} /></section>;
  if (page === "pricing") return <section className={className}><h2>Pricing</h2><Pricing p={p} /></section>;
  if (page === "download") return <section className={className}><h2>{gui(p) ? "Install" : "Download"}</h2><Commands p={p} year={year} /></section>;
  return (
    <section className={className}>
      <p>{p.site.blurb}</p>
      <Features p={p} />
      <Link to="download" go={go} className="sws-cta">{gui(p) ? "Install" : "Download"}</Link>
    </section>
  );
}

// A site without a design of its own yet.
export function PlainSite(props: SiteProps) {
  return (
    <div className="sws-plain">
      <header><strong>{props.p.name}</strong><Nav {...props} /></header>
      <h1>{props.p.site.tagline}</h1>
      <Body {...props} />
    </div>
  );
}

export type SiteComponent = (props: SiteProps) => ReactNode;
