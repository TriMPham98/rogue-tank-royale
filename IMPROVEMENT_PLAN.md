# Rogue Tank Royale - Codebase Improvement Plan

## Overview
The game is well-structured (~8,500 LOC across 43 files) with React Three Fiber + Zustand + TypeScript. The following improvements are prioritized by impact and effort.

---

## Phase 1: Quick Wins (Low Effort, High Impact) - COMPLETED

### 1.1 Optimize Zustand Re-renders - COMPLETED
**Files:** `GameScene.tsx`, `GameUI.tsx`, `Tank.tsx`

Replaced manual state subscriptions with shallow selectors:
```typescript
// Before (causes unnecessary re-renders)
const [enemies, setEnemies] = useState(getState().enemies);
useEffect(() => {
  const unsubscribe = useGameState.subscribe(...);
}, [enemies]);

// After (optimized)
import { shallow } from 'zustand/shallow';
const enemies = useGameState((state) => state.enemies, shallow);
```

### 1.2 Memoize Vector3 Objects in useFrame - COMPLETED
**Files:** `EnemyTank.tsx`, `Tank.tsx`, projectile files

Avoided creating new Vector3 objects every frame:
```typescript
// Before (creates garbage every frame)
useFrame(() => {
  const dir = playerPos.clone().sub(currentPos);
});

// After (reuse refs)
const tempVec = useMemo(() => new Vector3(), []);
useFrame(() => {
  tempVec.copy(playerPos).sub(currentPos);
});
```

### 1.3 Consolidate Type Definitions - COMPLETED
**Created:** `/src/types/index.ts` as single source of truth

Consolidated `SecondaryWeapon` (was defined in 3 places) and other types into one location.

### 1.4 Extract Magic Numbers to Constants - COMPLETED
**Created:** `/src/constants/game.ts`
```typescript
export const GAME_CONSTANTS = {
  MAP_SIZE: 100,
  HALF_MAP_SIZE: 50,
  SPAWN_CLEARANCE_RADIUS: 15,
  MAX_ENEMIES: 20,
  COIN_DROP_CHANCE: 0.05,
  // ... and many more
} as const;
```

---

## Phase 2: Architecture Refactoring (Medium Effort, High Impact) - COMPLETED

### 2.1 Split `gameState.ts` (997 lines) - COMPLETED
**Created state slices:**
- `/src/state/types.ts` - All slice type definitions
- `/src/state/playerSlice.ts` - Health, stats, upgrades, position
- `/src/state/enemySlice.ts` - Enemy and power-up management
- `/src/state/gameFlowSlice.ts` - Pause, game over, levels, score
- `/src/state/safeZoneSlice.ts` - Zone logic and calculations
- `/src/state/weaponSlice.ts` - Weapon selection
- `/src/state/inputSlice.ts` - Player input state
- `/src/state/terrainSlice.ts` - Terrain obstacles
- `/src/state/index.ts` - Combined store with all slices
- `/src/utils/gameState.ts` - Re-exports for backward compatibility

### 2.2 Split `GameUI.tsx` (774 → 595 lines) - COMPLETED
**Created components:**
- `/src/components/ui/HUD.tsx` - Health, score, rank display
- `/src/components/ui/PlayerStatsPanel.tsx` - Stats display
- `/src/components/ui/WarningOverlays.tsx` - Zone/combat warnings (4 components)
- `/src/components/ui/PauseMenu.tsx` - Pause menu
- `/src/components/ui/GameOverScreen.tsx` - Game over screen
- `/src/components/ui/SettingsModal.tsx` - Settings dialog
- `/src/components/ui/ConfirmDialog.tsx` - Confirmation dialog

### 2.3 DRY Tank Code - COMPLETED
**Before:** `Tank.tsx` (690 lines) and `EnemyTank.tsx` (701 lines) had duplicate collision/projectile logic

**Created shared hooks:**
- `/src/hooks/useTankCollision.ts` (94 lines) - Terrain/obstacle collision detection
- `/src/hooks/useProjectileManager.ts` (55 lines) - Projectile spawning and removal

**After:** Tank.tsx (664 lines), EnemyTank.tsx (628 lines) - cleaner code with shared logic

---

## Phase 3: Testing & Quality (Medium Effort, High Impact) - COMPLETED

### 3.1 Add Unit Testing - COMPLETED
**Setup:** Added Vitest with testing utilities
```bash
npm install -D vitest @testing-library/react jsdom @testing-library/jest-dom
```

**Created test files (45 tests total):**
- `/src/state/safeZoneSlice.test.ts` - Safe zone calculations (13 tests)
- `/src/utils/levelGenerator.test.ts` - Enemy generation formulas (19 tests)
- `/src/hooks/useTankCollision.test.ts` - Collision detection (13 tests)

**Added scripts:**
- `npm run test` - Run tests in watch mode
- `npm run test:run` - Run tests once
- `npm run test:coverage` - Run tests with coverage

### 3.2 Add Pre-commit Hooks - COMPLETED
```bash
npm install -D husky lint-staged
```

**Configuration:**
- Husky pre-commit hook runs:
  - `lint-staged` - ESLint --fix on staged files
  - `npm run typecheck` - Full TypeScript type checking
- Prevents broken commits by failing on ESLint errors or TypeScript errors

---

## Phase 4: Performance Optimizations (High Effort, High Impact) - COMPLETED

