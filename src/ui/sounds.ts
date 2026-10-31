import type { GameState, LedgerEntry } from "../sim/50-state";
import { FAN_RPM, sensorsOf } from "../sim/60-infra/sensors";
import { locationOf, powered } from "../sim/60-infra/status";
import { ADVISORY_KEYS } from "../sim/60-infra/security";
import { dateOf, hourOf } from "../sim/00-core/time";

// Highest priority first: one batch of events plays only its top sound.
export const SOUNDS = ["month", "warn", "level", "research", "money", "ticket"] as const;
export type Sound = (typeof SOUNDS)[number];
export type UiSound = "open" | "close" | "key" | "thump" | "minimize" | "menu" | "banner" | "error" | "trash" | "startup" | "post" | "plug" | "unplug" | "typing" | "hover" | "select" | "back";

// How each Pear OS era voices the desktop sounds: glassy and long early on, flat and short in the middle years, soft and airy later.
export interface Voice { wave: OscillatorType; len: number; lift: number; glass: number; air: number }
const VOICES: Record<string, Voice> = {
  aqua: { wave: "sine", len: 1.4, lift: 1, glass: 0.5, air: 0 },
  leopard: { wave: "sine", len: 1.2, lift: 1, glass: 0.35, air: 0 },
  yosemite: { wave: "triangle", len: 0.7, lift: 0.9, glass: 0, air: 0 },
  bigsur: { wave: "sine", len: 0.9, lift: 0.8, glass: 0, air: 0.4 },
  tahoe: { wave: "sine", len: 0.9, lift: 0.85, glass: 0.15, air: 0.6 },
};
export const voiceOf = (era: string): Voice => VOICES[era] ?? VOICES.aqua;

