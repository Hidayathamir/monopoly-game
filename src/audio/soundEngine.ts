export const SoundId = {
  Click: 'click',
  DiceRoll: 'diceRoll',
  DiceLand: 'diceLand',
  Buy: 'buy',
  Build: 'build',
  Card: 'card',
  MoneyGain: 'moneyGain',
  MoneyLoss: 'moneyLoss',
  Jail: 'jail',
  Bankruptcy: 'bankruptcy',
  Win: 'win',
  Trade: 'trade',
  RoomJoin: 'roomJoin',
  GameStart: 'gameStart',
} as const;
export type SoundId = (typeof SoundId)[keyof typeof SoundId];

interface ToneOpts {
  freq: number;
  endFreq?: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function tone(ctx: AudioContext, dest: AudioNode, opts: ToneOpts): void {
  const { freq, endFreq, duration, type = 'sine', gain = 0.5, delay = 0 } = opts;
  const t0 = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const g = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t0);
  if (endFreq !== undefined) {
    osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), t0 + duration);
  }
  g.gain.setValueAtTime(0.0001, t0);
  g.gain.exponentialRampToValueAtTime(gain, t0 + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  osc.connect(g);
  g.connect(dest);
  osc.start(t0);
  osc.stop(t0 + duration + 0.05);
}

function noise(ctx: AudioContext, dest: AudioNode, duration: number, gain = 0.3, delay = 0): void {
  const t0 = ctx.currentTime + delay;
  const buffer = ctx.createBuffer(1, Math.max(1, Math.floor(ctx.sampleRate * duration)), ctx.sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
  const src = ctx.createBufferSource();
  src.buffer = buffer;
  const g = ctx.createGain();
  g.gain.setValueAtTime(gain, t0);
  g.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
  src.connect(g);
  g.connect(dest);
  src.start(t0);
}

const SOUND_GENERATORS: Record<SoundId, (ctx: AudioContext, dest: AudioNode) => void> = {
  [SoundId.Click]: (ctx, dest) => tone(ctx, dest, { freq: 900, duration: 0.05, type: 'triangle', gain: 0.4 }),
  [SoundId.DiceRoll]: (ctx, dest) => {
    noise(ctx, dest, 0.25, 0.25);
    noise(ctx, dest, 0.18, 0.2, 0.08);
    noise(ctx, dest, 0.12, 0.15, 0.16);
  },
  [SoundId.DiceLand]: (ctx, dest) =>
    tone(ctx, dest, { freq: 160, endFreq: 90, duration: 0.12, type: 'square', gain: 0.3 }),
  [SoundId.Buy]: (ctx, dest) => {
    tone(ctx, dest, { freq: 660, duration: 0.08, type: 'square', gain: 0.25 });
    tone(ctx, dest, { freq: 880, duration: 0.12, type: 'square', gain: 0.25, delay: 0.09 });
  },
  [SoundId.Build]: (ctx, dest) => {
    tone(ctx, dest, { freq: 300, endFreq: 500, duration: 0.09, type: 'triangle', gain: 0.35 });
    tone(ctx, dest, { freq: 420, endFreq: 700, duration: 0.12, type: 'triangle', gain: 0.35, delay: 0.08 });
  },
  [SoundId.Card]: (ctx, dest) => {
    noise(ctx, dest, 0.15, 0.18);
    tone(ctx, dest, { freq: 700, endFreq: 400, duration: 0.12, type: 'sine', gain: 0.2, delay: 0.02 });
  },
  [SoundId.MoneyGain]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.07, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 659, duration: 0.07, type: 'triangle', gain: 0.3, delay: 0.07 });
    tone(ctx, dest, { freq: 784, duration: 0.14, type: 'triangle', gain: 0.3, delay: 0.14 });
  },
  [SoundId.MoneyLoss]: (ctx, dest) => {
    tone(ctx, dest, { freq: 400, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 300, duration: 0.16, type: 'triangle', gain: 0.3, delay: 0.1 });
  },
  [SoundId.Jail]: (ctx, dest) => {
    tone(ctx, dest, { freq: 130, endFreq: 110, duration: 0.3, type: 'sawtooth', gain: 0.18 });
    tone(ctx, dest, { freq: 180, duration: 0.12, type: 'square', gain: 0.2, delay: 0.32 });
  },
  [SoundId.Bankruptcy]: (ctx, dest) => {
    tone(ctx, dest, { freq: 330, duration: 0.14, type: 'sawtooth', gain: 0.22 });
    tone(ctx, dest, { freq: 262, duration: 0.14, type: 'sawtooth', gain: 0.22, delay: 0.15 });
    tone(ctx, dest, { freq: 196, duration: 0.3, type: 'sawtooth', gain: 0.22, delay: 0.3 });
  },
  [SoundId.Win]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 659, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.11 });
    tone(ctx, dest, { freq: 784, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.22 });
    tone(ctx, dest, { freq: 1046, duration: 0.3, type: 'triangle', gain: 0.3, delay: 0.33 });
  },
  [SoundId.Trade]: (ctx, dest) => {
    tone(ctx, dest, { freq: 880, duration: 0.08, type: 'sine', gain: 0.25 });
    tone(ctx, dest, { freq: 1100, duration: 0.14, type: 'sine', gain: 0.25, delay: 0.09 });
  },
  [SoundId.RoomJoin]: (ctx, dest) => {
    tone(ctx, dest, { freq: 523, duration: 0.12, type: 'sine', gain: 0.3 });
    tone(ctx, dest, { freq: 784, duration: 0.2, type: 'sine', gain: 0.3, delay: 0.13 });
  },
  [SoundId.GameStart]: (ctx, dest) => {
    tone(ctx, dest, { freq: 392, duration: 0.1, type: 'triangle', gain: 0.3 });
    tone(ctx, dest, { freq: 523, duration: 0.1, type: 'triangle', gain: 0.3, delay: 0.12 });
    tone(ctx, dest, { freq: 659, duration: 0.22, type: 'triangle', gain: 0.3, delay: 0.24 });
  },
};

const MASTER_GAIN = 0.3;

let ctx: AudioContext | null = null;

function getContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const AC =
    window.AudioContext ??
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  return AC ? new AC() : null;
}

export function playSound(id: SoundId): void {
  if (!ctx) ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'closed') return;
  if (ctx.state === 'suspended') void ctx.resume();
  const master = ctx.createGain();
  master.gain.value = MASTER_GAIN;
  master.connect(ctx.destination);
  SOUND_GENERATORS[id](ctx, master);
}

export function unlockAudio(): void {
  if (!ctx) ctx = getContext();
  if (!ctx) return;
  if (ctx.state === 'suspended') void ctx.resume();
}
