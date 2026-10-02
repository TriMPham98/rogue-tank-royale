/**
 * Pooled particle effects (explosions, sparks, smoke, dust, decals, debris).
 *
 * Pure data: gameplay code calls the `fx.*` helpers from anywhere (store slices,
 * useFrame loops) and <FxLayer /> uploads the live pools to the GPU each frame.
 * Nothing here allocates per spawn, and nothing touches React state.
 */

export class ParticlePool {
  readonly capacity: number;
  count = 0;

  // Simulation state (structure of arrays, swap-remove on death)
  readonly px: Float32Array;
  readonly py: Float32Array;
  readonly pz: Float32Array;
  readonly vx: Float32Array;
  readonly vy: Float32Array;
  readonly vz: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;
  readonly size0: Float32Array;
  readonly size1: Float32Array;
  readonly c0: Float32Array; // rgb start
  readonly c1: Float32Array; // rgb end
  readonly a0: Float32Array;
  readonly a1: Float32Array;
  readonly fadeStart: Float32Array;
  readonly drag: Float32Array;
  readonly gravity: Float32Array;
  readonly rot: Float32Array;
  readonly rotVel: Float32Array;
  readonly stretch: Float32Array;

  // GPU-facing instance attributes (written by update)
  readonly iPos: Float32Array; // vec3
  readonly iColor: Float32Array; // vec4
  readonly iSizeRot: Float32Array; // vec2
  readonly iVel: Float32Array; // vec4 (velocity, stretch)

  constructor(capacity: number) {
    this.capacity = capacity;
    const f = () => new Float32Array(capacity);
    this.px = f();
    this.py = f();
    this.pz = f();
    this.vx = f();
    this.vy = f();
    this.vz = f();
    this.age = f();
    this.life = f();
    this.size0 = f();
    this.size1 = f();
    this.c0 = new Float32Array(capacity * 3);
    this.c1 = new Float32Array(capacity * 3);
    this.a0 = f();
    this.a1 = f();
    this.fadeStart = f();
    this.drag = f();
    this.gravity = f();
    this.rot = f();
    this.rotVel = f();
    this.stretch = f();
    this.iPos = new Float32Array(capacity * 3);
    this.iColor = new Float32Array(capacity * 4);
    this.iSizeRot = new Float32Array(capacity * 2);
    this.iVel = new Float32Array(capacity * 4);
  }

  /** Spawn from the shared spec `P`. Oldest-first overwrite when full. */
  emit(): void {
    let i = this.count;
    if (i >= this.capacity) {
      // Recycle a random slot rather than dropping the newest (and usually most visible) effect
      i = (Math.random() * this.capacity) | 0;
    } else {
      this.count++;
    }
    this.px[i] = P.x;
    this.py[i] = P.y;
    this.pz[i] = P.z;
    this.vx[i] = P.vx;
    this.vy[i] = P.vy;
    this.vz[i] = P.vz;
    this.age[i] = 0;
    this.life[i] = P.life;
    this.size0[i] = P.size0;
    this.size1[i] = P.size1;
    this.c0[i * 3] = P.r0;
    this.c0[i * 3 + 1] = P.g0;
    this.c0[i * 3 + 2] = P.b0;
    this.c1[i * 3] = P.r1;
    this.c1[i * 3 + 1] = P.g1;
    this.c1[i * 3 + 2] = P.b1;
    this.a0[i] = P.a0;
    this.a1[i] = P.a1;
    this.fadeStart[i] = P.fadeStart;
    this.drag[i] = P.drag;
    this.gravity[i] = P.gravity;
    this.rot[i] = P.rot;
    this.rotVel[i] = P.rotVel;
    this.stretch[i] = P.stretch;
  }

