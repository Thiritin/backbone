import { audio, rattle, tone } from "../sounds";
import { useStore } from "../store";

function out(): { c: AudioContext; o: GainNode; t: number } | null {
  const { on, volume } = useStore.getState().sound, c = on && volume > 0 ? audio() : null;
  if (!c) return null;
  try {
    const o = c.createGain();
    o.gain.value = volume;
    o.connect(c.destination);
    return { c, o, t: c.currentTime + 0.01 };
  } catch {
    return null;
  }
}


export function carDoor() {
  const a = out();
  if (!a) return;
  tone(a.c, a.o, 70, a.t, 0.18, 0.5);
  rattle(a.c, a.o, a.t, 0.35, 900, 0.08);
}

// The running engine while on the road; the returned function fades it out.
export function engineRun(): () => void {
  const a = out();
  if (!a) return () => {};
  const osc = a.c.createOscillator(), lfo = a.c.createOscillator(), depth = a.c.createGain(), lp = a.c.createBiquadFilter(), g = a.c.createGain();
  osc.type = "sawtooth";
  osc.frequency.value = 52;
  lfo.frequency.value = 6;
  depth.gain.value = 3;
  lfo.connect(depth).connect(osc.frequency);
  lp.type = "lowpass";
  lp.frequency.value = 300;
  g.gain.setValueAtTime(0.0001, a.t);
  g.gain.exponentialRampToValueAtTime(0.12, a.t + 0.5);
  osc.connect(lp).connect(g).connect(a.o);
  osc.start(a.t);
  lfo.start(a.t);
  return () => {
    const now = a.c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
    osc.stop(now + 0.45);
    lfo.stop(now + 0.45);
  };
}

// Jet rumble while in the air: low-passed noise with a faint turbine whine; the returned function fades it out.
export function jetRun(): () => void {
  const a = out();
  if (!a) return () => {};
  const buf = a.c.createBuffer(1, a.c.sampleRate * 2, a.c.sampleRate), d = buf.getChannelData(0);
  for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  const noise = a.c.createBufferSource(), lp = a.c.createBiquadFilter(), whine = a.c.createOscillator(), wg = a.c.createGain(), g = a.c.createGain();
  noise.buffer = buf;
  noise.loop = true;
  lp.type = "lowpass";
  lp.frequency.value = 220;
  whine.frequency.value = 2400;
  wg.gain.value = 0.015;
  g.gain.setValueAtTime(0.0001, a.t);
  g.gain.exponentialRampToValueAtTime(0.35, a.t + 0.8);
  noise.connect(lp).connect(g);
  whine.connect(wg).connect(g);
  g.connect(a.o);
  noise.start(a.t);
  whine.start(a.t);
  return () => {
    const now = a.c.currentTime;
    g.gain.cancelScheduledValues(now);
    g.gain.setValueAtTime(Math.max(0.0001, g.gain.value), now);
    g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);
    noise.stop(now + 0.65);
    whine.stop(now + 0.65);
  };
}
