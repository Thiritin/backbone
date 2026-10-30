import type { GameState, LedgerEntry } from "../sim/50-state";
import { FAN_RPM, sensorsOf } from "../sim/60-infra/sensors";
import { locationOf, powered } from "../sim/60-infra/status";
import { ADVISORY_KEYS } from "../sim/60-infra/security";
import { dateOf, hourOf } from "../sim/00-core/time";

// Highest priority first: one batch of events plays only its top sound.
export const SOUNDS = ["month", "warn", "level", "research", "money", "ticket"] as const;
export type Sound = (typeof SOUNDS)[number];
export type UiSound = "open" | "close" | "key" | "thump";

const BY_KEY: Record<string, Sound> = {
  "event.monthStart": "month",
  "event.orderPaid": "money", "event.salesWon": "money", "event.orderPlaced": "money",
  "event.trained": "level",
  "event.trainingDone": "research",
  ...Object.fromEntries([
    "event.componentFailed", "event.dataLoss", "event.dataCorrupted", "event.serverHung", "event.ddos", "event.saturated", "event.failoverStuck", "event.backupFailed",
    "event.nodeFrozen", "event.cashNegative", "event.bankrupt", "event.loanMissed", "event.loanCalled", "event.techFailed",
    "event.orderFailed", "event.stepFailed", "event.salesFailed", "event.seized", "event.quit", "event.vuln.hacked", "event.siteHacked", "event.siteLeft", ...ADVISORY_KEYS,
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

// A short band-passed noise burst: the drawer of a cash register, or at a short length and other pitch a key press.
function rattle(c: AudioContext, out: AudioNode, at: number, peak: number, hz = 3200, secs = 0.06) {
  const len = Math.floor(c.sampleRate * secs), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / len);
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  bp.type = "bandpass";
  bp.frequency.value = hz;
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
      case "key":
        rattle(c, out, t, 0.05, 1800 + Math.random() * 1400, 0.018);
        break;
      case "thump": {
        // A fist on the desk: a falling low tone under a dull knock.
        const g = c.createGain(), o = c.createOscillator();
        o.frequency.setValueAtTime(110, t);
        o.frequency.exponentialRampToValueAtTime(45, t + 0.18);
        g.gain.setValueAtTime(0.5, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.3);
        o.connect(g).connect(out);
        o.start(t);
        o.stop(t + 0.32);
        rattle(c, out, t, 0.25, 220, 0.08);
        break;
      }
    }
  } catch {
    // A failed sound is not worth an error.
  }
}

// The fan noise of powered devices in the given racks: level grows with their count, pitch with fan speed and inlet heat.
export interface Hum { level: number; pitch: number; hall: boolean }

export function humOf(s: GameState, rackIds: string[]): Hum {
  const on = s.devices.filter((d) => d.on && d.rackId !== null && rackIds.includes(d.rackId) && powered(s, d.id));
  if (!on.length) return { level: 0, pitch: 1, hall: false };
  const sensors = on.map((d) => sensorsOf(s, d));
  const rpm = Math.max(FAN_RPM, ...sensors.flatMap((x) => x.fans.map((f) => f.rpm)));
  const warm = Math.min(1, Math.max(0, (Math.max(...sensors.map((x) => x.inletC)) - 22) / 10));
  return { level: Math.min(1, 0.3 + 0.1 * on.length), pitch: Math.round((rpm / FAN_RPM) * (1 + 0.15 * warm) * 100) / 100, hall: !!locationOf(s, on[0])?.dc };
}

const HUM_PEAK = 0.25, BLADES = [150, 151.3, 300];
let hum: { gain: GainNode; muffle: BiquadFilterNode; band: BiquadFilterNode; tones: OscillatorNode[] } | null = null;

// Built on first use and left running; at level 0 it costs a few idle nodes.
function startHum(c: AudioContext) {
  const len = c.sampleRate * 2, buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  const noise = c.createBufferSource(), band = c.createBiquadFilter(), muffle = c.createBiquadFilter(), gain = c.createGain();
  noise.buffer = buf;
  noise.loop = true;
  band.type = "bandpass";
  band.Q.value = 0.6;
  muffle.type = "lowpass";
  gain.gain.value = 0;
  noise.connect(band).connect(muffle);
  const tones = BLADES.map((hz, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = hz;
    g.gain.value = i === 2 ? 0.015 : 0.03;
    o.connect(g).connect(muffle);
    o.start();
    return o;
  });
  muffle.connect(gain).connect(c.destination);
  noise.start();
  return { gain, muffle, band, tones };
}

// Glides the fan bed toward a level (0 fades it out), fan speed and lowpass cutoff over about two seconds.
export function setHum(level: number, pitch: number, cutoff: number, hall: boolean): void {
  const c = audio();
  if (!c) return;
  try {
    if (!hum && level <= 0) return;
    hum ??= startHum(c);
    const t = c.currentTime, deep = hall ? 0.6 : 1;
    hum.gain.gain.setTargetAtTime(level * HUM_PEAK, t, 0.6);
    hum.muffle.frequency.setTargetAtTime(cutoff, t, 0.6);
    hum.band.frequency.setTargetAtTime(700 * pitch * deep, t, 1.5);
    hum.tones.forEach((o, i) => o.frequency.setTargetAtTime(BLADES[i] * pitch * deep, t, 1.5));
  } catch {
    // Silence is fine.
  }
}