  private kill(i: number): void {
    const last = --this.count;
    if (i === last) return;
    this.px[i] = this.px[last];
    this.py[i] = this.py[last];
    this.pz[i] = this.pz[last];
    this.vx[i] = this.vx[last];
    this.vy[i] = this.vy[last];
    this.vz[i] = this.vz[last];
    this.age[i] = this.age[last];
    this.life[i] = this.life[last];
    this.size0[i] = this.size0[last];
    this.size1[i] = this.size1[last];
    for (let k = 0; k < 3; k++) {
      this.c0[i * 3 + k] = this.c0[last * 3 + k];
      this.c1[i * 3 + k] = this.c1[last * 3 + k];
    }
    this.a0[i] = this.a0[last];
    this.a1[i] = this.a1[last];
    this.fadeStart[i] = this.fadeStart[last];
    this.drag[i] = this.drag[last];
    this.gravity[i] = this.gravity[last];
    this.rot[i] = this.rot[last];
    this.rotVel[i] = this.rotVel[last];
    this.stretch[i] = this.stretch[last];
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      const age = this.age[i] + dt;
      if (age >= this.life[i]) {
        this.kill(i);
        continue; // slot i now holds a different particle
      }
      this.age[i] = age;
      const t = age / this.life[i];

      const damp = Math.exp(-this.drag[i] * dt);
      this.vx[i] *= damp;
      this.vz[i] *= damp;
      this.vy[i] = this.vy[i] * damp - this.gravity[i] * dt;
      this.px[i] += this.vx[i] * dt;
      this.py[i] += this.vy[i] * dt;
      this.pz[i] += this.vz[i] * dt;
      if (this.py[i] < 0.03 && this.vy[i] < 0) {
        this.py[i] = 0.03;
        this.vy[i] *= -0.3;
        this.vx[i] *= 0.6;
        this.vz[i] *= 0.6;
      }
      this.rot[i] += this.rotVel[i] * dt;

      // Ease-out growth reads as a burst that settles
      const grow = 1 - (1 - t) * (1 - t);
      const size = this.size0[i] + (this.size1[i] - this.size0[i]) * grow;
      const fs = this.fadeStart[i];
      const ft = t <= fs ? 0 : (t - fs) / (1 - fs);
      const fadeIn = Math.min(1, age / 0.05);
      const alpha = (this.a0[i] + (this.a1[i] - this.a0[i]) * ft) * fadeIn;

      const i3 = i * 3;
      const i4 = i * 4;
      this.iPos[i3] = this.px[i];
      this.iPos[i3 + 1] = this.py[i];
      this.iPos[i3 + 2] = this.pz[i];
      this.iColor[i4] = this.c0[i3] + (this.c1[i3] - this.c0[i3]) * t;
      this.iColor[i4 + 1] = this.c0[i3 + 1] + (this.c1[i3 + 1] - this.c0[i3 + 1]) * t;
      this.iColor[i4 + 2] = this.c0[i3 + 2] + (this.c1[i3 + 2] - this.c0[i3 + 2]) * t;
      this.iColor[i4 + 3] = alpha;
      this.iSizeRot[i * 2] = size;
      this.iSizeRot[i * 2 + 1] = this.rot[i];
      this.iVel[i4] = this.vx[i];
      this.iVel[i4 + 1] = this.vy[i];
      this.iVel[i4 + 2] = this.vz[i];
      this.iVel[i4 + 3] = this.stretch[i];
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }
}

/** Tumbling debris chunks (rendered as lit instanced boxes). */
export class DebrisPool {
  readonly capacity: number;
  count = 0;
  readonly pos: Float32Array;
  readonly vel: Float32Array;
  readonly rot: Float32Array;
  readonly spin: Float32Array;
  readonly scale: Float32Array;
  readonly age: Float32Array;
  readonly life: Float32Array;

  constructor(capacity: number) {
    this.capacity = capacity;
    this.pos = new Float32Array(capacity * 3);
    this.vel = new Float32Array(capacity * 3);
    this.rot = new Float32Array(capacity * 3);
    this.spin = new Float32Array(capacity * 3);
    this.scale = new Float32Array(capacity * 3);
    this.age = new Float32Array(capacity);
    this.life = new Float32Array(capacity);
  }

