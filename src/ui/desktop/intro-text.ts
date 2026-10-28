import md from "../../../docs/design/intro.md?raw";

export type Inline = { text: string; style?: "b" | "s" };
export type Block =
  | { kind: "p"; fine: boolean; text: Inline[] }
  | { kind: "apps" }
  | { kind: "table"; rows: [Inline[], Inline[]][] };
export interface Page { title: string; blocks: Block[] }

// Handles **bold**, ~~strike~~ and the \* escape; nothing else in the doc needs markup.
export function inline(src: string): Inline[] {
  const out: Inline[] = [];
  let at = 0;
  for (const m of src.matchAll(/\*\*(.+?)\*\*|~~(.+?)~~|\\\*/g)) {
    if (m.index > at) out.push({ text: src.slice(at, m.index) });
    out.push(m[1] ? { text: m[1], style: "b" } : m[2] ? { text: m[2], style: "s" } : { text: "*" });
    at = m.index + m[0].length;
  }
  if (at < src.length) out.push({ text: src.slice(at) });
  return out;
}

const cells = (line: string) => line.split("|").slice(1, -1).map((c) => inline(c.trim()));

// Each ## section is a page; text before the first one describes the doc itself and is skipped.
export function parseIntro(src: string): Page[] {
  return src.split(/^## /m).slice(1).map((sec) => {
    const [title, ...rest] = sec.split("\n");
    const blocks = rest.join("\n").trim().split(/\n\s*\n/).map((b): Block => {
      if (b.trim() === "{apps}") return { kind: "apps" };
      if (b.startsWith("|")) {
        // Drops the header row and the --- separator.
        const rows = b.split("\n").slice(2).map(cells);
        return { kind: "table", rows: rows.map((r) => [r[0] ?? [], r[1] ?? []]) };
      }
      return { kind: "p", fine: b.startsWith("\\*"), text: inline(b.replace(/\n/g, " ")) };
    });
    return { title: title.trim(), blocks };
  });
}

export const PAGES = parseIntro(md);