### 4.1 InstancedMesh Optimizations - COMPLETED
**Created:**
- `/src/components/InstancedHealthBars.tsx` - Renders all enemy health bars with 2 draw calls
- `/src/components/InstancedProjectiles.tsx` - InstancedMesh-based projectile rendering
- `/src/utils/sharedMaterials.ts` - Shared material cache to reduce GPU memory

**Benefits:**
- Health bars: Reduced from 2N draw calls to 2 draw calls
- Projectiles: Single draw call per type instead of per-projectile
- Materials: Shared instances reduce memory allocation

### 4.2 Spatial Partitioning for Collisions - COMPLETED
**Created:**
- `/src/utils/spatialHash.ts` - Grid-based spatial hash data structure
- `/src/hooks/useSpatialHash.ts` - React hooks for obstacle/enemy spatial queries

**Benefits:**
- Collision detection: O(n²) → O(n) average case
- Queries only nearby entities instead of iterating all
- Automatic sync with game state

### 4.3 Projectile Object Pooling - COMPLETED
**Created:**
- `/src/systems/ProjectilePool.ts` - Pre-allocated projectile pool (100 player, 200 enemy)
- `/src/hooks/usePooledProjectiles.ts` - Hook for spawning pooled projectiles

**Benefits:**
- Zero allocation during gameplay
- Reuses projectile objects instead of create/destroy
- Eliminates GC pressure from projectile churn

---

## Phase 5: Feature Enhancements (Optional) - NOT STARTED

### 5.1 Visual Feedback
- Floating damage numbers
- Screen shake on damage
- Hit flash effects

### 5.2 Configurable Difficulty
- Easy/Normal/Hard presets
- Adjust enemy scaling formulas

### 5.3 Persistent Progression
- Save coins to localStorage
- Meta-progression unlocks

---

## Progress Summary

| Phase | Status | Items |
|-------|--------|-------|
| **Phase 1** | COMPLETED | Quick Wins (1.1-1.4) |
| **Phase 2** | COMPLETED | Architecture Refactoring (2.1-2.3) |
| **Phase 3** | COMPLETED | Testing & Quality (3.1-3.2) |
| **Phase 4** | COMPLETED | Performance Optimizations (4.1-4.3) |
| **Phase 5** | NOT STARTED | Feature Enhancements (5.1-5.3) |

---

## Key Files Modified

### Phase 1
- `/src/constants/game.ts` - NEW: Game constants
- `/src/types/index.ts` - NEW: Consolidated types
- `/src/utils/gameState.ts` - Updated to use constants and types
- `/src/utils/weapons.ts` - Updated to use central types
- `/src/components/GameScene.tsx` - Optimized subscriptions
- `/src/models/Tank.tsx` - Memoized Vector3 objects
- `/src/models/EnemyTank.tsx` - Memoized Vector3 objects
- `/src/components/GameUI.tsx` - Type fixes
- `/src/components/WeaponSelection.tsx` - Type fixes
- `/src/types.d.ts` - Updated to use central types

### Phase 2
- `/src/state/` - NEW: State slices directory
  - `types.ts`, `playerSlice.ts`, `enemySlice.ts`, `gameFlowSlice.ts`
  - `safeZoneSlice.ts`, `weaponSlice.ts`, `inputSlice.ts`, `terrainSlice.ts`, `index.ts`
- `/src/components/ui/` - NEW: UI components directory
  - `HUD.tsx`, `PlayerStatsPanel.tsx`, `WarningOverlays.tsx`, `PauseMenu.tsx`
  - `GameOverScreen.tsx`, `SettingsModal.tsx`, `ConfirmDialog.tsx`
- `/src/components/GameUI.tsx` - Refactored to use extracted UI components
- `/src/hooks/useTankCollision.ts` - NEW: Shared collision detection hook
- `/src/hooks/useProjectileManager.ts` - NEW: Shared projectile management hook
- `/src/models/Tank.tsx` - Refactored to use shared hooks
- `/src/models/EnemyTank.tsx` - Refactored to use shared hooks

### Phase 3
- `/vitest.config.ts` - NEW: Vitest configuration
- `/src/test/setup.ts` - NEW: Test setup file
- `/src/state/safeZoneSlice.test.ts` - NEW: Safe zone tests
- `/src/utils/levelGenerator.test.ts` - NEW: Level generator tests
- `/src/hooks/useTankCollision.test.ts` - NEW: Collision detection tests
- `/.husky/pre-commit` - NEW: Pre-commit hook
- `/package.json` - Updated with test scripts and lint-staged config

### Phase 4
- `/src/utils/spatialHash.ts` - NEW: Grid-based spatial hash for O(1) collision queries
- `/src/hooks/useSpatialHash.ts` - NEW: React hooks for spatial hash management
- `/src/hooks/useTankCollision.ts` - Updated to use spatial hashing
- `/src/systems/ProjectilePool.ts` - NEW: Pre-allocated projectile object pool
- `/src/hooks/usePooledProjectiles.ts` - NEW: Hook for spawning pooled projectiles
- `/src/components/InstancedProjectiles.tsx` - NEW: InstancedMesh projectile renderer
- `/src/components/InstancedHealthBars.tsx` - NEW: InstancedMesh health bar renderer
- `/src/utils/sharedMaterials.ts` - NEW: Shared material cache
- `/src/components/GameScene.tsx` - Updated to include SpatialHashManager

---

## Verification Steps

After each phase:
1. Run `npm run dev` - Ensure game loads and plays correctly
2. Test all weapon types and enemy interactions
3. Verify mobile joystick controls still work
4. Check FPS with Shift+F (should maintain or improve)
5. Run `npm run build` - Ensure no TypeScript errors