  emit(x: number, y: number, z: number, speed: number, size: number): void {
    let i = this.count;
    if (i >= this.capacity) i = (Math.random() * this.capacity) | 0;
    else this.count++;
    const a = Math.random() * Math.PI * 2;
    const s = speed * (0.5 + Math.random() * 0.7);
    const i3 = i * 3;
    this.pos[i3] = x;
    this.pos[i3 + 1] = y;
    this.pos[i3 + 2] = z;
    this.vel[i3] = Math.cos(a) * s;
    this.vel[i3 + 1] = 3 + Math.random() * 4 * (speed / 5);
    this.vel[i3 + 2] = Math.sin(a) * s;
    for (let k = 0; k < 3; k++) {
      this.rot[i3 + k] = Math.random() * 6;
      this.spin[i3 + k] = rand(-9, 9);
    }
    this.scale[i3] = size * rand(0.6, 1.4);
    this.scale[i3 + 1] = size * rand(0.3, 0.8);
    this.scale[i3 + 2] = size * rand(0.6, 1.2);
    this.age[i] = 0;
    this.life[i] = rand(1.6, 2.6);
  }

  update(dt: number): void {
    let i = 0;
    while (i < this.count) {
      this.age[i] += dt;
      if (this.age[i] >= this.life[i]) {
        const last = --this.count;
        if (i !== last) {
          this.pos.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.vel.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.rot.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.spin.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.scale.copyWithin(i * 3, last * 3, last * 3 + 3);
          this.age[i] = this.age[last];
          this.life[i] = this.life[last];
        }
        continue;
      }
      const i3 = i * 3;
      this.vel[i3 + 1] -= 14 * dt;
      this.pos[i3] += this.vel[i3] * dt;
      this.pos[i3 + 1] += this.vel[i3 + 1] * dt;
      this.pos[i3 + 2] += this.vel[i3 + 2] * dt;
      const floor = this.scale[i3 + 1] * 0.5;
      if (this.pos[i3 + 1] < floor) {
        this.pos[i3 + 1] = floor;
        this.vel[i3 + 1] *= -0.35;
        this.vel[i3] *= 0.55;
        this.vel[i3 + 2] *= 0.55;
        this.spin[i3] *= 0.5;
        this.spin[i3 + 1] *= 0.5;
        this.spin[i3 + 2] *= 0.5;
      }
      this.rot[i3] += this.spin[i3] * dt;
      this.rot[i3 + 1] += this.spin[i3 + 1] * dt;
      this.rot[i3 + 2] += this.spin[i3 + 2] * dt;
      i++;
    }
  }

  clear(): void {
    this.count = 0;
  }
}

// ---------------------------------------------------------------------------
// Shared spawn spec (filled by helpers below, consumed by ParticlePool.emit)
// ---------------------------------------------------------------------------

const P = {
  x: 0,
  y: 0,
  z: 0,
  vx: 0,
  vy: 0,
  vz: 0,
  life: 1,
  size0: 1,
  size1: 1,
  r0: 1,
  g0: 1,
  b0: 1,
  r1: 1,
  g1: 1,
  b1: 1,
  a0: 1,
  a1: 0,
  fadeStart: 0,
  drag: 0,
  gravity: 0,
  rot: 0,
  rotVel: 0,
  stretch: 0,
};

