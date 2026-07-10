import { useGameState, UpgradeableStat, SecondaryWeapon } from "../utils/gameState";
import "./GameUI.css";
import { useState, useCallback, useEffect, useRef } from "react";
import WeaponSelection from "./WeaponSelection";
import "./WeaponSelection.css";
import StatUpgradeUI from "./StatUpgradeUI";
import { generateLevel } from "../utils/levelGenerator";
import TacticalDisplay from "./TacticalDisplay";
import { useSettings } from "../utils/settingsContext";
// Extracted UI components
import HUD from "./ui/HUD";
import PlayerStatsPanel from "./ui/PlayerStatsPanel";
import {
  ContainmentWarning,
  OutsideZoneWarning,
  CombatZoneShrinkWarning,
  OrientationWarning,
} from "./ui/WarningOverlays";
import PauseMenu from "./ui/PauseMenu";
import GameOverScreen from "./ui/GameOverScreen";
import SettingsModal from "./ui/SettingsModal";
import ConfirmDialog from "./ui/ConfirmDialog";

// Define BASE_TARGETS constant for enemy count calculation
const BASE_TARGETS = 1;

// Calculate max hostiles for a given rank (matches the logic in respawnManager.ts)
const getMaxTargets = (rank: number): number => {
  if (rank === 1) return 1;
  if (rank <= 10) {
    return Math.min(BASE_TARGETS + Math.floor(Math.sqrt(rank) * 1.25), 15);
  } else if (rank < 40) {
    return Math.min(BASE_TARGETS + Math.floor(Math.sqrt(rank) * 2), 15);
  } else {
    return Math.min(BASE_TARGETS + Math.floor(Math.sqrt(rank) * 2.3), 20);
  }
};

