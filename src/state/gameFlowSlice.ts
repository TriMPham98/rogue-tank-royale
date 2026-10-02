// Game Flow state slice
import type { StateCreator } from "zustand";
import type { GameState, GameFlowSlice, UpgradeableStat } from "./types";
import { GAME_CONSTANTS } from "../constants/game";
import SoundManager from "../utils/sound";
import { calculateSafeZoneUpdates, initialSafeZoneState } from "./safeZoneSlice";
import { initialPlayerState } from "./playerSlice";
import { initialEnemyState } from "./enemySlice";
import { initialWeaponState } from "./weaponSlice";
import { initialTerrainState } from "./terrainSlice";
import { resetProjectilePool } from "../systems/ProjectilePool";
import { clearAllEnemyVisualPositions } from "../utils/enemyVisualPositions";
import { initialEncounterState } from "./encounterSlice";
import { bombardment } from "../systems/bombardment";
import { getRunStartStats, useProgression } from "./progression";

export const createGameFlowSlice: StateCreator<
  GameState,
  [],
  [],
  GameFlowSlice
> = (set, get) => ({
  // Game status
  isGameOver: false,
  isPaused: false,
  isGameStarted: false,
  shouldResetCameraAnimation: true,
  isWireframeAssembled: false,
  isTerrainReady: false,
  isFirstPersonView: false,

  // Level progression
  level: 1,
  score: 0,
  coins: 0,
  enemiesDefeated: 0,
  enemiesRequiredForNextLevel: 1,

  // Upgrade UI
  showUpgradeUI: false,
  availableUpgrades: [],

  // Mobile orientation
  isLandscapeOrientationRequired: true,
  showOrientationWarning: false,

  // Actions
  restartGame: () => {
    SoundManager.setVolume("deployTank", 0.55);
    SoundManager.play("deployTank");
    resetProjectilePool();
    clearAllEnemyVisualPositions();
    bombardment.reset();

    return set({
      ...initialPlayerState,
      ...initialEnemyState,
      ...initialSafeZoneState,
      ...initialWeaponState,
      ...initialTerrainState,
      ...initialEncounterState,
      // Armory upgrades overwrite the base stats (and grant starting supply)
      ...getRunStartStats(),
      isGameOver: false,
      isPaused: false,
      level: 1,
      score: 0,
      enemiesDefeated: 0,
      enemiesRequiredForNextLevel: 1,
      showUpgradeUI: false,
      availableUpgrades: [],
      showOrientationWarning: false,
      isFirstPersonView: false,
      shouldResetCameraAnimation: true,
      isWireframeAssembled: false,
      isTerrainReady: false,
    });
  },

  togglePause: () =>
    set((state) => ({ isPaused: !state.isPaused })),

  startGame: () =>
    set(() => ({
      isGameStarted: true,
      shouldResetCameraAnimation: true,
      isPaused: false,
    })),

  returnToMainMenu: () => {
    // Abandoning a run still banks what was earned
    if (get().isGameStarted) get().bankRunSupply();
    resetProjectilePool();
    clearAllEnemyVisualPositions();
    bombardment.reset();
    set({
      ...initialPlayerState,
      ...initialEnemyState,
      ...initialSafeZoneState,
      ...initialWeaponState,
      ...initialTerrainState,
      ...initialEncounterState,
      isGameOver: false,
      isPaused: false,
      isGameStarted: false,
      level: 1,
      score: 0,
      coins: 0,
      enemiesDefeated: 0,
      enemiesRequiredForNextLevel: 1,
      showUpgradeUI: false,
      availableUpgrades: [],
      showOrientationWarning: false,
      isFirstPersonView: false,
      shouldResetCameraAnimation: true,
      isWireframeAssembled: false,
      isTerrainReady: false,
      forward: 0,
      strafe: 0,
      moveX: 0,
      moveZ: 0,
      turretRotation: null,
      isFiring: false,
    });
  },

  incrementEnemyDefeatCount: () => {
    set((state) => {
      if (state.showUpgradeUI || state.isGameOver) {
        return state;
      }

      let newCount = state.enemiesDefeated + 1;

      // Boss levels only advance once the boss is destroyed
      if (state.bossActive || state.bossIncoming) {
        newCount = Math.min(newCount, state.enemiesRequiredForNextLevel - 1);
      }

      if (newCount >= state.enemiesRequiredForNextLevel) {
        const remainingEnemies = newCount - state.enemiesRequiredForNextLevel;

        setTimeout(() => {
          const currentState = get();
          if (!currentState.showUpgradeUI && !currentState.isGameOver) {
            get().advanceLevel();
          }
        }, 500);

        return { enemiesDefeated: remainingEnemies };
      }

      return { enemiesDefeated: newCount };
    });
  },

  advanceLevel: () =>
    set((state) => {
      if (state.isGameOver) {
        return state;
      }

      const newLevel = state.level + 1;

      SoundManager.setVolume("levelUp", 1.65);
      SoundManager.play("levelUp");

      // Calculate level requirements
      let nextLevelRequirement;
      if (newLevel <= GAME_CONSTANTS.EARLY_GAME_MAX_LEVEL) {
        nextLevelRequirement = Math.ceil(newLevel / 2);
      } else if (newLevel <= GAME_CONSTANTS.MID_GAME_MAX_LEVEL) {
        nextLevelRequirement =
          12 + Math.ceil((newLevel - GAME_CONSTANTS.EARLY_GAME_MAX_LEVEL) / 2);
      } else {
        nextLevelRequirement =
          25 + Math.ceil((newLevel - GAME_CONSTANTS.MID_GAME_MAX_LEVEL) * 0.75);
      }

      // Generate upgrades
      let availableUpgrades: UpgradeableStat[] = [];
      if (newLevel <= GAME_CONSTANTS.UPGRADE_UI_MAX_LEVEL) {
        const possibleUpgrades: UpgradeableStat[] = [
          "tankSpeed",
          "maxHealth",
          "healthRegen",
          "turretDamage",
          "bulletVelocity",
        ];

        if (state.playerFireRate > 1 / GAME_CONSTANTS.PLAYER_MAX_FIRE_RATE) {
          possibleUpgrades.push("fireRate");
        }

        if (state.playerCameraRange < GAME_CONSTANTS.PLAYER_MAX_CAMERA_RANGE) {
          possibleUpgrades.push("cameraRange");
        }

        if (
          state.playerPenetration < GAME_CONSTANTS.PLAYER_MAX_PENETRATION &&
          Math.random() < 0.25
        ) {
          possibleUpgrades.push("penetration");
        }

        const shuffled = [...possibleUpgrades].sort(() => 0.5 - Math.random());
        availableUpgrades = shuffled.slice(0, Math.min(3, shuffled.length));
      }

      // Calculate turret damage
      const tankBaseHealth = GAME_CONSTANTS.ENEMY_TANK_BASE_HEALTH;
      const linearHealthScale = GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL;
      const tankHealth = tankBaseHealth + newLevel * linearHealthScale;
      const baseTurretDamage = Math.floor(tankHealth * 0.85);
      const newTurretDamage =
        newLevel === 1 ? baseTurretDamage : state.playerTurretDamage;

      // Calculate safe zone updates
      const safeZoneUpdates = calculateSafeZoneUpdates(
        newLevel,
        state.safeZoneRadius,
        state.safeZoneActive,
        state.safeZoneCenter
      );

      return {
        level: newLevel,
        playerLevel: newLevel,
        playerDamage: state.playerDamage + 5,
        playerTurretDamage: newTurretDamage,
        enemiesRequiredForNextLevel: nextLevelRequirement,
        showUpgradeUI: newLevel <= GAME_CONSTANTS.UPGRADE_UI_MAX_LEVEL,
        availableUpgrades,
        ...safeZoneUpdates,
      };
    }),

  increaseScore: (amount) =>
    set((state) => ({ score: state.score + amount })),

  checkOrientation: () => {
    const isMobileDevice =
      /Android|webOS|iPhone|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      ) && !document.body.classList.contains("tablet-device");

    if (!isMobileDevice) {
      set(() => ({ showOrientationWarning: false }));
      return;
    }

    const isPortrait = window.matchMedia("(orientation: portrait)").matches;

    if (isPortrait) {
      set((state) => {
        if (state.isGameStarted && !state.isPaused) {
          state.togglePause();
        }
        return {
          showOrientationWarning: true,
          showWeaponSelection: false,
          showUpgradeUI: false,
        };
      });
    } else {
      set(() => ({ showOrientationWarning: false }));
    }
  },

  setOrientationWarning: (show) =>
    set(() => ({ showOrientationWarning: show })),

  toggleFirstPersonView: () =>
    set((state) => ({ isFirstPersonView: !state.isFirstPersonView })),

  purchaseFieldRepair: () => {
    const state = get();
    const cost = GAME_CONSTANTS.COIN_REPAIR_COST;
    if (state.coins < cost) return false;
    if (state.playerHealth >= state.playerMaxHealth) return false;

    set({
      coins: state.coins - cost,
      playerHealth: Math.min(
        state.playerMaxHealth,
        state.playerHealth + GAME_CONSTANTS.HEALTH_PACK_HEAL_AMOUNT
      ),
    });
    SoundManager.setVolume("healthPickUp", 0.35);
    SoundManager.play("healthPickUp");
    return true;
  },

  purchaseReinforcedPlating: () => {
    const state = get();
    const cost = GAME_CONSTANTS.COIN_PLATING_COST;
    if (state.coins < cost) return false;

    const plating = GAME_CONSTANTS.COIN_PLATING_MAX_HEALTH;
    set({
      coins: state.coins - cost,
      playerMaxHealth: state.playerMaxHealth + plating,
      playerHealth: state.playerHealth + plating,
    });
    SoundManager.setVolume("levelUp", 0.35);
    SoundManager.play("levelUp");
    return true;
  },

  bankRunSupply: () => {
    const state = get();
    if (state.runBanked) return;
    set({ runBanked: true });
    useProgression
      .getState()
      .bankRun(state.coins, state.level, state.bossesDefeated);
  },
});

// Initial game flow state for reset
export const initialGameFlowState = {
  isGameOver: false,
  isPaused: false,
  isGameStarted: false,
  shouldResetCameraAnimation: true,
  isWireframeAssembled: false,
  isTerrainReady: false,
  isFirstPersonView: false,
  level: 1,
  score: 0,
  coins: 0,
  enemiesDefeated: 0,
  enemiesRequiredForNextLevel: 1,
  showUpgradeUI: false,
  availableUpgrades: [] as UpgradeableStat[],
  isLandscapeOrientationRequired: true,
  showOrientationWarning: false,
};
