import { InjectionToken } from '@angular/core';

/**
 * Ambient soundscape for the forest walk. Implementations must stay inert
 * (no AudioContext, no window access) until `start()` is called from inside
 * a user gesture, so they are safe to construct during SSR and in tests.
 */
export interface Ambience {
  /** True between `start()` and `stop()`/`dispose()`. */
  readonly running: boolean;
  /** Build (once) and fade in. Call synchronously inside a user gesture. */
  start(): Promise<void>;
  /** Fade out and suspend the audio clock. */
  stop(): void;
  /** Temporarily silence (tab hidden, journey paused). No-op when stopped. */
  suspend(): void;
  /** Undo `suspend()`. No-op when stopped. */
  resume(): void;
  /** Release the audio graph. A later `start()` rebuilds it. */
  dispose(): void;
}

type AudioCtor = typeof AudioContext;

const MASTER_LEVEL = 0.55;
const FADE_IN_S = 2.5;
const FADE_OUT_S = 0.8;
const LOOKAHEAD_S = 1;
const SCHEDULER_MS = 400;

const rand = (min: number, max: number) => min + Math.random() * (max - min);

/**
 * Procedural misty-forest ambience: a filtered pink-noise wind bed with slow
 * gusts, bursts of leaf rustle, sparse synthesized bird calls and faint
 * insect ticks. No audio files are downloaded.
 */
export class ForestAmbience implements Ambience {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private noise: AudioBuffer | null = null;
  private rustleGain: GainNode | null = null;
  private rustleFilter: BiquadFilterNode | null = null;
  private rustlePan: StereoPannerNode | null = null;
  private sources: AudioScheduledSourceNode[] = [];
  private scheduler: ReturnType<typeof setInterval> | null = null;
  private suspendTimer: ReturnType<typeof setTimeout> | null = null;
  private nextBird = 0;
  private nextRustle = 0;
  private nextInsect = 0;
  private held = false;
  private _running = false;
  /** Per-voice panner, disconnected together with its envelope. */
  private downstream = new WeakMap<GainNode, AudioNode>();

  get running(): boolean { return this._running; }

  start(): Promise<void> {
    if (this._running) return Promise.resolve();
    const ctx = this.ensureContext();
    if (!ctx || !this.master) return Promise.resolve();
    // Resume synchronously inside the gesture, before anything awaits.
    const resumed = this.safe(() => ctx.resume());
    this._running = true;
    this.held = false;
    this.clearSuspendTimer();
    const now = ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(MASTER_LEVEL, now + FADE_IN_S);
    this.nextBird = now + rand(1.5, 4);
    this.nextRustle = now + rand(0.5, 2);
    this.nextInsect = now + rand(2, 5);
    this.startScheduler();
    return Promise.resolve(resumed).then(() => undefined, () => undefined);
  }

  stop(): void {
    if (!this._running) return;
    this._running = false;
    this.held = false;
    this.stopScheduler();
    const ctx = this.ctx;
    if (!ctx || !this.master) return;
    const now = ctx.currentTime;
    const gain = this.master.gain;
    gain.cancelScheduledValues(now);
    gain.setValueAtTime(gain.value, now);
    gain.linearRampToValueAtTime(0, now + FADE_OUT_S);
    this.clearSuspendTimer();
    this.suspendTimer = setTimeout(() => {
      this.suspendTimer = null;
      if (!this._running) this.safe(() => ctx.suspend());
    }, FADE_OUT_S * 1000 + 60);
  }

  suspend(): void {
    if (!this._running || this.held || !this.ctx) return;
    this.held = true;
    this.stopScheduler();
    const ctx = this.ctx;
    this.safe(() => ctx.suspend());
  }

  resume(): void {
    if (!this._running || !this.held || !this.ctx) return;
    this.held = false;
    const ctx = this.ctx;
    this.safe(() => ctx.resume());
    const now = ctx.currentTime;
    this.nextBird = Math.max(this.nextBird, now + rand(1, 3));
    this.nextRustle = Math.max(this.nextRustle, now + 0.5);
    this.nextInsect = Math.max(this.nextInsect, now + 2);
    this.startScheduler();
  }

  dispose(): void {
    this._running = false;
    this.held = false;
    this.stopScheduler();
    this.clearSuspendTimer();
    for (const source of this.sources) this.safe(() => source.stop());
    this.sources = [];
    const ctx = this.ctx;
    this.ctx = null;
    this.master = this.noise = this.rustleGain = this.rustleFilter = this.rustlePan = null;
    if (ctx) this.safe(() => ctx.close());
  }

  // ---------------- graph ----------------