function rand(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function setColors(c0: number, c1: number = c0): void {
  P.r0 = ((c0 >> 16) & 255) / 255;
  P.g0 = ((c0 >> 8) & 255) / 255;
  P.b0 = (c0 & 255) / 255;
  P.r1 = ((c1 >> 16) & 255) / 255;
  P.g1 = ((c1 >> 8) & 255) / 255;
  P.b1 = (c1 & 255) / 255;
}

function reset(x: number, y: number, z: number): void {
  P.x = x;
  P.y = y;
  P.z = z;
  P.vx = 0;
  P.vy = 0;
  P.vz = 0;
  P.a0 = 1;
  P.a1 = 0;
  P.fadeStart = 0;
  P.drag = 0;
  P.gravity = 0;
  P.rot = Math.random() * Math.PI * 2;
  P.rotVel = 0;
  P.stretch = 0;
}

export const pools = {
  glow: new ParticlePool(1400),
  smoke: new ParticlePool(700),
  ring: new ParticlePool(48),
  scorch: new ParticlePool(64),
  debris: new DebrisPool(96),
};

export function clearAllFx(): void {
  pools.glow.clear();
  pools.smoke.clear();
  pools.ring.clear();
  pools.scorch.clear();
  pools.debris.clear();
}

export function updateFx(dt: number): void {
  // Clamp so a background-tab resume does not teleport everything
  const step = Math.min(dt, 1 / 20);
  pools.glow.update(step);
  pools.smoke.update(step);
  pools.ring.update(step);
  pools.scorch.update(step);
  pools.debris.update(step);
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

export const FX_COLORS = {
  fireHot: 0xfff2c4,
  fire: 0xffa23a,
  fireDeep: 0xd8420e,
  ember: 0xff6a1a,
  smokeLight: 0x8a8580,
  smokeDark: 0x2b2826,
  dust: 0x9b8763,
  spark: 0xffd27a,
  playerShot: 0xffc457,
  enemyShot: 0xff4a3a,
  laser: 0x5ff6ff,
  tesla: 0x8fdcff,
  health: 0x6dff8e,
  coin: 0xffd54a,
} as const;

// ---------------------------------------------------------------------------
// High-level effects
// ---------------------------------------------------------------------------

function sparks(
  x: number,
  y: number,
  z: number,
  count: number,
  speed: number,
  color: number,
  life = 0.45,
  size = 0.09
): void {
  for (let i = 0; i < count; i++) {
    reset(x, y, z);
    const a = Math.random() * Math.PI * 2;
    const up = rand(0.15, 1);
    const s = speed * rand(0.4, 1);
    P.vx = Math.cos(a) * s * (1 - up * 0.5);
    P.vz = Math.sin(a) * s * (1 - up * 0.5);
    P.vy = up * s;
    P.life = life * rand(0.6, 1.2);
    P.size0 = size;
    P.size1 = size * 0.5;
    setColors(0xffffff, color);
    P.a0 = 1;
    P.a1 = 0;
    P.fadeStart = 0.3;
    P.gravity = 9;
    P.drag = 2.2;
    P.stretch = 0.09;
    pools.glow.emit();
  }
}

function flash(x: number, y: number, z: number, size: number, color: number, life = 0.12): void {
  reset(x, y, z);
  P.life = life;
  P.size0 = size * 0.6;
  P.size1 = size;
  setColors(0xffffff, color);
  P.a0 = 1;
  P.a1 = 0;
  pools.glow.emit();
}

function ring(x: number, z: number, radius: number, color: number, life = 0.45, alpha = 0.9): void {
  reset(x, 0.06, z);
  P.life = life;
  P.size0 = radius * 0.2;
  P.size1 = radius * 2;
  setColors(color);
  P.a0 = alpha;
  P.a1 = 0;
  P.rot = 0;
  pools.ring.emit();
}

function smoke(
  x: number,
  y: number,
  z: number,
  count: number,
  spread: number,
  size: number,
  life: number,
  c0: number,
  c1: number,
  alpha: number,
  rise: number
): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = Math.random() * spread;
    reset(x + Math.cos(a) * r, y + Math.random() * spread * 0.5, z + Math.sin(a) * r);
    P.vx = Math.cos(a) * rand(0.3, 1.2) * spread;
    P.vz = Math.sin(a) * rand(0.3, 1.2) * spread;
    P.vy = rise * rand(0.6, 1.3);
    P.life = life * rand(0.75, 1.25);
    P.size0 = size * rand(0.5, 0.8);
    P.size1 = size * rand(1.4, 2.1);
    setColors(c0, c1);
    P.a0 = alpha;
    P.a1 = 0;
    P.fadeStart = 0.2;
    P.drag = 1.6;
    P.gravity = -0.25;
    P.rotVel = rand(-0.6, 0.6);
    pools.smoke.emit();
  }
}