const GameUI = () => {
  const [isOutsideCombatZone, setIsOutsideCombatZone] = useState(false);
  const [elapsedTime, setElapsedTime] = useState(0);
  const warningOpacityRef = useRef(0);
  const warningAnimationRef = useRef<number>(0);
  const [isCombatZoneWarningVisible, setIsCombatZoneWarningVisible] =
    useState(false);
  const combatZoneShrinkWarningRef = useRef<number>(0);
  const [combatZoneTimeRemaining, setCombatZoneTimeRemaining] = useState<
    number | null
  >(null);
  const lastZoneUpdateTimeRef = useRef(0);
  const lastZoneRadiusRef = useRef(0);
  // Mobile detection
  const [isMobile, setIsMobile] = useState(false);
  const [showMainMenuConfirm, setShowMainMenuConfirm] = useState(false);
  const [showSettings, setShowSettings] = useState(false);

  // Settings context
  const {
    masterVolume,
    soundEffectsVolume,
    setMasterVolume,
    setSoundEffectsVolume,
  } = useSettings();

  useEffect(() => {
    const checkMobile = () => {
      return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
      );
    };

    setIsMobile(checkMobile());

    // Also detect if touch is supported
    if (
      "ontouchstart" in window ||
      window.matchMedia("(max-width: 768px)").matches
    ) {
      setIsMobile(true);
    }
  }, []);

  const {
    playerHealth,
    playerMaxHealth,
    score,
    coins,
    level: rank,
    enemiesDefeated: targetsEliminated,
    enemiesRequiredForNextLevel: targetsRequiredForPromotion,
    isGameOver,
    isPaused,
    restartGame,
    togglePause,
    purchaseFieldRepair,
    purchaseReinforcedPlating,
    showUpgradeUI: showEnhancementUI,
    availableUpgrades: availableEnhancements,
    upgradeStat: applyEnhancement,
    playerSpeed,
    playerFireRate,
    playerCameraRange,
    playerHealthRegen,
    playerTurretDamage,
    playerBulletVelocity,
    playerPenetration,
    showWeaponSelection,
    availableWeapons,
    selectedWeapons,
    selectWeapon,
    closeWeaponSelection,
    safeZoneActive: combatZoneActive,
    safeZoneRadius: combatZoneRadius,
    safeZoneCenter: combatZoneCenter,
    playerTankPosition,
    playerTurretRotation,
    enemies: hostiles,
    safeZoneTargetRadius: combatZoneTargetRadius,
    safeZoneShrinkRate: combatZoneShrinkRate,
    isPreZoneChangeLevel: isPreContainmentShiftRank,
    returnToMainMenu,
    showOrientationWarning,
    setOrientationWarning,
  } = useGameState();

  // Reset elapsed time when game is restarted (level and score reset to initial values)
  useEffect(() => {
    if (rank === 1 && score === 0) {
      setElapsedTime(0);
    }
  }, [rank, score]);

  // Timer effect - only handles incrementing time
  useEffect(() => {
    if (isGameOver || isPaused) return;

    const timer = setInterval(() => {
      setElapsedTime((prevTime) => prevTime + 1);
    }, 1000);

    return () => clearInterval(timer);
  }, [isGameOver, isPaused]);

  // Check for weapon selection opportunity when rank changes
  useEffect(() => {
    if (
      [10, 20, 30, 40].includes(rank) &&
      selectedWeapons.length < Math.min(Math.floor(rank / 10), 4) &&
      !isGameOver
    ) {
      useGameState.setState({ showWeaponSelection: true });
    }
  }, [rank, isGameOver, selectedWeapons.length]);

  // Monitor weapon selection state
  useEffect(() => {}, [showWeaponSelection, selectedWeapons]);

  // Handle keyboard shortcuts for enhancements and weapons
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (showEnhancementUI) {
        const keyIndex = parseInt(event.key) - 1;
        if (
          keyIndex >= 0 &&
          keyIndex < 3 &&
          keyIndex < availableEnhancements.length
        ) {
          handleEnhancementSelect(availableEnhancements[keyIndex]);
        }
      }

      if (showWeaponSelection) {
        const keyIndex = parseInt(event.key) - 1;
        if (
          keyIndex >= 0 &&
          keyIndex < 4 &&
          keyIndex < availableWeapons.length
        ) {
          selectWeapon(availableWeapons[keyIndex]);
          closeWeaponSelection();
          if (rank <= 50) {
            useGameState.setState({ showUpgradeUI: true });
          }
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [
    showEnhancementUI,
    showWeaponSelection,
    availableEnhancements,
    availableWeapons,
    rank,
    selectWeapon,
    closeWeaponSelection,
  ]);

  const handleEnhancementSelect = useCallback(
    (stat: UpgradeableStat) => {
      applyEnhancement(stat);
    },
    [applyEnhancement]
  );

  const renderWeaponSelection = () => {
    if (!showWeaponSelection || isGameOver) {
      return null;
    }

    return (
      <WeaponSelection
        onWeaponSelect={(weapon: SecondaryWeapon) => {
          selectWeapon(weapon);
          closeWeaponSelection();
          if (rank <= 50) {
            useGameState.setState({ showUpgradeUI: true });
          }
        }}
        onClose={() => {
          closeWeaponSelection();
          if (rank <= 50) {
            useGameState.setState({ showUpgradeUI: true });
          }
        }}
        state={{
          availableWeapons,
          selectedWeapons,
          level: rank,
          canSelect:
            selectedWeapons.length < Math.min(Math.floor(rank / 10), 4),
        }}
      />
    );
  };

  useEffect(() => {
    if (!combatZoneActive || !playerTankPosition) {
      setIsOutsideCombatZone(false);
      return;
    }
    const playerPos2D = [playerTankPosition[0], playerTankPosition[2]];
    const centerPos = [combatZoneCenter[0], combatZoneCenter[1]];
    const distance = Math.sqrt(
      Math.pow(playerPos2D[0] - centerPos[0], 2) +
        Math.pow(playerPos2D[1] - centerPos[1], 2)
    );
    const isOutside = distance > combatZoneRadius;
    if (isOutside !== isOutsideCombatZone) {
      setIsOutsideCombatZone(isOutside);
    }
  }, [
    playerTankPosition,
    combatZoneRadius,
    combatZoneCenter,
    combatZoneActive,
    isOutsideCombatZone,
  ]);

  useEffect(() => {
    if (!combatZoneActive || isGameOver || isPaused) {
      setIsCombatZoneWarningVisible(false);
      return;
    }
    if (combatZoneRadius - combatZoneTargetRadius > 0.5) {
      setIsCombatZoneWarningVisible(true);
      const approxTimeToClose = Math.floor(
        (combatZoneRadius - combatZoneTargetRadius) / combatZoneShrinkRate
      );
      if (
        combatZoneTimeRemaining === null ||
        Math.abs(lastZoneRadiusRef.current - combatZoneRadius) > 0.5
      ) {
        setCombatZoneTimeRemaining(approxTimeToClose);
        lastZoneRadiusRef.current = combatZoneRadius;
        lastZoneUpdateTimeRef.current = Date.now();
      }
      const timerId = setTimeout(() => {
        setIsCombatZoneWarningVisible(false);
      }, 5000);
      return () => clearTimeout(timerId);
    } else {
      setIsCombatZoneWarningVisible(false);
      setCombatZoneTimeRemaining(null);
    }
  }, [
    combatZoneRadius,
    combatZoneTargetRadius,
    combatZoneActive,
    isGameOver,
    isPaused,
    combatZoneShrinkRate,
    combatZoneTimeRemaining,
  ]);

  useEffect(() => {
    if (
      combatZoneTimeRemaining === null ||
      isPaused ||
      isGameOver ||
      !combatZoneActive
    ) {
      return;
    }

    let lastUpdateTimestamp = lastZoneUpdateTimeRef.current;

    const timer = setInterval(() => {
      const now = Date.now();
      const elapsedSeconds = (now - lastUpdateTimestamp) / 1000;
      lastUpdateTimestamp = now;

      setCombatZoneTimeRemaining((prevTime) => {
        const newTime = Math.max(0, (prevTime ?? 0) - elapsedSeconds);
        if (newTime <= 0) {
          clearInterval(timer);
          return null;
        }
        return newTime;
      });
    }, 100);

    return () => clearInterval(timer);
  }, [combatZoneTimeRemaining, isPaused, isGameOver, combatZoneActive]);

  useEffect(() => {
    let animationFrameId: number;
    if (!isOutsideCombatZone) {
      warningOpacityRef.current = 0;
      cancelAnimationFrame(warningAnimationRef.current);
      return;
    }
    let startTime: number;
    const duration = 1000;
    const animateOutsideWarning = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      warningOpacityRef.current =
        0.4 + (Math.sin((elapsed / duration) * Math.PI * 2) + 1) / 4;
      animationFrameId = requestAnimationFrame(animateOutsideWarning);
      warningAnimationRef.current = animationFrameId;
    };
    animationFrameId = requestAnimationFrame(animateOutsideWarning);
    warningAnimationRef.current = animationFrameId;
    return () => {
      cancelAnimationFrame(warningAnimationRef.current);
    };
  }, [isOutsideCombatZone]);

  useEffect(() => {
    let animationFrameId: number;
    if (!isCombatZoneWarningVisible) {
      combatZoneShrinkWarningRef.current = 0;
      cancelAnimationFrame(warningAnimationRef.current);
      return;
    }
    let startTime: number;
    const duration = 800;
    const animateShrinkWarning = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      combatZoneShrinkWarningRef.current =
        0.5 + (Math.sin((elapsed / duration) * Math.PI * 2) + 1) / 4;
      animationFrameId = requestAnimationFrame(animateShrinkWarning);
      warningAnimationRef.current = animationFrameId;
    };
    animationFrameId = requestAnimationFrame(animateShrinkWarning);
    warningAnimationRef.current = animationFrameId;
    return () => {
      cancelAnimationFrame(warningAnimationRef.current);
    };
  }, [isCombatZoneWarningVisible]);

  const [showContainmentWarning, setShowContainmentWarning] = useState(false);
  const containmentWarningOpacityRef = useRef(0);

  // Handle returning to main menu confirmation
  const handleReturnToMenuClick = () => {
    setShowMainMenuConfirm(true);
  };

  const handleConfirmReturn = () => {
    returnToMainMenu();
    setShowMainMenuConfirm(false);
  };

  const handleCancelReturn = () => {
    setShowMainMenuConfirm(false);
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  useEffect(() => {
    let animationFrameId: number;
    if (
      !isPreContainmentShiftRank ||
      !combatZoneActive ||
      isPaused ||
      isGameOver
    ) {
      setShowContainmentWarning(false);
      cancelAnimationFrame(warningAnimationRef.current);
      return;
    }
    setShowContainmentWarning(true);
    let startTime: number;
    const duration = 1200;
    const animateContainmentWarning = (timestamp: number) => {
      if (!startTime) startTime = timestamp;
      const elapsed = timestamp - startTime;
      containmentWarningOpacityRef.current =
        0.6 + (Math.sin((elapsed / duration) * Math.PI * 2) + 1) * 0.15;
      if (showContainmentWarning) {
        animationFrameId = requestAnimationFrame(animateContainmentWarning);
        warningAnimationRef.current = animationFrameId;
      }
    };
    animationFrameId = requestAnimationFrame(animateContainmentWarning);
    warningAnimationRef.current = animationFrameId;
    return () => {
      cancelAnimationFrame(warningAnimationRef.current);
    };
  }, [
    isPreContainmentShiftRank,
    combatZoneActive,
    isPaused,
    isGameOver,
    showContainmentWarning,
  ]);

  // Handle ENTER key press for game restart when game over
  useEffect(() => {
    const handleKeyPress = (event: KeyboardEvent) => {
      if (isGameOver && event.key === "Enter") {
        handleRestartGame();
      }
    };

    window.addEventListener("keydown", handleKeyPress);
    return () => {
      window.removeEventListener("keydown", handleKeyPress);
    };
  }, [isGameOver, restartGame]);

  // Handle game restart
  const handleRestartGame = useCallback(() => {
    restartGame();
    try {
      // Add delay to ensure terrain obstacles are generated first
      setTimeout(() => {
        // Generate a new level
        generateLevel();
      }, 500); // 500ms delay gives time for terrain to initialize
    } catch (error) {
      console.error("Error generating level:", error);
    }
  }, [restartGame]);


  return (
    <div
      className={`game-ui military-theme ${
        isGameOver ? "blur-background" : ""
      } ${isMobile ? "mobile" : ""}`}>
      <ContainmentWarning
        show={showContainmentWarning && !isGameOver && !isPaused}
        opacity={containmentWarningOpacityRef.current}
      />
      {!isGameOver && !isPaused && !isMobile && (
        <TacticalDisplay
          playerTankPosition={playerTankPosition}
          playerTurretRotation={playerTurretRotation}
          combatZoneRadius={combatZoneRadius}
          combatZoneCenter={combatZoneCenter}
          combatZoneActive={combatZoneActive}
          hostiles={hostiles}
          combatZoneTargetRadius={combatZoneTargetRadius}
          rank={rank}
          isPreContainmentShiftRank={isPreContainmentShiftRank}
          elapsedTime={elapsedTime}
        />
      )}
      <HUD
        playerHealth={playerHealth}
        playerMaxHealth={playerMaxHealth}
        score={score}
        coins={coins}
        rank={rank}
        targetsEliminated={targetsEliminated}
        targetsRequiredForPromotion={targetsRequiredForPromotion}
        getMaxTargets={getMaxTargets}
      />
      {!isMobile && (
        <PlayerStatsPanel
          playerMaxHealth={playerMaxHealth}
          playerHealthRegen={playerHealthRegen}
          playerTurretDamage={playerTurretDamage}
          playerFireRate={playerFireRate}
          playerBulletVelocity={playerBulletVelocity}
          playerPenetration={playerPenetration}
          playerSpeed={playerSpeed}
          playerCameraRange={playerCameraRange}
        />
      )}

      {/* Use our new StatUpgradeUI component instead of inline enhancement UI */}
      {showEnhancementUI && !isGameOver && (
        <StatUpgradeUI
          availableEnhancements={availableEnhancements}
          onUpgradeSelect={handleEnhancementSelect}
        />
      )}

      <OutsideZoneWarning
        show={isOutsideCombatZone && !isGameOver && !isPaused}
        opacity={warningOpacityRef.current}
      />
      <CombatZoneShrinkWarning
        show={isCombatZoneWarningVisible && !isGameOver && !isPaused}
      />
      {isGameOver && (
        <GameOverScreen
          score={score}
          rank={rank}
          elapsedTime={elapsedTime}
          onRestart={handleRestartGame}
        />
      )}
      {isPaused &&
        !isGameOver &&
        !showEnhancementUI &&
        !showWeaponSelection &&
        !showSettings && (
          <PauseMenu
            coins={coins}
            playerHealth={playerHealth}
            playerMaxHealth={playerMaxHealth}
            onResume={togglePause}
            onMainMenu={handleReturnToMenuClick}
            onSettings={handleOpenSettings}
            onPurchaseRepair={purchaseFieldRepair}
            onPurchasePlating={purchaseReinforcedPlating}
          />
        )}
      {showSettings && (
        <SettingsModal
          masterVolume={masterVolume}
          soundEffectsVolume={soundEffectsVolume}
          onMasterVolumeChange={setMasterVolume}
          onSoundEffectsVolumeChange={setSoundEffectsVolume}
          onClose={handleCloseSettings}
        />
      )}
      {showMainMenuConfirm && (
        <ConfirmDialog
          title="Confirm"
          message="Are you sure you want to return to the main menu?"
          onConfirm={handleConfirmReturn}
          onCancel={handleCancelReturn}
        />
      )}
      {renderWeaponSelection()}
      {!isGameOver && !isMobile && (
        <div className="controls-info">
          {!isMobile && (
            <>
              <span>[WASD] Move</span> | <span>[J/K] Aim</span> |{" "}
              <span>[V] FPV</span> | <span>[ESC] Pause / Supply</span>
            </>
          )}
        </div>
      )}
      {isMobile &&
        !isGameOver &&
        !isPaused &&
        !showEnhancementUI &&
        !showWeaponSelection && (
          <button
            className="mobile-pause-button"
            onClick={togglePause}
            aria-label="Pause Game">
            <span className="pause-icon">||</span>
          </button>
        )}

      <OrientationWarning
        show={showOrientationWarning}
        onDismiss={() => setOrientationWarning(false)}
      />
    </div>
  );
};

export default GameUI;
