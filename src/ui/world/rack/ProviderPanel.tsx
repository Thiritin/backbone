// docs/design/gdd/connectivity.md: the provider's patch panel drawn large over the rack back, every jack labelled by role.
import { useEffect, useRef, type ReactNode } from "react";
import { t } from "../../../i18n/en";
import { euro } from "../../../sim/00-core/money";
import { yearOf } from "../../../sim/00-core/time";
import { carrierById, carriersAt, COMMITS, exchangeAt, exchangeById } from "../../../sim/10-catalog/network";
import { PANEL_JACKS, PROVIDER_CABLE, uplinkOffers, uplinkPrice } from "../../../sim/10-catalog/uplinks";
import { datacenterById } from "../../../sim/20-world/datacenters";
import type { Device, End, GameState } from "../../../sim/50-state";
import { freeJack, jackRoles, type JackRole } from "../../../sim/60-infra/panels";
import { cancelProviderCable } from "../../../sim/90-actions/connectivity";
import { orderExchangePort, orderTransit } from "../../../sim/90-actions/network";
import { formatDay } from "../../apps/billing/format";
import { cableOrder, reachable, roleName } from "../../apps/locations/ProviderJack";
import type { Purchase } from "../../apps/browser/sites/shared/PayStep";
import { speed } from "../../apps/locations/NetworkTab";
import type { MenuEntry } from "../../desktop/menu";
import { useStore } from "../../store";

const PITCH = 16, M = 8, W = PANEL_JACKS * PITCH + 2 * M, FACE = 30, PLATE = 78, DUE = 50;
// The longest label a plate holds.
const CHARS = 13;

export interface Jack { role: JackRole; label: string; due?: number; order?: string }

const partner = (id: string) => carrierById(id)?.name ?? exchangeById(id)?.name ?? id;

// What each provider-side jack carries, as written on its label: the line's speed, the cross-connect's party, the other rack of a provider cable.
export function jacksOf(game: GameState, panel: Device): Jack[] {
  const at = (e: End | undefined, i: number) => e?.device === panel.id && e.port === i;
  const rackName = (e: End) => game.racks.find((r) => r.id === game.devices.find((d) => d.id === e.device)?.rackId)?.name ?? "";
  return jackRoles(game, panel.id).map((role, i) => {
    const hx = game.properties.flatMap((p) => p.hall?.xconnects.map((x) => ({ x, hall: p.hall! })) ?? []).find((h) => at(h.x.jack, i));
    if (hx) return { role, label: `${hx.hall.customers.find((c) => c.id === hx.x.customerId)?.name ?? ""} · ${partner(hx.x.carrierId)}` };
    const line = game.network.uplinks.flatMap((u) => u.links.map((l) => ({ u, l }))).find((x) => at(x.l.jack, i));
    if (line) return { role, label: `${speed(line.l.gbit)} ${partner(line.u.partner)}` };
    const xc = game.crossConnects.find((x) => at(x.jack, i));
    if (xc) return { role, label: partner(xc.to) };
    const o = game.providerCables.find((x) => at(x.a, i) || at(x.b, i));
    if (o) return { role, label: rackName(at(o.a, i) ? o.b : o.a), due: o.dueAt, order: o.id };
    const c = game.cables.find((x) => x.kind === "provider" && (at(x.a, i) || at(x.b, i)));
    if (c) return { role, label: rackName(at(c.a, i) ? c.b : c.a) };
    return { role, label: roleName(role) };
  });
}

const roleLabel = (r: JackRole) => (r === "customer" ? t("hall.jack.customer") : roleName(r));
export const jackText = (j: Jack) => (j.role === "free" ? j.label : `${roleLabel(j.role)} ${j.label}`);
export const jackTitle = (i: number, j: Jack) => `${t("locations-1.carrierPanel")} ${i + 1}: ${jackText(j)}`;

