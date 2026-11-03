import { audio, rattle, sweep, tone } from "../sounds";
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

// A sawtooth through a low-pass, gliding between two pitches: the engine.
function motor(c: AudioContext, o: AudioNode, at: number, from: number, to: number, secs: number, peak: number) {
  const osc = c.createOscillator(), lp = c.createBiquadFilter(), g = c.createGain();
  osc.type = "sawtooth";
  osc.frequency.setValueAtTime(from, at);
  osc.frequency.exponentialRampToValueAtTime(to, at + secs);
  lp.type = "lowpass";
  lp.frequency.value = 380;
  g.gain.setValueAtTime(0.0001, at);
  g.gain.exponentialRampToValueAtTime(peak, at + 0.08);
  g.gain.exponentialRampToValueAtTime(0.0001, at + secs);
  osc.connect(lp).connect(g).connect(o);
  osc.start(at);
  osc.stop(at + secs + 0.05);
  return { osc, g };
}

export function carDoor() {
  const a = out();
  if (!a) return;
  tone(a.c, a.o, 70, a.t, 0.18, 0.5);
  rattle(a.c, a.o, a.t, 0.35, 900, 0.08);
}

export function engineStart() {
  const a = out();
  if (!a) return;
  for (let i = 0; i < 3; i++) motor(a.c, a.o, a.t + i * 0.13, 28, 34, 0.11, 0.25);
  sweep(a.c, a.o, 200, 700, a.t + 0.4, 0.5, 0.25);
  motor(a.c, a.o, a.t + 0.4, 40, 90, 0.7, 0.3);
}

export function engineStop() {
  const a = out();
  if (!a) return;
  motor(a.c, a.o, a.t, 60, 25, 0.6, 0.25);
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