  private ensureContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { AudioContext?: AudioCtor; webkitAudioContext?: AudioCtor };
    const Ctor = w.AudioContext ?? w.webkitAudioContext;
    if (!Ctor) return null;
    try {
      this.ctx = new Ctor();
      this.build(this.ctx);
    } catch (error) {
      console.warn('[ambience] audio unavailable', error);
      this.dispose();
      return null;
    }
    return this.ctx;
  }

  private build(ctx: AudioContext): void {
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.master = master;
    this.noise = this.pinkNoise(ctx, 2);

    // Wind bed: looping pink noise through a low-pass whose cutoff gusts.
    const wind = this.loop(ctx, 1);
    const windFilter = ctx.createBiquadFilter();
    windFilter.type = 'lowpass';
    windFilter.frequency.value = 360;
    windFilter.Q.value = 0.6;
    const windGain = ctx.createGain();
    windGain.gain.value = 0.5;
    const windPan = this.panner(ctx);
    wind.connect(windFilter).connect(windGain);
    if (windPan) windGain.connect(windPan).connect(master); else windGain.connect(master);
    this.lfo(ctx, 0.07, 150, windFilter.frequency);
    this.lfo(ctx, 0.11, 0.18, windGain.gain);
    if (windPan) this.lfo(ctx, 0.035, 0.45, windPan.pan);

    // Leaf rustle: a second, faster noise tap through a band-pass; the
    // scheduler opens its gain in short bursts.
    const rustle = this.loop(ctx, 1.31, 0.7);
    const rustleFilter = ctx.createBiquadFilter();
    rustleFilter.type = 'bandpass';
    rustleFilter.frequency.value = 2600;
    rustleFilter.Q.value = 0.9;
    const rustleGain = ctx.createGain();
    rustleGain.gain.value = 0;
    const rustlePan = this.panner(ctx);
    rustle.connect(rustleFilter).connect(rustleGain);
    if (rustlePan) rustleGain.connect(rustlePan).connect(master); else rustleGain.connect(master);
    this.rustleFilter = rustleFilter;
    this.rustleGain = rustleGain;
    this.rustlePan = rustlePan;
  }

  private pinkNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    // Paul Kellet's refined pink-noise filter.
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      data[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.11;
      b6 = white * 0.115926;
    }
    // Cross-fade the loop seam.
    const fade = Math.min(2048, length >> 4);
    for (let i = 0; i < fade; i++) {
      const t = i / fade;
      data[i] = data[i] * t + data[length - fade + i] * (1 - t);
    }
    return buffer;
  }

  private loop(ctx: AudioContext, rate: number, offset = 0): AudioBufferSourceNode {
    const source = ctx.createBufferSource();
    source.buffer = this.noise;
    source.loop = true;
    source.playbackRate.value = rate;
    source.start(0, offset);
    this.sources.push(source);
    return source;
  }

  private lfo(ctx: AudioContext, frequency: number, depth: number, target: AudioParam): void {
    const osc = ctx.createOscillator();
    osc.frequency.value = frequency;
    const amount = ctx.createGain();
    amount.gain.value = depth;
    osc.connect(amount).connect(target);
    osc.start();
    this.sources.push(osc);
  }

  private panner(ctx: AudioContext): StereoPannerNode | null {
    return typeof ctx.createStereoPanner === 'function' ? ctx.createStereoPanner() : null;
  }

  // ---------------- scheduler ----------------

  private startScheduler(): void {
    this.stopScheduler();
    this.tick();
    this.scheduler = setInterval(() => this.tick(), SCHEDULER_MS);
  }

  private stopScheduler(): void {
    if (this.scheduler !== null) clearInterval(this.scheduler);
    this.scheduler = null;
  }

  private clearSuspendTimer(): void {
    if (this.suspendTimer !== null) clearTimeout(this.suspendTimer);
    this.suspendTimer = null;
  }

  private tick(): void {
    const ctx = this.ctx;
    if (!ctx || !this._running || this.held) return;
    const horizon = ctx.currentTime + LOOKAHEAD_S;
    // If the clock jumped (tab throttled), skip ahead rather than burst.
    const floor = ctx.currentTime;
    if (this.nextBird < floor) this.nextBird = floor + rand(0.5, 3);
    if (this.nextRustle < floor) this.nextRustle = floor + rand(0.2, 1.5);
    if (this.nextInsect < floor) this.nextInsect = floor + rand(1, 4);

    while (this.nextRustle < horizon) {
      this.rustleBurst(ctx, this.nextRustle);
      this.nextRustle += rand(2, 6);
    }
    while (this.nextBird < horizon) {
      this.birdCall(ctx, this.nextBird);
      this.nextBird += rand(4, 11);
    }
    while (this.nextInsect < horizon) {
      this.insectTicks(ctx, this.nextInsect);
      this.nextInsect += rand(3, 9);
    }
  }

  private rustleBurst(ctx: AudioContext, at: number): void {
    if (!this.rustleGain || !this.rustleFilter) return;
    const peak = rand(0.05, 0.12);
    const rise = rand(0.25, 0.7);
    const hold = rand(0.2, 0.9);
    const gain = this.rustleGain.gain;
    gain.setTargetAtTime(peak, at, rise / 3);
    gain.setTargetAtTime(0, at + rise + hold, rand(0.3, 0.8));
    this.rustleFilter.frequency.setTargetAtTime(rand(1800, 3600), at, 0.4);
    this.rustlePan?.pan.setTargetAtTime(rand(-0.8, 0.8), at, 0.5);
  }

  private voice(ctx: AudioContext, at: number, peak: number, duration: number): GainNode | null {
    if (!this.master) return null;
    const env = ctx.createGain();
    env.gain.setValueAtTime(0, at);
    env.gain.linearRampToValueAtTime(peak, at + Math.min(0.02, duration / 4));
    env.gain.setTargetAtTime(0, at + duration * 0.6, duration / 5);
    const pan = this.panner(ctx);
    if (pan) {
      pan.pan.value = rand(-0.85, 0.85);
      env.connect(pan).connect(this.master);
      this.downstream.set(env, pan);
    } else {
      env.connect(this.master);
    }
    return env;
  }

  private tone(ctx: AudioContext, out: AudioNode, at: number, duration: number,
               shape: (f: AudioParam) => void, type: OscillatorType = 'sine'): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.type = type;
    shape(osc.frequency);
    osc.connect(out);
    osc.start(at);
    osc.stop(at + duration + 0.3);
    osc.onended = () => {
      osc.disconnect();
      if (out instanceof GainNode) {
        out.disconnect();
        this.downstream.get(out)?.disconnect();
        this.downstream.delete(out);
      }
    };
    return osc;
  }

  private birdCall(ctx: AudioContext, at: number): void {
    const kind = Math.random();
    const level = rand(0.018, 0.042);
    if (kind < 0.4) {
      // Chirps: quick upward sweeps, two to four in a row.
      const count = 2 + Math.floor(Math.random() * 3);
      const base = rand(2600, 3400);
      for (let i = 0; i < count; i++) {
        const t = at + i * rand(0.11, 0.16);
        const env = this.voice(ctx, t, level, 0.09);
        if (!env) return;
        this.tone(ctx, env, t, 0.09, (f) => {
          f.setValueAtTime(base, t);
          f.exponentialRampToValueAtTime(base * rand(1.35, 1.6), t + 0.08);
        });
      }
    } else if (kind < 0.7) {
      // Trill: a carrier wobbled by a fast FM modulator.
      const duration = rand(0.45, 0.8);
      const env = this.voice(ctx, at, level * 0.8, duration);
      if (!env) return;
      const carrier = this.tone(ctx, env, at, duration, (f) => f.setValueAtTime(rand(3000, 3800), at));
      const mod = ctx.createOscillator();
      mod.frequency.value = rand(22, 32);
      const depth = ctx.createGain();
      depth.gain.value = rand(250, 450);
      mod.connect(depth).connect(carrier.frequency);
      mod.start(at);
      mod.stop(at + duration + 0.3);
      mod.onended = () => { mod.disconnect(); depth.disconnect(); };
    } else {
      // Two-note whistle, sliding gently between pitches.
      const first = rand(1900, 2400);
      const second = first * (Math.random() < 0.5 ? rand(0.78, 0.86) : rand(1.12, 1.22));
      const env = this.voice(ctx, at, level, 0.62);
      if (!env) return;
      this.tone(ctx, env, at, 0.62, (f) => {
        f.setValueAtTime(first, at);
        f.setValueAtTime(first, at + 0.24);
        f.exponentialRampToValueAtTime(second, at + 0.32);
      }, 'triangle');
    }
  }

  private insectTicks(ctx: AudioContext, at: number): void {
    const count = 3 + Math.floor(Math.random() * 6);
    const pitch = rand(5200, 7200);
    const gap = rand(0.06, 0.09);
    for (let i = 0; i < count; i++) {
      const t = at + i * gap;
      const duration = rand(0.02, 0.035);
      const env = this.voice(ctx, t, rand(0.006, 0.012), duration);
      if (!env) return;
      this.tone(ctx, env, t, duration, (f) => f.setValueAtTime(pitch, t), 'square');
    }
  }

  private safe<T>(fn: () => T): T | undefined {
    try {
      const result = fn();
      if (result instanceof Promise) result.catch(() => undefined);
      return result;
    } catch {
      return undefined;
    }
  }
}

export const AMBIENCE = new InjectionToken<Ambience>('AMBIENCE', {
  providedIn: 'root', factory: () => new ForestAmbience(),
});
