// Sound management utility for the game.
//
// Samples are decoded into Web Audio buffers and played through a mastering bus
// (EQ -> glue compressor -> limiter, plus a short room reverb send). Every play
// gets its own voice, so rapid shots layer instead of cutting each other off,
// and per-sound profiles add pitch variation and synthesized low-end layers.
// Event sounds that have no sample (red zone siren, bombs, boss stings, supply
// chimes) are synthesized on the fly. Falls back to plain HTMLAudio when Web
// Audio is unavailable.
import { useRef } from "react";

// Global volume settings
const globalVolumeSettings = {
  masterVolume: 50,
  soundEffectsVolume: 75,
  getEffectiveVolume: (baseVolume: number) => {
    const masterMultiplier = globalVolumeSettings.masterVolume / 100;
    const effectsMultiplier = globalVolumeSettings.soundEffectsVolume / 100;
    return baseVolume * masterMultiplier * effectsMultiplier;
  },
};

// Function to update global volume settings
export const updateGlobalVolumeSettings = (
  masterVolume: number,
  soundEffectsVolume: number
) => {
  globalVolumeSettings.masterVolume = masterVolume;
  globalVolumeSettings.soundEffectsVolume = soundEffectsVolume;
};

const SAMPLES: Record<string, string> = {
  playerCannon: "./assets/sounds/playerCannon.mp3",
  shotgun: "./assets/sounds/shotgunBlast.mp3",
  sniper: "./assets/sounds/sniperShot.mp3",
  rocket: "./assets/sounds/rocketLauncher.mp3",
  laser: "./assets/sounds/laserBurst.mp3",
  npcImpact: "./assets/sounds/npcImpact.mp3",
  levelUp: "./assets/sounds/levelUpSnare.mp3",
  healthPickUp: "./assets/sounds/healthPickUp.mp3",
  zoneWarning: "./assets/sounds/zoneWarning.mp3",
  teslaZap: "./assets/sounds/teslaZap.mp3",
  deployTank: "./assets/sounds/deployTank.mp3",
};

type SynthLayer = "thump" | "boom" | "crack";

interface SoundProfile {
  /** Random playback-rate spread (+/-), keeps repeated shots from sounding identical */
  pitchVar?: number;
  /** Reverb send level 0..1 */
  reverb?: number;
  /** Simultaneous voices before the oldest is stolen */
  maxVoices?: number;
  /** Synthesized layers mixed under the sample */
  layers?: SynthLayer[];
  /** Gain trim applied after the caller's volume */
  trim?: number;
}

// The level-up snare is deliberately left dry and untouched.
const PROFILES: Record<string, SoundProfile> = {
  playerCannon: { pitchVar: 0.05, reverb: 0.18, maxVoices: 4, layers: ["thump"] },
  shotgun: { pitchVar: 0.06, reverb: 0.15, maxVoices: 3, layers: ["thump"] },
  sniper: { pitchVar: 0.03, reverb: 0.3, maxVoices: 3, layers: ["crack"] },
  rocket: { pitchVar: 0.05, reverb: 0.2, maxVoices: 3 },
  laser: { pitchVar: 0.04, reverb: 0.12, maxVoices: 4 },
  npcImpact: { pitchVar: 0.08, reverb: 0.3, maxVoices: 6, layers: ["boom"] },
  teslaZap: { pitchVar: 0.07, reverb: 0.15, maxVoices: 4 },
  healthPickUp: { reverb: 0.15, maxVoices: 2 },
  levelUp: { reverb: 0.08, maxVoices: 2 },
  deployTank: { reverb: 0.2, maxVoices: 1, layers: ["boom"] },
  zoneWarning: { reverb: 0.1, maxVoices: 1 },
};

type SynthFn = (ctx: AudioContext, out: AudioNode, t: number, gain: number) => number;

interface Voice {
  sources: AudioScheduledSourceNode[];
  gain: GainNode;
  endsAt: number;
}

// Class to handle sound effects
class SoundManager {
  private static instance: SoundManager;
  private sounds: Map<string, HTMLAudioElement> = new Map();
  private lastPlayTime: Map<string, number> = new Map();
  private baseVolume: Map<string, number> = new Map();
  private audioUnlocked: boolean = true;

