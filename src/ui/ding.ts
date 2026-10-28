let ctx: AudioContext | null = null;
let last = 0;

// A short soft two-tone chime, at most one per second so ticket floods stay quiet.
export function ding(): void {
  const now = Date.now();
  if (now - last < 1000) return;
  last = now;
  try {
    ctx ??= new AudioContext();
    const t = ctx.currentTime;
    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.exponentialRampToValueAtTime(0.05, t + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.35);
    gain.connect(ctx.destination);
    [880, 1320].forEach((hz, i) => {
      const osc = ctx!.createOscillator();
      osc.type = "sine";
      osc.frequency.value = hz;
      osc.connect(gain);
      osc.start(t + i * 0.07);
      osc.stop(t + 0.35);
    });
  } catch {
    // No audio available, for example in tests.
  }
}
