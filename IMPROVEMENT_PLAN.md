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

## Phase 2: Architecture Refactoring (Medium Effort, High Impact) - NOT STARTED

### 2.1 Split `gameState.ts` (997 lines)
**Create state slices:**
- `/src/state/playerState.ts` - Health, stats, upgrades
- `/src/state/enemyState.ts` - Enemy management
- `/src/state/gameFlowState.ts` - Pause, game over, levels
- `/src/state/safeZoneState.ts` - Zone logic (lines 521-640)
- `/src/state/weaponState.ts` - Weapon selection
- `/src/state/index.ts` - Combine with Zustand middleware

### 2.2 Split `GameUI.tsx` (774 lines)
**Extract components:**
- `/src/components/ui/HUD.tsx` - Health, score, level
- `/src/components/ui/PlayerStatsPanel.tsx` - Stats display
- `/src/components/ui/WarningOverlays.tsx` - Zone/combat warnings
- `/src/components/ui/PauseMenu.tsx` - Pause/settings
- `/src/components/ui/UpgradeSelection.tsx` - Upgrade UI

### 2.3 DRY Tank Code
**Current:** `Tank.tsx` (680 lines) and `EnemyTank.tsx` (682 lines) share ~200 lines of duplicate logic

**Extract:**
- `/src/hooks/useTankPhysics.ts` - Collision detection
- `/src/hooks/useProjectileSpawner.ts` - Firing logic
- `/src/models/geometry/TankBody.tsx` - Shared 3D geometry

---

## Phase 3: Testing & Quality (Medium Effort, High Impact) - NOT STARTED

### 3.1 Add Unit Testing
**Setup:** Add Vitest to `package.json`
```bash
npm install -D vitest @testing-library/react
```

**Priority test targets:**
- `levelGenerator.ts` - Enemy generation formulas
- `gameState.ts` - State transitions
- Safe zone calculations
- Collision detection functions

### 3.2 Add Pre-commit Hooks
```bash
npm install -D husky lint-staged
```
- Run ESLint + TypeScript check on commit
- Prevent broken commits

---

## Phase 4: Performance Optimizations (High Effort, High Impact) - NOT STARTED

### 4.1 InstancedMesh for Enemies
**Current:** Each enemy creates separate mesh (~20 draw calls)
**After:** Single InstancedMesh per enemy type (3 draw calls)

### 4.2 Spatial Partitioning for Collisions
**Current:** O(n²) collision checks
**After:** Grid-based spatial hash for O(n log n)

### 4.3 Projectile Object Pooling
- Pre-allocate projectile objects
- Reuse instead of create/destroy
- Reduces garbage collection pressure

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
| **Phase 2** | NOT STARTED | Architecture Refactoring (2.1-2.3) |
| **Phase 3** | NOT STARTED | Testing & Quality (3.1-3.2) |
| **Phase 4** | NOT STARTED | Performance Optimizations (4.1-4.3) |
| **Phase 5** | NOT STARTED | Feature Enhancements (5.1-5.3) |

---

## Key Files Modified (Phase 1)

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

---

## Verification Steps

After each phase:
1. Run `npm run dev` - Ensure game loads and plays correctly
2. Test all weapon types and enemy interactions
3. Verify mobile joystick controls still work
4. Check FPS with Shift+F (should maintain or improve)
5. Run `npm run build` - Ensure no TypeScript errors
