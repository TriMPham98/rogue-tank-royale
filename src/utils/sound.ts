// Sound management utility for the game.
//
// Samples are decoded into Web Audio buffers. The original game samples get a
// half-strength remaster (see HALF_REMASTER); the level-up snare is untouched.
// Newer event sounds with no
// sample (red zone siren, shells, boss stings, armory chimes) are synthesized
// on the fly and run through a mastering bus (EQ -> glue compressor ->
// limiter, plus a short room reverb send). Falls back to plain HTMLAudio when
// Web Audio is unavailable.
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
  shellImpact: "./assets/sounds/shellImpact.mp3",
};

type SynthLayer = "thump" | "boom" | "crack";

interface SoundProfile {
  /** Random playback-rate spread (+/-), keeps repeated shots from sounding identical */
  pitchVar?: number;
  /** Reverb send level 0..1 */
  reverb?: number;
  /** Simultaneous voices before the oldest is stolen */
  maxVoices?: number;
  /** Bypass the mastering bus and reverb: straight to the speakers */
  dry?: boolean;
  /** Share of the signal sent through the mastering bus (rest stays dry). Default 1 */
  blend?: number;
  /** Synthesized low-end layers mixed under the sample, with their gain */
  layers?: { kind: SynthLayer; gain: number }[];
  /** Gain trim applied after the caller's volume */
  trim?: number;
}

// The level-up snare is deliberately left exactly as recorded: dry, one voice.
const UNTOUCHED: SoundProfile = { dry: true, maxVoices: 1 };

// The original samples get the remaster at half strength: half the signal
// goes through the mastering bus and half stays dry, with half the pitch
// variation, reverb and low-end layering of the full remaster, and a little
// polyphony so rapid shots overlap instead of cutting off.
const HALF_REMASTER = 0.5;
const half = (
  pitchVar: number,
  reverb: number,
  maxVoices: number,
  layers: SynthLayer[] = []
): SoundProfile => ({
  blend: HALF_REMASTER,
  pitchVar: pitchVar * HALF_REMASTER,
  reverb: reverb * HALF_REMASTER,
  maxVoices,
  layers: layers.map((kind) => ({ kind, gain: 0.5 * HALF_REMASTER })),
});