  private ctx: AudioContext | null = null;
  private busIn: GainNode | null = null;
  private reverbIn: GainNode | null = null;
  private buffers: Map<string, AudioBuffer> = new Map();
  private voices: Map<string, Voice[]> = new Map();
  private loops: Map<string, Voice> = new Map();
  private noise: AudioBuffer | null = null;
  private synths: Map<string, SynthFn> = new Map();

  private constructor() {
    this.initWebAudio();
    this.loadSounds();
    this.registerSynths();
  }

  public static getInstance(): SoundManager {
    if (!SoundManager.instance) {
      SoundManager.instance = new SoundManager();
    }
    return SoundManager.instance;
  }

  private initWebAudio(): void {
    if (typeof window === "undefined") return;
    const Ctor =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext })
        .webkitAudioContext;
    if (!Ctor) return;

    try {
      const ctx = new Ctor();
      this.ctx = ctx;

      // Mastering chain: weight, mud cut, air -> glue compression -> brickwall
      const busIn = ctx.createGain();
      const low = ctx.createBiquadFilter();
      low.type = "lowshelf";
      low.frequency.value = 110;
      low.gain.value = 3;
      const mud = ctx.createBiquadFilter();
      mud.type = "peaking";
      mud.frequency.value = 380;
      mud.Q.value = 0.9;
      mud.gain.value = -2.5;
      const air = ctx.createBiquadFilter();
      air.type = "highshelf";
      air.frequency.value = 7500;
      air.gain.value = 2;
      const glue = ctx.createDynamicsCompressor();
      glue.threshold.value = -20;
      glue.knee.value = 8;
      glue.ratio.value = 3.5;
      glue.attack.value = 0.004;
      glue.release.value = 0.22;
      const makeup = ctx.createGain();
      makeup.gain.value = 1.35;
      const limiter = ctx.createDynamicsCompressor();
      limiter.threshold.value = -1.5;
      limiter.knee.value = 0;
      limiter.ratio.value = 20;
      limiter.attack.value = 0.001;
      limiter.release.value = 0.08;

      busIn.connect(low).connect(mud).connect(air).connect(glue);
      glue.connect(makeup).connect(limiter).connect(ctx.destination);

      // Short outdoor-ish room so shots have a tail instead of stopping dead
      const reverbIn = ctx.createGain();
      const convolver = ctx.createConvolver();
      convolver.buffer = this.makeImpulse(ctx, 1.6, 2.8);
      const reverbTone = ctx.createBiquadFilter();
      reverbTone.type = "lowpass";
      reverbTone.frequency.value = 4200;
      const reverbOut = ctx.createGain();
      reverbOut.gain.value = 0.55;
      reverbIn.connect(convolver).connect(reverbTone).connect(reverbOut).connect(glue);

      this.busIn = busIn;
      this.reverbIn = reverbIn;
      this.noise = this.makeNoise(ctx, 2);

      // Browsers start contexts suspended until a gesture
      const unlock = () => {
        if (ctx.state === "suspended") ctx.resume().catch(() => undefined);
      };
      ["pointerdown", "keydown", "touchstart"].forEach((evt) =>
        window.addEventListener(evt, unlock, { passive: true })
      );
    } catch {
      this.ctx = null;
    }
  }

  private makeImpulse(ctx: AudioContext, seconds: number, decay: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const impulse = ctx.createBuffer(2, length, ctx.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const data = impulse.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / length, decay);
      }
    }
    return impulse;
  }

  private makeNoise(ctx: AudioContext, seconds: number): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * seconds);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i++) data[i] = Math.random() * 2 - 1;
    return buffer;
  }

  private loadSounds(): void {
    for (const [id, path] of Object.entries(SAMPLES)) {
      this.lastPlayTime.set(id, 0);
      if (this.ctx) {
        this.loadBuffer(id, path);
      } else {
        const audio = new Audio(path);
        audio.preload = "auto";
        this.sounds.set(id, audio);
      }
    }
  }

  private async loadBuffer(id: string, path: string): Promise<void> {
    try {
      const res = await fetch(path);
      const data = await res.arrayBuffer();
      const buffer = await this.ctx!.decodeAudioData(data);
      this.buffers.set(id, buffer);
    } catch (error) {
      console.warn(`Error loading sound ${id}:`, error);
    }
  }

  // --- Synthesis helpers -------------------------------------------------

  private env(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    peak: number,
    attack: number,
    decay: number
  ): GainNode {
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(Math.max(0.0002, peak), t + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, t + attack + decay);
    g.connect(out);
    return g;
  }

  private tone(
    ctx: AudioContext,
    out: AudioNode,
    type: OscillatorType,
    t: number,
    f0: number,
    f1: number,
    dur: number,
    peak: number,
    attack = 0.005
  ): OscillatorNode {
    const osc = ctx.createOscillator();
    osc.type = type;
    osc.frequency.setValueAtTime(f0, t);
    if (f1 !== f0) osc.frequency.exponentialRampToValueAtTime(f1, t + dur);
    osc.connect(this.env(ctx, out, t, peak, attack, dur));
    osc.start(t);
    osc.stop(t + attack + dur + 0.05);
    return osc;
  }

  private noiseBurst(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    dur: number,
    peak: number,
    filter: BiquadFilterType,
    f0: number,
    f1: number,
    attack = 0.003
  ): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    src.loop = true;
    const bq = ctx.createBiquadFilter();
    bq.type = filter;
    bq.frequency.setValueAtTime(f0, t);
    bq.frequency.exponentialRampToValueAtTime(Math.max(20, f1), t + dur);
    src.connect(bq).connect(this.env(ctx, out, t, peak, attack, dur));
    src.start(t, Math.random());
    src.stop(t + attack + dur + 0.05);
    return src;
  }

  private layer(kind: SynthLayer, out: AudioNode, t: number, gain: number): void {
    const ctx = this.ctx!;
    switch (kind) {
      case "thump":
        this.tone(ctx, out, "sine", t, 95, 38, 0.22, 0.9 * gain);
        break;
      case "boom":
        this.tone(ctx, out, "sine", t, 70, 28, 0.6, 1.0 * gain, 0.008);
        this.noiseBurst(ctx, out, t, 0.5, 0.35 * gain, "lowpass", 900, 120);
        break;
      case "crack":
        this.noiseBurst(ctx, out, t, 0.06, 0.5 * gain, "highpass", 2500, 4000, 0.001);
        break;
    }
  }

  private registerSynths(): void {
    // Rising/falling air-raid siren for the red zone warning
    this.synths.set("redZoneSiren", (ctx, out, t, g) => {
      const dur = 2.6;
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 1800;
      lp.connect(out);
      for (const detune of [0, 7]) {
        const osc = ctx.createOscillator();
        osc.type = "sawtooth";
        osc.detune.value = detune;
        osc.frequency.setValueAtTime(320, t);
        osc.frequency.linearRampToValueAtTime(760, t + dur * 0.45);
        osc.frequency.linearRampToValueAtTime(540, t + dur);
        const env = ctx.createGain();
        env.gain.setValueAtTime(0.0001, t);
        env.gain.linearRampToValueAtTime(0.16 * g, t + 0.35);
        env.gain.setValueAtTime(0.16 * g, t + dur - 0.6);
        env.gain.linearRampToValueAtTime(0.0001, t + dur);
        osc.connect(env).connect(lp);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
      return dur;
    });

    // Falling-shell whistle
    this.synths.set("bombWhistle", (ctx, out, t, g) => {
      const dur = 1.0;
      const osc = ctx.createOscillator();
      osc.type = "sine";
      osc.frequency.setValueAtTime(2100, t);
      osc.frequency.exponentialRampToValueAtTime(520, t + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(0.12 * g, t + dur * 0.7);
      env.gain.linearRampToValueAtTime(0.0001, t + dur);
      osc.connect(env).connect(out);
      osc.start(t);
      osc.stop(t + dur + 0.05);
      return dur;
    });

    // Artillery impact: crack, body, sub tail
    this.synths.set("bombBlast", (ctx, out, t, g) => {
      this.noiseBurst(ctx, out, t, 0.08, 0.7 * g, "highpass", 1800, 900, 0.001);
      this.noiseBurst(ctx, out, t, 0.9, 0.8 * g, "lowpass", 2400, 90);
      this.tone(ctx, out, "sine", t, 80, 26, 0.9, 1.1 * g, 0.006);
      return 1.0;
    });

    // Klaxon for a boss entering the arena
    this.synths.set("bossAlarm", (ctx, out, t, g) => {
      const lp = ctx.createBiquadFilter();
      lp.type = "lowpass";
      lp.frequency.value = 2200;
      lp.connect(out);
      for (let i = 0; i < 3; i++) {
        const s = t + i * 0.7;
        this.tone(ctx, lp, "square", s, 220, 220, 0.3, 0.12 * g, 0.01);
        this.tone(ctx, lp, "square", s + 0.32, 165, 165, 0.3, 0.12 * g, 0.01);
      }
      this.tone(ctx, out, "sine", t, 55, 40, 2.0, 0.5 * g, 0.05);
      return 2.2;
    });

    // Boss destroyed: big boom into a major-chord brass-ish sting
    this.synths.set("bossDefeated", (ctx, out, t, g) => {
      this.synths.get("bombBlast")!(ctx, out, t, g * 1.2);
      const notes = [261.6, 329.6, 392.0, 523.3];
      notes.forEach((f, i) => {
        this.tone(ctx, out, "sawtooth", t + 0.35 + i * 0.06, f, f, 1.2, 0.07 * g, 0.03);
        this.tone(ctx, out, "triangle", t + 0.35 + i * 0.06, f * 2, f * 2, 1.0, 0.05 * g, 0.02);
      });
      return 2.0;
    });

    // Supply pickup: bright two-note chime
    this.synths.set("supplyPickUp", (ctx, out, t, g) => {
      this.tone(ctx, out, "triangle", t, 1318.5, 1318.5, 0.12, 0.22 * g, 0.002);
      this.tone(ctx, out, "triangle", t + 0.07, 1975.5, 1975.5, 0.28, 0.2 * g, 0.002);
      this.tone(ctx, out, "sine", t + 0.07, 3951, 3951, 0.18, 0.05 * g, 0.002);
      return 0.4;
    });

    // Permanent upgrade purchased
    this.synths.set("upgradePurchase", (ctx, out, t, g) => {
      [523.3, 659.3, 784.0, 1046.5].forEach((f, i) => {
        this.tone(ctx, out, "triangle", t + i * 0.055, f, f, 0.25, 0.18 * g, 0.003);
      });
      this.noiseBurst(ctx, out, t, 0.05, 0.15 * g, "bandpass", 3000, 3000, 0.001);
      return 0.5;
    });

    // Denied / can't afford
    this.synths.set("uiDenied", (ctx, out, t, g) => {
      this.tone(ctx, out, "square", t, 180, 140, 0.16, 0.08 * g, 0.004);
      return 0.2;
    });
  }

  // --- Playback ----------------------------------------------------------

  private trackVoice(id: string, voice: Voice, maxVoices: number): void {
    const now = this.ctx!.currentTime;
    const list = (this.voices.get(id) || []).filter((v) => v.endsAt > now);
    while (list.length >= maxVoices) {
      const oldest = list.shift()!;
      this.fadeOut(oldest, 0.03);
    }
    list.push(voice);
    this.voices.set(id, list);
  }

  private fadeOut(voice: Voice, seconds: number): void {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    voice.gain.gain.cancelScheduledValues(t);
    voice.gain.gain.setValueAtTime(voice.gain.gain.value, t);
    voice.gain.gain.linearRampToValueAtTime(0, t + seconds);
    for (const src of voice.sources) {
      try {
        src.stop(t + seconds + 0.01);
      } catch {
        // already stopped
      }
    }
  }

  private startVoice(id: string, loop: boolean, volume: number): Voice | null {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const profile = PROFILES[id] || {};
    // Same clamp the HTMLAudio path had, so existing call-site volumes keep their balance
    const effective =
      Math.min(1, globalVolumeSettings.getEffectiveVolume(volume)) * (profile.trim ?? 1);
    if (effective <= 0) return null;

    const gain = ctx.createGain();
    gain.gain.value = effective;
    gain.connect(this.busIn!);
    if (profile.reverb) {
      const send = ctx.createGain();
      send.gain.value = profile.reverb;
      gain.connect(send).connect(this.reverbIn!);
    }

    const synth = this.synths.get(id);
    if (synth) {
      const dur = synth(ctx, gain, t, 1);
      return { sources: [], gain, endsAt: t + dur };
    }

    const buffer = this.buffers.get(id);
    if (!buffer) return null;

    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = loop;
    if (!loop && profile.pitchVar) {
      src.playbackRate.value = 1 + (Math.random() * 2 - 1) * profile.pitchVar;
    }
    src.connect(gain);
    src.start(t);
    if (!loop && profile.layers) {
      for (const kind of profile.layers) this.layer(kind, gain, t, 0.5);
    }
    return {
      sources: [src],
      gain,
      endsAt: loop ? Infinity : t + buffer.duration / src.playbackRate.value,
    };
  }

  public play(id: string, minDelay = 0): void {
    const now = Date.now();
    const lastPlay = this.lastPlayTime.get(id) || 0;

    // Check if enough time has passed since last play
    if (now - lastPlay < minDelay) {
      return;
    }

    if (this.ctx) {
      if (!this.buffers.has(id) && !this.synths.has(id)) {
        if (!SAMPLES[id]) console.warn(`Sound with id ${id} not found`);
        return;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
      const voice = this.startVoice(id, false, this.baseVolume.get(id) ?? 1);
      if (voice) this.trackVoice(id, voice, PROFILES[id]?.maxVoices ?? 4);
      this.lastPlayTime.set(id, now);
      return;
    }

    const sound = this.sounds.get(id);
    if (!sound) {
      if (!this.synths.has(id)) console.warn(`Sound with id ${id} not found`);
      return;
    }
    sound.volume = Math.max(
      0,
      Math.min(1, globalVolumeSettings.getEffectiveVolume(this.baseVolume.get(id) ?? 1))
    );
    sound.currentTime = 0;
    // play() can return undefined on very old engines / test DOMs
    sound.play()?.catch((error) => {
      console.warn(`Error playing sound ${id}:`, error);
    });
    this.lastPlayTime.set(id, now);
  }

  /** Set the volume for the next play of `id` and play it. */
  public playAt(id: string, volume: number, minDelay = 0): void {
    this.setVolume(id, volume);
    this.play(id, minDelay);
  }

  public stop(id: string): void {
    if (this.ctx) {
      for (const voice of this.voices.get(id) || []) this.fadeOut(voice, 0.05);
      this.voices.set(id, []);
      return;
    }
    const sound = this.sounds.get(id);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
    }
  }

  public setVolume(id: string, volume: number): void {
    // Global settings are applied at play time so slider changes take effect immediately
    this.baseVolume.set(id, Math.max(0, volume));
  }

  public playLoop(id: string, volume = 1): void {
    this.setVolume(id, volume);

    if (this.ctx) {
      if (this.loops.has(id)) return;
      if (!this.buffers.has(id)) {
        // Sample still decoding: retry shortly so early loops aren't lost
        if (SAMPLES[id]) setTimeout(() => this.playLoop(id, volume), 250);
        return;
      }
      if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
      const voice = this.startVoice(id, true, this.baseVolume.get(id) ?? 1);
      if (voice) this.loops.set(id, voice);
      return;
    }

    const sound = this.sounds.get(id);
    if (!sound) {
      console.warn(`Sound with id ${id} not found`);
      return;
    }
    sound.volume = Math.max(
      0,
      Math.min(1, globalVolumeSettings.getEffectiveVolume(this.baseVolume.get(id) ?? 1))
    );
    sound.loop = true;
    // play() can return undefined on very old engines / test DOMs
    sound.play()?.catch((error) => {
      console.warn(`Error playing sound ${id}:`, error);
    });
  }

  public stopLoop(id: string): void {
    if (this.ctx) {
      const voice = this.loops.get(id);
      if (voice) this.fadeOut(voice, 0.25);
      this.loops.delete(id);
      return;
    }
    const sound = this.sounds.get(id);
    if (sound) {
      sound.pause();
      sound.currentTime = 0;
      sound.loop = false;
    }
  }

  public isAudioUnlocked(): boolean {
    return this.audioUnlocked;
  }
}

// Hook for components to access the sound manager
export const useSound = () => {
  const soundManager = useRef(SoundManager.getInstance());

  return {
    play: (id: string, minDelay = 0) => soundManager.current.play(id, minDelay),
    stop: (id: string) => soundManager.current.stop(id),
    setVolume: (id: string, volume: number) =>
      soundManager.current.setVolume(id, volume),
    playLoop: (id: string, volume = 1) =>
      soundManager.current.playLoop(id, volume),
    stopLoop: (id: string) => soundManager.current.stopLoop(id),
    isAudioUnlocked: () => soundManager.current.isAudioUnlocked(),
  };
};

// Reset sound manager's last play time for a specific sound
export const resetSoundTimer = (id: string): void => {
  const soundManager = SoundManager.getInstance();
  const lastPlayTimeMap = (soundManager as unknown as { lastPlayTime: Map<string, number> })
    .lastPlayTime;
  if (lastPlayTimeMap) {
    lastPlayTimeMap.set(id, 0);
  }
};

export default SoundManager.getInstance();