function fireball(x: number, y: number, z: number, count: number, radius: number, life: number): void {
  for (let i = 0; i < count; i++) {
    const a = Math.random() * Math.PI * 2;
    const e = Math.random() * 0.9;
    const s = radius * rand(1.2, 3.2);
    reset(x, y, z);
    P.vx = Math.cos(a) * Math.cos(e) * s;
    P.vz = Math.sin(a) * Math.cos(e) * s;
    P.vy = Math.sin(e) * s + radius;
    P.life = life * rand(0.6, 1.1);
    P.size0 = radius * rand(0.5, 0.9);
    P.size1 = radius * rand(1.1, 1.8);
    setColors(i % 3 === 0 ? FX_COLORS.fireHot : FX_COLORS.fire, FX_COLORS.fireDeep);
    P.a0 = 0.95;
    P.a1 = 0;
    P.fadeStart = 0.25;
    P.drag = 4.5;
    P.gravity = -1.5;
    P.rotVel = rand(-2, 2);
    pools.glow.emit();
  }
}

function scorch(x: number, z: number, size: number): void {
  reset(x, 0.035, z);
  P.life = 24;
  P.size0 = size;
  P.size1 = size * 1.05;
  setColors(0x120d09);
  P.a0 = 0.78;
  P.a1 = 0;
  P.fadeStart = 0.7;
  pools.scorch.emit();
}

