import type { LedgerEntry } from "../sim/50-state";
import { ADVISORY_KEYS } from "../sim/60-infra/security";
import { dateOf, hourOf } from "../sim/00-core/time";

// Highest priority first: one batch of events plays only its top sound.
export const SOUNDS = ["month", "warn", "level", "research", "money", "ticket"] as const;
export type Sound = (typeof SOUNDS)[number];
export type UiSound = "open" | "close";

const BY_KEY: Record<string, Sound> = {
  "event.monthStart": "month",
  "event.orderPaid": "money", "event.salesWon": "money", "event.orderPlaced": "money",
  "event.trained": "level",
  "event.trainingDone": "research",
  ...Object.fromEntries([
    "event.componentFailed", "event.dataLoss", "event.ddos", "event.saturated", "event.failoverStuck", "event.backupFailed",
    "event.nodeFrozen", "event.cashNegative", "event.bankrupt", "event.loanMissed", "event.loanCalled", "event.techFailed",
    "event.orderFailed", "event.stepFailed", "event.salesFailed", "event.seized", "event.quit", "event.vuln.hacked", ...ADVISORY_KEYS,
  ].map((k) => [k, "warn"])),
};

// Support keeps its ticket ding for every event; other apps only sound on mapped events.
export const soundFor = (app: string, key: string): Sound | null => BY_KEY[key] ?? (app === "Support" ? "ticket" : null);

export const WINDOW_MS = 1500;

// The one sound a batch plays: the highest-priority kind that has not played within the window.
export function pickSound(kinds: Iterable<Sound>, now: number, last: Partial<Record<Sound, number>>): Sound | null {
  const set = new Set(kinds);
  return SOUNDS.find((k) => set.has(k) && now - (last[k] ?? -Infinity) >= WINDOW_MS) ?? null;
}

// Net ledger total of the month that ended at the month start hour `hour`; bills booked on the first count to the month they close.
export function monthNet(ledger: LedgerEntry[], hour: number): number {
  const d = dateOf(hour), from = hourOf(new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth() - 1, 1)));
  return ledger.reduce((sum, e) => (e.hour > from && e.hour <= hour ? sum + e.amount : sum), 0);
}

let ctx: AudioContext | null = null;

function audio(): AudioContext | null {
  try {
    ctx ??= new AudioContext();
    return ctx;
  } catch {
    return null; // No audio available, for example in tests.
  }
}

// Browsers keep audio suspended until a gesture.
if (typeof window !== "undefined") {
  const wake = () => void audio()?.resume().catch(() => {});
  window.addEventListener("pointerdown", wake, { once: true });
  window.addEventListener("keydown", wake, { once: true });
}

function tone(c: AudioContext, out: AudioNode, hz: number, at: number, dur: number, peak: number, type: OscillatorType = "sine") {
  const g = c.createGain(), o = c.createOscillator();
  o.type = type;
  o.frequency.value = hz;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.012);
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur);
  o.connect(g).connect(out);
  o.start(at);
  o.stop(at + dur + 0.02);
}

// A short band-passed noise burst, the drawer of a cash register.
function rattle(c: AudioContext, out: AudioNode, at: number, peak: number) {
  const len = Math.floor(c.sampleRate * 0.06), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  bp.type = "bandpass";
  bp.frequency.value = 3200;
  g.gain.value = peak;
  src.connect(bp).connect(g).connect(out);
  src.start(at);
}

export function playSound(kind: Sound | UiSound, volume: number, profit = false): void {
  const c = audio();
  if (!c || volume <= 0) return;
  try {
    const out = c.createGain(), t = c.currentTime + 0.01;
    out.gain.value = volume;
    out.connect(c.destination);
    switch (kind) {
      case "month":
        // C major arpeggio; a profitable month adds the register drawer and a top note.
        [523, 659, 784, 1047].forEach((hz, i) => tone(c, out, hz, t + i * 0.09, 0.9, profit ? 0.06 : 0.04));
        if (profit) {
          rattle(c, out, t, 0.05);
          tone(c, out, 1568, t + 0.4, 1.1, 0.035);
        }
        break;
      case "money":
        rattle(c, out, t, 0.03);
        tone(c, out, 1568, t + 0.03, 0.25, 0.04);
        tone(c, out, 2093, t + 0.09, 0.35, 0.035);
        break;
      case "ticket":
        tone(c, out, 880, t, 0.35, 0.05);
        tone(c, out, 1320, t + 0.07, 0.3, 0.05);
        break;
      case "warn":
        tone(c, out, 440, t, 0.22, 0.05, "triangle");
        tone(c, out, 349, t + 0.16, 0.32, 0.05, "triangle");
        break;
      case "level":
        [523, 784, 1047].forEach((hz, i) => tone(c, out, hz, t + i * 0.07, 0.3, 0.045, "triangle"));
        break;
      case "research":
        tone(c, out, 659, t, 0.8, 0.035);
        tone(c, out, 988, t + 0.05, 0.8, 0.035);
        tone(c, out, 1319, t + 0.12, 0.7, 0.025);
        break;
      case "open":
      case "close":
        tone(c, out, kind === "open" ? 1700 : 1200, t, 0.05, 0.012);
        break;
    }
  } catch {
    // A failed sound is not worth an error.
  }
}