const BY_KEY: Record<string, Sound> = {
  "event.monthStart": "month",
  "event.orderPaid": "money", "event.salesWon": "money", "event.orderPlaced": "money",
  "event.trained": "level",
  "event.trainingDone": "research",
  ...Object.fromEntries([
    "event.componentFailed", "event.dataLoss", "event.dataCorrupted", "event.serverHung", "event.ddos", "event.saturated", "event.failoverStuck", "event.backupFailed",
    "event.nodeFrozen", "event.cashNegative", "event.bankrupt", "event.loanMissed", "event.loanCalled", "event.techFailed",
    "event.orderFailed", "event.stepFailed", "event.seized", "event.quit", "event.vuln.hacked", "event.siteHacked", "event.siteLeft", ...ADVISORY_KEYS,
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

function note(c: AudioContext, out: AudioNode, v: Voice, hz: number, at: number, dur: number, peak: number) {
  tone(c, out, hz * v.lift, at, dur * v.len, peak, v.wave);
  if (v.glass) tone(c, out, hz * v.lift * 2.01, at, dur * v.len * 0.6, peak * v.glass);
  if (v.air) rattle(c, out, at, peak * v.air, hz * v.lift * 3, 0.04 * v.len);
}

// Noise whose band glides from one pitch to another: a window swooshing into the dock.
function sweep(c: AudioContext, out: AudioNode, from: number, to: number, at: number, secs: number, peak: number) {
  const len = Math.floor(c.sampleRate * secs), buf = c.createBuffer(1, len, c.sampleRate), data = buf.getChannelData(0);
  for (let i = 0; i < len; i++) data[i] = (Math.random() * 2 - 1) * Math.sin((Math.PI * i) / len);
  const src = c.createBufferSource(), bp = c.createBiquadFilter(), g = c.createGain();
  src.buffer = buf;
  bp.type = "bandpass";
  bp.frequency.setValueAtTime(from, at);
  bp.frequency.exponentialRampToValueAtTime(to, at + secs);
  g.gain.value = peak;
  src.connect(bp).connect(g).connect(out);
  src.start(at);
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

export function playSound(kind: Sound | UiSound, volume: number, profit = false, era = "aqua"): void {
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
        note(c, out, voiceOf(era), kind === "open" ? 1700 : 1200, t, 0.05, 0.012);
        break;
      case "minimize":
        sweep(c, out, 2400, 500, t, 0.25 * voiceOf(era).len, 0.05);
        break;
      case "hover":
        tone(c, out, 1900, t, 0.04, 0.012, "triangle");
        break;
      case "select":
        tone(c, out, 660, t, 0.12, 0.04, "triangle");
        tone(c, out, 990, t + 0.07, 0.2, 0.04, "triangle");
        break;
      case "back":
        tone(c, out, 880, t, 0.1, 0.035, "triangle");
        tone(c, out, 587, t + 0.06, 0.16, 0.035, "triangle");
        break;
      case "menu":
        note(c, out, voiceOf(era), 2600, t, 0.02, 0.008);
        break;
      case "banner":
        note(c, out, voiceOf(era), 1320, t, 0.12, 0.02);
        note(c, out, voiceOf(era), 1760, t + 0.06, 0.18, 0.018);
        break;
      case "error":
        note(c, out, voiceOf(era), 196, t, 0.2, 0.06);
        note(c, out, voiceOf(era), 147, t + 0.09, 0.3, 0.06);
        break;
      case "trash":
        // Paper crumpling: a handful of short rustles.
        for (let i = 0; i < 6; i++) rattle(c, out, t + i * 0.045 + Math.random() * 0.02, 0.04, 1500 + Math.random() * 3500, 0.035);
        break;
      case "post":
        // The single PC speaker beep of a clean power-on self test.
        tone(c, out, 1000, t, 0.12, 0.02, "square");
        break;
      case "plug":
      case "unplug": {
        // The two-note USB chime: rising as a device connects, falling as it leaves.
        const [a, b] = kind === "plug" ? [587, 880] : [880, 587];
        note(c, out, voiceOf(era), a, t, 0.16, 0.05);
        note(c, out, voiceOf(era), b, t + 0.11, 0.26, 0.05);
        break;
      }
      case "startup":
        // A wide major chord, the voice of the era the desktop runs.
        [174.6, 220, 261.6, 349.2, 523.3].forEach((hz, i) => note(c, out, voiceOf(era), hz, t + i * 0.008, 2, 0.03));
        break;
      case "key":
        rattle(c, out, t, 0.05, 1800 + Math.random() * 1400, 0.018);
        break;
      case "typing":
        // A short burst of uneven key presses with a word gap now and then.
        for (let i = 0, at = t; i < 12; i++, at += 0.05 + Math.random() * 0.06 + (Math.random() < 0.15 ? 0.12 : 0))
          rattle(c, out, at, 0.04, 1800 + Math.random() * 1400, 0.018);
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

const HUM_PEAK = 0.25, BED_GAIN = 10, BLADES = [150, 151.3, 300];
let hum: { gain: GainNode; muffle: BiquadFilterNode; whine: GainNode; tones: OscillatorNode[]; rate: number; bed?: AudioBufferSourceNode } | null = null;

// The loop between the decoder's silent padding at either end, which would otherwise gap on every pass.
export function loopBounds(data: Float32Array, threshold = 1e-3): [number, number] {
  let a = 0, b = data.length - 1;
  while (a < b && Math.abs(data[a]) < threshold) a++;
  while (b > a && Math.abs(data[b]) < threshold) b--;
  return [a, b + 1];
}

// A recorded server room carries the bed; synthetic blade tones rise over it as fans strain. Built on first use and left running.
function startHum(c: AudioContext) {
  const muffle = c.createBiquadFilter(), gain = c.createGain(), whine = c.createGain();
  muffle.type = "lowpass";
  gain.gain.value = 0;
  whine.gain.value = 0;
  whine.connect(muffle);
  const tones = BLADES.map((hz, i) => {
    const o = c.createOscillator(), g = c.createGain();
    o.frequency.value = hz;
    g.gain.value = i === 2 ? 0.5 : 1;
    o.connect(g).connect(whine);
    o.start();
    return o;
  });
  muffle.connect(gain).connect(c.destination);
  const h = { gain, muffle, whine, tones, rate: 1 } as NonNullable<typeof hum>;
  void fetch(`${import.meta.env.BASE_URL}sounds/server-room.mp3`).then((r) => r.arrayBuffer()).then((b) => c.decodeAudioData(b)).then((buf) => {
    const [from, to] = loopBounds(buf.getChannelData(0));
    const src = c.createBufferSource(), g = c.createGain();
    src.buffer = buf;
    src.loop = true;
    src.loopStart = from / buf.sampleRate;
    src.loopEnd = to / buf.sampleRate;
    src.playbackRate.value = h.rate;
    g.gain.value = BED_GAIN;
    src.connect(g).connect(muffle);
    src.start(0, src.loopStart);
    h.bed = src;
  }).catch(() => {});
  return h;
}

// Glides the fan bed toward a level (0 fades it out), fan speed and lowpass cutoff over about two seconds.
export function setHum(level: number, pitch: number, cutoff: number, hall: boolean): void {
  const c = audio();
  if (!c) return;
  try {
    if (!hum && level <= 0) return;
    hum ??= startHum(c);
    const t = c.currentTime, deep = hall ? 0.6 : 1;
    hum.rate = (hall ? 0.9 : 1) * (1 + (pitch - 1) * 0.3);
    hum.gain.gain.setTargetAtTime(level * HUM_PEAK, t, 0.6);
    hum.muffle.frequency.setTargetAtTime(cutoff, t, 0.6);
    hum.whine.gain.setTargetAtTime(Math.min(1, (pitch - 1) / 0.4) * 0.03, t, 1.5);
    hum.bed?.playbackRate.setTargetAtTime(hum.rate, t, 1.5);
    hum.tones.forEach((o, i) => o.frequency.setTargetAtTime(BLADES[i] * pitch * deep, t, 1.5));
  } catch {
    // Silence is fine.
  }
}

// Whether an action started a boot on any device, which the PC speaker answers with its beep.
export function booted(before: GameState, after: GameState): boolean {
  const was = new Map(before.devices.map((d) => [d.id, d.bootUntil]));
  return after.devices.some((d) => d.bootUntil !== undefined && d.bootUntil !== was.get(d.id));
}