// The top unit's provider side, 24 duplex jacks above their label strips; a queued cable order hangs its due tag under the strip.
// A click picks a jack; a drag from one ends wherever the pointer lets go on another port or jack.
export function ProviderPanel({ game, panel, picked = null, hand = null, onJack, onConnect }: {
  game: GameState; panel: Device; picked?: number | null; hand?: End | null; onJack: (e: End) => void; onConnect?: (a: End, b: End) => void;
}) {
  const jacks = jacksOf(game, panel);
  const drag = useRef<End | null>(null);
  const live = useRef(onConnect);
  live.current = onConnect;
  useEffect(() => {
    const up = (e: PointerEvent) => {
      const d = drag.current;
      drag.current = null;
      const to = d && document.elementFromPoint(e.clientX, e.clientY)?.closest("[data-end]")?.getAttribute("data-end");
      if (d && to && to !== `${d.device}:${d.port}`) { const [device, port] = to.split(":"); live.current?.(d, { device, port: Number(port) }); }
    };
    window.addEventListener("pointerup", up);
    return () => window.removeEventListener("pointerup", up);
  }, []);
  const out: ReactNode[] = [];
  jacks.forEach((j, i) => {
    const x = M + i * PITCH, end = { device: panel.id, port: i }, on = picked === i || (hand?.device === panel.id && hand.port === i);
    const text = j.label.length > CHARS ? `${j.label.slice(0, CHARS - 1)}…` : j.label;
    out.push(
      <g key={i} className={`pp-jack ${j.role}${on ? " on" : ""}`} data-end={`${panel.id}:${i}`} data-jack={i} role="button" aria-label={jackTitle(i, j)}
        onPointerDown={(e) => { if (!e.button) drag.current = end; }}
        onClick={(e) => { e.stopPropagation(); onJack(end); }}>
        <title>{jackTitle(i, j)}</title>
        <rect className="pp-hit" x={x} y={0} width={PITCH} height={FACE + PLATE + (j.due !== undefined ? DUE : 0)} />
        <text className="pp-no" x={x + PITCH / 2} y={8}>{i + 1}</text>
        <rect className="pp-sock" x={x + 2} y={11} width={PITCH - 4} height={14} />
        <rect className="pp-lc" x={x + 4} y={14} width={3.5} height={8} />
        <rect className="pp-lc" x={x + PITCH - 7.5} y={14} width={3.5} height={8} />
        {j.role !== "free" && j.due === undefined && <rect className="pp-plug" x={x + 3} y={24} width={PITCH - 6} height={6} />}
        <rect className="pp-plate" x={x + 1.5} y={FACE + 2} width={PITCH - 3} height={PLATE - 4} />
        <text className="pp-label" transform={`translate(${x + PITCH / 2 + 3.5} ${FACE + PLATE - 6}) rotate(-90)`}>{text}</text>
        {j.due !== undefined && (
          <g className="pp-due">
            <line x1={x + PITCH / 2} y1={FACE + PLATE - 2} x2={x + PITCH / 2} y2={FACE + PLATE + 6} />
            <rect x={x + 1} y={FACE + PLATE + 6} width={PITCH - 2} height={DUE - 8} />
            <text transform={`translate(${x + PITCH / 2 + 3} ${FACE + PLATE + DUE - 6}) rotate(-90)`}>{formatDay(j.due).replace(/\s*\d{4}$/, "")}</text>
          </g>
        )}
      </g>,
    );
  });
  return (
    <svg className="wr-pp" data-pp={panel.id} viewBox={`0 0 ${W} ${FACE + PLATE + DUE}`} aria-label={panel.name}>
      <rect className="pp-face" x={0} y={2} width={W} height={FACE - 2} />
      <rect className="pp-ear" x={0} y={2} width={M - 3} height={FACE - 2} />
      <rect className="pp-ear" x={W - M + 3} y={2} width={M - 3} height={FACE - 2} />
      {out}
    </svg>
  );
}

// The lines on a provider jack's tag: book an uplink or order a provider cable from a free jack, or cancel a queued order.
// A cable goes to onCable, which asks for the payment method.
export function jackEntries(game: GameState, panel: Device, i: number, onCable: (buy: Purchase & { key: string }) => void): MenuEntry[] {
  const act = useStore.getState().act, j = jacksOf(game, panel)[i], rack = panel.rackId!;
  if (j.order) return [{ label: t("locations-2.cancel"), run: () => act(cancelProviderCable, j.order!) }];
  if (j.role !== "free") return [];
  const loc = game.locations.find((l) => l.id === game.racks.find((r) => r.id === rack)?.locationId);
  const dc = loc?.dc ? datacenterById(loc.dc) : undefined, year = yearOf(game.hour);
  const price = (g: number) => `${speed(g)} · ${t("locations-2.perMonth", { amount: euro(uplinkPrice(g, year)) })}`;
  const x = dc && exchangeAt(dc);
  const lines: MenuEntry[] = dc && game.unlocks.includes("network") ? [
    ...carriersAt(dc).map((c) => ({ label: c.name, items: uplinkOffers(year).map((g) => ({ label: price(g), run: () => act(orderTransit, rack, c.id, g, COMMITS[0].share, i) })) })),
    x && game.network.memberships.includes(x.id) && { label: x.name, items: uplinkOffers(year).map((g) => ({ label: price(g), run: () => act(orderExchangePort, rack, g, i) })) },
  ] : [];
  const cable = t("locations-1.orderProviderCable", { fee: euro(PROVIDER_CABLE.fee), days: PROVIDER_CABLE.leadHours / 24 });
  const to = reachable(game, rack).map((r) => ({ r, jack: freeJack(game, r.id) })).filter((x) => x.jack);
  return [
    lines.length > 0 && { label: t("world.bookUplink"), items: lines },
    to.length > 0 && { label: roleName("provider-cable"), items: to.map(({ r, jack }) => ({ label: `${r.name} ${jack!.port + 1} · ${cable}`, run: () => onCable(cableOrder(game, rack, i, r.id, jack!.port)) })) },
  ];
}