export const fx = {
  /** Vehicle destroyed: fireball, smoke column, sparks, debris, shockwave, scorch decal. */
  explosion(x: number, y: number, z: number, scale = 1): void {
    const yy = Math.max(0.4, y + 0.3);
    flash(x, yy, z, 5.5 * scale, FX_COLORS.fire, 0.16);
    fireball(x, yy, z, Math.round(12 * scale), 0.85 * scale, 0.7);
    sparks(x, yy, z, Math.round(22 * scale), 11 * scale, FX_COLORS.spark, 0.8, 0.12);
    smoke(x, yy + 0.3, z, Math.round(9 * scale), 0.9 * scale, 1.5 * scale, 2.4, 0x4a4440, FX_COLORS.smokeDark, 0.72, 1.6);
    ring(x, z, 3.2 * scale, FX_COLORS.fire, 0.5);
    scorch(x, z, 3.4 * scale);
    for (let i = 0; i < Math.round(6 * scale); i++) {
      pools.debris.emit(x, yy, z, 5 * scale, 0.22 * scale);
    }
  },

  /** Mortar/rocket blast sized to its splash radius. */
  blast(x: number, y: number, z: number, radius: number): void {
    const s = radius / 4;
    const yy = Math.max(0.3, y);
    flash(x, yy, z, radius * 1.4, FX_COLORS.fire, 0.18);
    fireball(x, yy, z, 14, 0.8 * s, 0.6);
    sparks(x, yy, z, 26, 13 * s, FX_COLORS.spark, 0.7, 0.11);
    smoke(x, yy + 0.2, z, 10, 1.2 * s, 1.6 * s, 2.0, 0x6a625a, FX_COLORS.smokeDark, 0.6, 1.4);
    smoke(x, 0.2, z, 8, 2.2 * s, 1.2 * s, 1.4, FX_COLORS.dust, 0x6b5d45, 0.55, 0.3);
    ring(x, z, radius * 1.05, FX_COLORS.fire, 0.42);
    scorch(x, z, radius * 0.9);
  },

  /** Shell striking armour. */
  impact(x: number, y: number, z: number, color: number = FX_COLORS.spark, scale = 1): void {
    flash(x, y, z, 1.4 * scale, color, 0.1);
    sparks(x, y, z, Math.round(7 * scale), 6 * scale, color, 0.35, 0.08);
    smoke(x, y, z, 1, 0.25, 0.45 * scale, 0.7, 0x77716a, 0x3a3633, 0.35, 0.6);
  },

  /** Shell striking rock / ground. */
  ricochet(x: number, y: number, z: number, color: number = FX_COLORS.spark): void {
    flash(x, y, z, 0.9, color, 0.08);
    sparks(x, y, z, 5, 5, color, 0.3, 0.07);
    smoke(x, y, z, 3, 0.35, 0.55, 0.9, FX_COLORS.dust, 0x5d523f, 0.5, 0.4);
  },

  /** Muzzle flash + a puff of propellant smoke drifting forward. */
  muzzle(
    x: number,
    y: number,
    z: number,
    dirX: number,
    dirZ: number,
    color: number = FX_COLORS.fire,
    scale = 1
  ): void {
    flash(x, y, z, 1.5 * scale, color, 0.09);
    for (let i = 0; i < 3; i++) {
      reset(x + dirX * 0.15 * i, y, z + dirZ * 0.15 * i);
      P.vx = dirX * rand(4, 8) * scale;
      P.vz = dirZ * rand(4, 8) * scale;
      P.life = 0.12;
      P.size0 = 0.5 * scale;
      P.size1 = 0.25 * scale;
      setColors(FX_COLORS.fireHot, color);
      P.drag = 10;
      P.stretch = 0.05;
      pools.glow.emit();
    }
    reset(x, y, z);
    P.vx = dirX * 1.6;
    P.vz = dirZ * 1.6;
    P.vy = 0.5;
    P.life = 0.9;
    P.size0 = 0.35 * scale;
    P.size1 = 1.1 * scale;
    setColors(0x9a948c, 0x4d4945);
    P.a0 = 0.38;
    P.drag = 2.5;
    P.rotVel = rand(-1, 1);
    pools.smoke.emit();
  },

  /** Track dust kicked up behind a moving vehicle. */
  dust(x: number, z: number, scale = 1): void {
    reset(x + rand(-0.15, 0.15), 0.12, z + rand(-0.15, 0.15));
    P.vx = rand(-0.35, 0.35);
    P.vz = rand(-0.35, 0.35);
    P.vy = rand(0.25, 0.6);
    P.life = rand(0.9, 1.4);
    P.size0 = 0.3 * scale;
    P.size1 = 1.0 * scale;
    setColors(FX_COLORS.dust, 0x7d6e52);
    P.a0 = 0.34;
    P.fadeStart = 0.1;
    P.drag = 1.8;
    P.rotVel = rand(-0.8, 0.8);
    pools.smoke.emit();
  },

  /** Rocket exhaust trail puff. */
  trail(x: number, y: number, z: number): void {
    reset(x, y, z);
    P.vy = 0.25;
    P.life = rand(0.7, 1.1);
    P.size0 = 0.18;
    P.size1 = 0.7;
    setColors(0xc8c2b8, 0x5a5650);
    P.a0 = 0.45;
    P.drag = 1;
    P.rotVel = rand(-1, 1);
    pools.smoke.emit();
    reset(x, y, z);
    P.life = 0.12;
    P.size0 = 0.35;
    P.size1 = 0.15;
    setColors(FX_COLORS.fireHot, FX_COLORS.ember);
    pools.glow.emit();
  },

  /** Electric strike (tesla / laser contact point). */
  zap(x: number, y: number, z: number, color: number = FX_COLORS.tesla, scale = 1): void {
    flash(x, y, z, 1.6 * scale, color, 0.12);
    sparks(x, y, z, Math.round(6 * scale), 5 * scale, color, 0.25, 0.06);
  },

  /** Pickup collected. */
  pickup(x: number, y: number, z: number, color: number): void {
    flash(x, y, z, 2.2, color, 0.2);
    ring(x, z, 1.6, color, 0.5, 0.8);
    for (let i = 0; i < 14; i++) {
      reset(x + rand(-0.4, 0.4), y + rand(-0.3, 0.3), z + rand(-0.4, 0.4));
      P.vy = rand(1.5, 3.5);
      P.vx = rand(-0.6, 0.6);
      P.vz = rand(-0.6, 0.6);
      P.life = rand(0.5, 0.8);
      P.size0 = 0.14;
      P.size1 = 0.05;
      setColors(0xffffff, color);
      P.drag = 2;
      P.stretch = 0.08;
      pools.glow.emit();
    }
  },
};
