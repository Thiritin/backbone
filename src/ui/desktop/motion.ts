export const reduced = () => matchMedia("(prefers-reduced-motion: reduce)").matches;
const slots = new Map<string, DOMRect>();
const EASE_OUT = "cubic-bezier(0.2, 0.8, 0.2, 1)";

function run(el: Element, frames: Keyframe[], opts: KeyframeAnimationOptions): Promise<void> {
  if (reduced()) return Promise.resolve();
  return el.animate(frames, opts).finished.then(() => undefined, () => undefined);
}

// Dock slots vanish on restore, so their position is kept from the last time they were on screen.
export function rememberSlot(id: string) {
  const r = document.querySelector(`[data-min="${id}"]`)?.getBoundingClientRect();
  if (r) slots.set(id, r);
}

function slotOf(id: string): DOMRect {
  const known = slots.get(id);
  if (known) return known;
  const d = document.querySelector(".dock")!.getBoundingClientRect();
  return new DOMRect(d.right - 56, d.top + 6, 46, 46);
}

export const animateOpen = (el: Element) =>
  run(el, [{ opacity: 0, transform: "scale(0.94)" }, { opacity: 1, transform: "none" }], { duration: 180, easing: EASE_OUT });

export const animateClose = (el: Element) =>
  run(el, [{ opacity: 1, transform: "none" }, { opacity: 0, transform: "scale(0.94)" }], { duration: 140, easing: "ease-in", fill: "forwards" });

export function flip(el: Element, from: DOMRect) {
  const to = el.getBoundingClientRect();
  const start = `translate(${from.left - to.left}px, ${from.top - to.top}px) scale(${from.width / to.width}, ${from.height / to.height})`;
  run(el, [{ transformOrigin: "0 0", transform: start }, { transformOrigin: "0 0", transform: "none" }], { duration: 260, easing: EASE_OUT });
}

// Both sides follow a smoothstep from the top corners to [l, r] at the bottom, so every shape has the same point count.
function funnel(l: number, r: number): string {
  const steps = Array.from({ length: 11 }, (_, i) => i / 10);
  const ease = (t: number) => t * t * (3 - 2 * t);
  const left = steps.map((t) => `${l * ease(t)}% ${t * 100}%`);
  const right = steps.map((t) => `${100 + (r - 100) * ease(t)}% ${t * 100}%`).reverse();
  return `polygon(${[...left, ...right].join(", ")})`;
}

// Approximates the macOS genie: the bottom edge funnels toward the dock slot, then the window drains into it.
export function genie(el: HTMLElement, id: string, restore: boolean): Promise<void> {
  if (!restore) rememberSlot(id);
  const t = slotOf(id);
  const r = el.getBoundingClientRect();
  const half = Math.min(50, (t.width / r.width) * 50);
  const mid = Math.min(100 - half, Math.max(half, ((t.left + t.width / 2 - r.left) / r.width) * 100));
  const box = funnel(0, 100), tip = funnel(mid - half, mid + half);
  const lean = `translate(${(t.left + t.width / 2 - (r.left + r.width / 2)) * 0.15}px, ${(t.top - r.bottom) * 0.1}px)`;
  const end = `translate(${t.left - r.left}px, ${t.top - r.top}px) scale(${t.width / r.width}, ${t.height / r.height})`;
  const o = "0 0";
  const frames: Keyframe[] = [
    { offset: 0, clipPath: box, transform: "none", opacity: 1, transformOrigin: o },
    { offset: 0.4, clipPath: tip, transform: lean, opacity: 1, transformOrigin: o },
    { offset: 0.85, clipPath: tip, transform: end, opacity: 1, transformOrigin: o },
    { offset: 1, clipPath: tip, transform: end, opacity: 0, transformOrigin: o },
  ];
  const ordered = restore ? frames.map((f) => ({ ...f, offset: 1 - (f.offset as number) })).reverse() : frames;
  return run(el, ordered, { duration: 520, easing: restore ? "ease-out" : "ease-in" });
}

export const bounce = (el: Element) =>
  run(el, [{ transform: "none" }, { transform: "translateY(-18px)", offset: 0.3 }, { transform: "none", offset: 0.6 }, { transform: "translateY(-8px)", offset: 0.8 }, { transform: "none" }], { duration: 700, easing: "ease-in-out" });
