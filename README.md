# Rogue Tank Royale

![Start Screen](/public/assets/images/startScreen.png)

![Loading Screen](/public/assets/images/loading.png)

![Early Game](/public/assets/images/earlyGame.png)

![Attribute Upgrade](/public/assets/images/attributeUpgrade.png)

![Secondary Upgrade](/public/assets/images/secondaryUpgrade.png)

![End Game](/public/assets/images/endGame.png)

A roguelike tank game built with React and Three.js. Fight waves of enemy tanks in a procedurally lit arena, earn upgrades, and mount secondary weapons as the containment zone closes in.

## Features

- 3D tank combat with auto-firing primary cannon
- Secondary weapons: Mortar, Laser, Shotgun, Sniper, Tesla Coil
- Procedural difficulty scaling and safe-zone shrinkage
- Enemy types: tanks, stationary turrets, kamikaze bombers
- Power-ups: health packs and coins (spend coins from the pause menu)
- Stat upgrades and multi-weapon loadouts
- Third-person follow camera + first-person view
- Mobile dual-joystick controls
- Zustand state slices, spatial hashing, pooled/instanced primary projectiles

## Controls

### Desktop

| Input | Action |
|-------|--------|
| **W / A / S / D** | Move |
| **J / K** | Rotate turret |
| **V** | Toggle first-person view |
| **ESC** | Pause / field supply shop |
| **1–3** | Pick upgrade (when upgrade UI is open) |
| **1–4** | Pick secondary weapon (when weapon select is open) |

Primary turret fire is automatic. Secondary weapons track and fire on their own cooldowns.

### Mobile

- Left joystick: move
- Right joystick: aim turret
- Pause button: open pause / field supply

## Power-ups

- **Health (red)** — restore hull integrity
- **Coins (gold)** — spend in pause menu:
  - **Field Repair** — heal (costs coins)
  - **Reinforced Plating** — +max health (costs coins)

## Enemies

- **Red tanks** — chase and shoot
- **Blue turrets** — stationary, track and fire
- **Yellow bombers** — rush and explode on contact

## Architecture

Zustand store composed of slices:

1. **Player / Enemy / Game flow / Safe zone / Weapons / Input / Terrain**
2. **Components** — React UI + R3F scene
3. **Models** — tanks, enemies, secondary weapons
4. **Systems** — projectile pool, spatial hash, level generation

## Development

### Prerequisites

- Node.js 18+
- npm

### Installation

```bash
git clone https://github.com/yourusername/rogue-tank-royale.git
cd rogue-tank-royale
npm install
npm run dev
```

Open `http://localhost:5173`.

### Scripts

| Command | Purpose |
|---------|---------|
| `npm run dev` | Vite dev server |
| `npm run build` | Typecheck + production build |
| `npm run test:run` | Vitest once |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run lint` | ESLint |

### Dev shortcuts (desktop)

- **Shift+L** — advance level (dev)
- **Shift+F / P / H** — FPS / performance dumps (dev)

## Technology Stack

- **React** + **TypeScript**
- **Three.js** via **React Three Fiber** / **Drei**
- **Zustand**
- **Vite** + **Vitest**