const PROFILES: Record<string, SoundProfile> = {
  playerCannon: half(0.05, 0.18, 2, ["thump"]),
  shotgun: half(0.06, 0.15, 2, ["thump"]),
  sniper: half(0.03, 0.3, 2, ["crack"]),
  rocket: half(0.05, 0.2, 2),
  laser: half(0.04, 0.12, 2),
  npcImpact: half(0.08, 0.3, 3, ["boom"]),
  teslaZap: half(0.07, 0.15, 2),
  healthPickUp: half(0, 0.15, 1),
  deployTank: half(0, 0.2, 1, ["boom"]),
  zoneWarning: half(0, 0.1, 1),
  levelUp: UNTOUCHED,
  // Newer event sounds go through the mastering bus
  redZoneSiren: { reverb: 0.75, maxVoices: 1 },
  bombWhistle: { reverb: 0.2, maxVoices: 3 },
  bombBlast: { reverb: 0.45, maxVoices: 6 },
  bossAlarm: { reverb: 0.5, maxVoices: 1 },
  bossEscort: { reverb: 0.7, maxVoices: 1 },
  upgradePurchase: { reverb: 0.25, maxVoices: 2 },
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

  /** Brass-like swell: detuned saw stack + fifth, driven and opened by a lowpass sweep. */
  private braaam(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    root: number,
    dur: number,
    peak: number
  ): void {
    const drive = ctx.createWaveShaper();
    const curve = new Float32Array(1024);
    for (let i = 0; i < curve.length; i++) {
      const x = (i / (curve.length - 1)) * 2 - 1;
      curve[i] = Math.tanh(x * 2.4);
    }
    drive.curve = curve;

    const lp = ctx.createBiquadFilter();
    lp.type = "lowpass";
    lp.Q.value = 1.4;
    lp.frequency.setValueAtTime(180, t);
    lp.frequency.exponentialRampToValueAtTime(1500, t + 0.35);
    lp.frequency.exponentialRampToValueAtTime(320, t + dur);

    const env = ctx.createGain();
    env.gain.setValueAtTime(0.0001, t);
    env.gain.exponentialRampToValueAtTime(peak, t + 0.18);
    env.gain.setValueAtTime(peak, t + dur * 0.55);
    env.gain.exponentialRampToValueAtTime(0.0001, t + dur);
    drive.connect(lp).connect(env).connect(out);

    const partials: [number, number, number][] = [
      [1, -6, 0.5],
      [1, 6, 0.5],
      [2, -4, 0.35],
      [2, 5, 0.35],
      [3, 2, 0.22], // fifth above the octave
      [4, -3, 0.12],
    ];
    for (const [mult, detune, level] of partials) {
      const osc = ctx.createOscillator();
      osc.type = "sawtooth";
      osc.frequency.value = root * mult;
      osc.detune.value = detune;
      const vg = ctx.createGain();
      vg.gain.value = level;
      osc.connect(vg).connect(drive);
      osc.start(t);
      osc.stop(t + dur + 0.05);
    }
  }

  /** Two-tone klaxon through a horn band, for distant alarms. */
  private klaxon(ctx: AudioContext, out: AudioNode, t: number, cycles: number, peak: number): void {
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.frequency.value = 900;
    band.Q.value = 1.2;
    band.connect(out);
    for (let i = 0; i < cycles; i++) {
      const s0 = t + i * 0.7;
      this.tone(ctx, band, "sawtooth", s0, 440, 440, 0.3, peak, 0.02);
      this.tone(ctx, band, "sawtooth", s0 + 0.33, 349, 349, 0.3, peak, 0.02);
    }
  }

  /** Play a decoded sample as a layer inside a synth voice. */
  private sample(
    ctx: AudioContext,
    out: AudioNode,
    t: number,
    id: string,
    rate: number,
    gain: number,
    offset = 0,
    duration?: number
  ): void {
    const buffer = this.buffers.get(id);
    if (!buffer) return;
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.playbackRate.value = rate;
    const g = ctx.createGain();
    g.gain.value = gain;
    src.connect(g).connect(out);
    src.start(t, offset, duration);
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
    // Distant air-raid siren: a rotor-driven horn, not an oscillator beep.
    // Detuned saw stack + sub-octave square through a horn-shaped band, slow
    // wind-up / wind-down glide, rotating-horn tremolo, then pushed far back
    // with heavy lowpass and a big reverb send (see PROFILES.redZoneSiren).
    this.synths.set("redZoneSiren", (ctx, out, t, g) => {
      const dur = 4.4;
      const peak = 0.22 * g;

      const hp = ctx.createBiquadFilter();
      hp.type = "highpass";
      hp.frequency.value = 110;
      const horn = ctx.createBiquadFilter();
      horn.type = "peaking";
      horn.frequency.value = 650;
      horn.Q.value = 1.1;
      horn.gain.value = 7;
      const distance = ctx.createBiquadFilter();
      distance.type = "lowpass";
      distance.frequency.value = 1300;
      distance.Q.value = 0.5;

      // Rotating horn: amplitude swells as the mouth sweeps past the listener
      const tremolo = ctx.createGain();
      tremolo.gain.value = 0.75;
      const lfo = ctx.createOscillator();
      lfo.frequency.value = 1.3;
      const lfoDepth = ctx.createGain();
      lfoDepth.gain.value = 0.25;
      lfo.connect(lfoDepth).connect(tremolo.gain);

      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.linearRampToValueAtTime(peak, t + 1.1);
      env.gain.setValueAtTime(peak, t + 2.8);
      env.gain.linearRampToValueAtTime(0.0001, t + dur);

      hp.connect(horn).connect(distance).connect(tremolo).connect(env).connect(out);

      const glide = (f: AudioParam, scale: number) => {
        f.setValueAtTime(110 * scale, t);
        f.exponentialRampToValueAtTime(410 * scale, t + 1.7);
        f.setValueAtTime(410 * scale, t + 2.6);
        f.exponentialRampToValueAtTime(190 * scale, t + dur);
      };
      const voices: [OscillatorType, number, number, number][] = [
        ["sawtooth", 1, -9, 0.45],
        ["sawtooth", 1, 8, 0.45],
        ["sawtooth", 1.5, 3, 0.18], // the siren's characteristic fifth
        ["square", 0.5, 0, 0.22],
      ];
      for (const [type, scale, detune, level] of voices) {
        const osc = ctx.createOscillator();
        osc.type = type;
        osc.detune.value = detune;
        glide(osc.frequency, scale);
        const vg = ctx.createGain();
        vg.gain.value = level;
        osc.connect(vg).connect(hp);
        osc.start(t);
        osc.stop(t + dur + 0.05);
      }
      // Wind/rotor hiss under the tone
      this.noiseBurst(ctx, distance, t, dur, 0.05, "bandpass", 500, 900, 1.0);
      lfo.start(t);
      lfo.stop(t + dur + 0.05);
      return dur;
    });

    // Incoming shell: air tearing past (swept band of noise) with only a
    // faint tonal core, rather than a cartoon sine whistle
    this.synths.set("bombWhistle", (ctx, out, t, g) => {
      const dur = 0.95;
      const src = ctx.createBufferSource();
      src.buffer = this.noise;
      src.loop = true;
      const band = ctx.createBiquadFilter();
      band.type = "bandpass";
      band.Q.value = 5;
      band.frequency.setValueAtTime(3400, t);
      band.frequency.exponentialRampToValueAtTime(650, t + dur);
      const env = ctx.createGain();
      env.gain.setValueAtTime(0.0001, t);
      env.gain.exponentialRampToValueAtTime(0.6 * g, t + dur * 0.85);
      env.gain.linearRampToValueAtTime(0.0001, t + dur);
      src.connect(band).connect(env).connect(out);
      src.start(t, Math.random());
      src.stop(t + dur + 0.05);

      const core = ctx.createOscillator();
      core.type = "triangle";
      core.frequency.setValueAtTime(1500, t);
      core.frequency.exponentialRampToValueAtTime(480, t + dur);
      const coreEnv = ctx.createGain();
      coreEnv.gain.setValueAtTime(0.0001, t);
      coreEnv.gain.exponentialRampToValueAtTime(0.035 * g, t + dur * 0.8);
      coreEnv.gain.linearRampToValueAtTime(0.0001, t + dur);
      core.connect(coreEnv).connect(out);
      core.start(t);
      core.stop(t + dur + 0.05);
      return dur;
    });

    // Artillery impact built on real recordings: the explosion sample pitched
    // down for weight, a metal-impact transient, a sub drop, a long ground
    // rumble and scattered debris after the hit
    this.synths.set("bombBlast", (ctx, out, t, g) => {
      const rate = 0.6 + Math.random() * 0.12;
      this.sample(ctx, out, t, "npcImpact", rate, 1.3 * g);
      this.sample(ctx, out, t, "shellImpact", 0.75 + Math.random() * 0.1, 0.35 * g, 0.117);
      this.tone(ctx, out, "sine", t, 62, 24, 1.3, 1.0 * g, 0.004);
      this.noiseBurst(ctx, out, t + 0.02, 1.9, 0.45 * g, "lowpass", 700, 45, 0.02);
      for (let i = 0; i < 5; i++) {
        const at = t + 0.18 + Math.random() * 0.55;
        this.noiseBurst(ctx, out, at, 0.04, (0.06 + Math.random() * 0.06) * g, "bandpass", 2500, 1800, 0.001);
      }
      return 2.0;
    });

    // Boss imminent: cinematic brass "braaam" hits over a sub impact, with
    // the base klaxon pushed far back into the reverb instead of up front
    this.synths.set("bossAlarm", (ctx, out, t, g) => {
      this.sample(ctx, out, t, "npcImpact", 0.45, 1.1 * g);
      this.sample(ctx, out, t, "shellImpact", 0.6, 0.5 * g, 0.117);
      this.tone(ctx, out, "sine", t, 48, 22, 2.2, 1.1 * g, 0.01);

      this.braaam(ctx, out, t + 0.05, 55, 1.5, 0.5 * g);
      this.braaam(ctx, out, t + 1.45, 51.9, 1.9, 0.55 * g); // down a semitone

      // Taiko-style double hit between the horns
      for (const at of [1.15, 1.32]) {
        this.tone(ctx, out, "sine", t + at, 110, 45, 0.35, 0.7 * g, 0.003);
        this.noiseBurst(ctx, out, t + at, 0.12, 0.25 * g, "lowpass", 900, 200, 0.002);
      }

      this.klaxon(ctx, out, t + 0.2, 3, 0.05 * g);
      return 3.6;
    });

    // Short distant klaxon: boss radioing in its bomber escort
    this.synths.set("bossEscort", (ctx, out, t, g) => {
      this.klaxon(ctx, out, t, 2, 0.12 * g);
      return 1.5;
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

    // Armory upgrade installed: double latch clunk, a short servo run-up,
    // then a warm two-note bell confirm (inharmonic partials, no bright arp)
    this.synths.set("upgradePurchase", (ctx, out, t, g) => {
      for (const at of [0, 0.085]) {
        this.noiseBurst(ctx, out, t + at, 0.035, 0.32 * g, "bandpass", 1900, 1400, 0.001);
        this.tone(ctx, out, "sine", t + at, 160, 70, 0.12, 0.55 * g, 0.002);
      }

      const servo = ctx.createBiquadFilter();
      servo.type = "lowpass";
      servo.frequency.value = 1100;
      servo.connect(out);
      this.tone(ctx, servo, "sawtooth", t + 0.03, 170, 480, 0.2, 0.06 * g, 0.02);

      const bell = (at: number, f: number, peak: number) => {
        this.tone(ctx, out, "sine", t + at, f, f, 0.85, peak * g, 0.004);
        this.tone(ctx, out, "sine", t + at, f * 2.756, f * 2.756, 0.28, peak * 0.35 * g, 0.002);
        this.tone(ctx, out, "sine", t + at, f * 0.5, f * 0.5, 0.6, peak * 0.4 * g, 0.006);
      };
      bell(0.2, 392.0, 0.22); // G4
      bell(0.32, 587.3, 0.2); // D5
      return 1.2;
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

  private startVoice(
    id: string,
    loop: boolean,
    volume: number,
    lowpassHz?: number
  ): Voice | null {
    const ctx = this.ctx!;
    const t = ctx.currentTime;
    const profile = PROFILES[id] || {};
    // Same clamp the HTMLAudio path had, so existing call-site volumes keep their balance
    const effective =
      Math.min(1, globalVolumeSettings.getEffectiveVolume(volume)) * (profile.trim ?? 1);
    if (effective <= 0) return null;

    const gain = ctx.createGain();
    gain.gain.value = effective;
    // Optional air absorption: far sounds lose their top end before the bus
    let dry: AudioNode = gain;
    if (lowpassHz !== undefined) {
      const air = ctx.createBiquadFilter();
      air.type = "lowpass";
      air.frequency.value = lowpassHz;
      gain.connect(air);
      dry = air;
    }
    const blend = profile.dry ? 0 : profile.blend ?? 1;
    if (blend >= 1) {
      dry.connect(this.busIn!);
    } else if (blend <= 0) {
      dry.connect(ctx.destination);
    } else {
      const direct = ctx.createGain();
      direct.gain.value = 1 - blend;
      dry.connect(direct).connect(ctx.destination);
      const wet = ctx.createGain();
      wet.gain.value = blend;
      dry.connect(wet).connect(this.busIn!);
    }
    if (profile.reverb && blend > 0) {
      const send = ctx.createGain();
      send.gain.value = profile.reverb;
      dry.connect(send).connect(this.reverbIn!);
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
      for (const { kind, gain: g } of profile.layers) this.layer(kind, gain, t, g);
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

  /**
   * Play at a world distance from the listener: gain falls off and the top
   * end rolls away, so far shelling rumbles instead of sounding thin.
   */
  public playSpatial(id: string, volume: number, distance: number, minDelay = 0): void {
    if (!this.ctx) {
      this.playAt(id, volume * Math.max(0.05, 1 - distance / 55), minDelay);
      return;
    }
    const now = Date.now();
    if (now - (this.lastPlayTime.get(id) || 0) < minDelay) return;
    if (this.ctx.state === "suspended") this.ctx.resume().catch(() => undefined);
    const d = Math.max(0, distance);
    const falloff = 1 / (1 + (d / 14) ** 2);
    const cutoff = 18000 * Math.exp(-d / 12) + 450;
    const voice = this.startVoice(id, false, volume * Math.max(0.04, falloff), cutoff);
    // Separate voice pool so a distant boss shot never cuts off the player's own
    if (voice) this.trackVoice(`${id}@spatial`, voice, PROFILES[id]?.maxVoices ?? 4);
    this.lastPlayTime.set(id, now);
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
