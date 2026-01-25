import { useGameState, UpgradeableStat, SecondaryWeapon } from "../utils/gameState";
import "./GameUI.css";
import { useState, useCallback, useEffect, useRef } from "react";
import WeaponSelection from "./WeaponSelection";
import "./WeaponSelection.css";
import StatUpgradeUI from "./StatUpgradeUI";
import { generateLevel } from "../utils/levelGenerator";
import TacticalDisplay from "./TacticalDisplay";
import { useSettings } from "../utils/settingsContext";

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
    level: rank,
    enemiesDefeated: targetsEliminated,
    enemiesRequiredForNextLevel: targetsRequiredForPromotion,
    isGameOver,
    isPaused,
    restartGame,
    togglePause,
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

  const hullIntegrityPercentage = (playerHealth / playerMaxHealth) * 100;
  const promotionProgressPercentage =
    (targetsEliminated / targetsRequiredForPromotion) * 100;

  const getHullColor = () => {
    if (hullIntegrityPercentage > 60) return "var(--color-hull-high)";
    if (hullIntegrityPercentage > 30) return "var(--color-hull-medium)";
    return "var(--color-hull-low)";
  };

  const getRankColor = () => {
    if (rank <= 15) return "var(--color-rank-low)"; // Early game - 5 damage
    if (rank <= 25) return "var(--color-rank-medium)"; // Mid game - 10 damage
    if (rank <= 40) return "var(--color-rank-high)"; // Late mid game - 15 damage
    return "var(--color-rank-elite)"; // Late game - 20 damage
  };

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

  // Render the orientation warning overlay
  const renderOrientationWarning = () => {
    if (!showOrientationWarning) return null;

    return (
      <div className="orientation-warning-overlay">
        <div className="orientation-warning-content">
          <div className="warning-header">
            <div className="warning-icon">!</div>
            ALERT: DEVICE ORIENTATION
          </div>
          <div className="warning-message">ROTATE DEVICE TO LANDSCAPE MODE</div>
          <div className="warning-detail">
            Combat systems require landscape orientation for optimal operation
          </div>
          <button
            className="dismiss-button"
            onClick={() => setOrientationWarning(false)}>
            DISMISS WARNING
          </button>
        </div>
      </div>
    );
  };

  return (
    <div
      className={`game-ui military-theme ${
        isGameOver ? "blur-background" : ""
      } ${isMobile ? "mobile" : ""}`}>
      {showContainmentWarning && !isGameOver && !isPaused && (
        <div
          className="warning-overlay containment-warning"
          style={
            {
              "--opacity": containmentWarningOpacityRef.current,
            } as React.CSSProperties
          }>
          <div className="warning-icon">☢️</div>
          <div className="warning-text">
            <div>Combat Zone shrinking</div>
          </div>
          <div className="warning-icon">☢️</div>
        </div>
      )}
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
      <div className="top-hud">
        <div className="hud-element hull-integrity">
          <div className="hud-label">HULL INTEGRITY</div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${hullIntegrityPercentage}%`,
                backgroundColor: getHullColor(),
              }}
            />
            <div className="progress-text">
              {playerHealth.toFixed(0)} / {playerMaxHealth.toFixed(0)}
            </div>
          </div>
        </div>
        <div className="hud-element combat-score">
          <div className="hud-label">COMBAT SCORE</div>
          <div className="score-value">{score}</div>
        </div>
        <div className="hud-element rank-progression">
          <div className="hud-label">
            RANK <span className="rank-indicator">{rank}</span>
            <span className="target-count-info">
              (Targets: {getMaxTargets(rank)})
            </span>
          </div>
          <div className="progress-bar-container">
            <div
              className="progress-bar"
              style={{
                width: `${promotionProgressPercentage}%`,
                backgroundColor: getRankColor(),
              }}
            />
            <div className="progress-text">
              {targetsEliminated} / {targetsRequiredForPromotion}
            </div>
          </div>
        </div>
      </div>
      {!isMobile && (
        <div className="player-stats-panel">
          <div className="panel-header">UNIT STATUS</div>
          <div className="stat-line">
            <span>Armor:</span>
            <span>{playerMaxHealth} HP</span>
          </div>
          <div className="stat-line">
            <span>Repairs:</span>
            <span>{playerHealthRegen.toFixed(1)} HP/s</span>
          </div>
          <div className="stat-line">
            <span>Firepower:</span>
            <span>{playerTurretDamage} DMG</span>
          </div>
          <div className="stat-line">
            <span>RoF:</span>
            <span>{(1 / playerFireRate).toFixed(1)} rps</span>
          </div>
          <div className="stat-line">
            <span>Muzzle Vel:</span>
            <span>{playerBulletVelocity} m/s</span>
          </div>
          <div className="stat-line">
            <span>Penetration:</span>
            <span>
              {playerPenetration} {playerPenetration === 1 ? "Tank" : "Tanks"}
            </span>
          </div>
          <div className="stat-line">
            <span>Mobility:</span>
            <span>{playerSpeed.toFixed(1)} m/s</span>
          </div>
          <div className="stat-line">
            <span>Sensors:</span>
            <span>{playerCameraRange.toFixed(0)}m</span>
          </div>
        </div>
      )}

      {/* Use our new StatUpgradeUI component instead of inline enhancement UI */}
      {showEnhancementUI && !isGameOver && (
        <StatUpgradeUI
          availableEnhancements={availableEnhancements}
          onUpgradeSelect={handleEnhancementSelect}
        />
      )}

      {isOutsideCombatZone && !isGameOver && !isPaused && (
        <div
          className="warning-overlay outside-zone-warning"
          style={
            { "--opacity": warningOpacityRef.current } as React.CSSProperties
          }>
          <div className="warning-icon">🚨</div>
          <div className="warning-text">WARNING: ZONE DAMAGE</div>
          <div className="warning-icon">🚨</div>
        </div>
      )}
      {/* Combat Zone Warning */}
      {isCombatZoneWarningVisible && !isGameOver && !isPaused && (
        <div className="combat-zone-warning">Combat zone is shrinking!</div>
      )}
      {isGameOver && (
        <div className="overlay game-over-overlay">
          <div className="overlay-content game-over-content">
            <h2 className="game-over-title">MISSION FAILED</h2>
            <p>Combat Score: {score}</p>
            <p>Highest Rank Achieved: {rank}</p>
            <p>
              Time Survived: {Math.floor(elapsedTime / 60)}m {elapsedTime % 60}s
            </p>
            <button
              className="ui-button restart-button"
              onClick={handleRestartGame}>
              RE-DEPLOY
            </button>
          </div>
        </div>
      )}
      {isPaused &&
        !isGameOver &&
        !showEnhancementUI &&
        !showWeaponSelection &&
        !showSettings && (
          <div className="overlay pause-overlay">
            <div className="overlay-content pause-content">
              <h2 className="pause-title">OPERATION PAUSED</h2>
              <button
                className="ui-button main-menu-button"
                onClick={handleReturnToMenuClick}>
                MAIN MENU
              </button>
              <button
                className="ui-button main-menu-button"
                onClick={handleOpenSettings}>
                SETTINGS
              </button>
              <button className="ui-button resume-button" onClick={togglePause}>
                RESUME
              </button>
            </div>
          </div>
        )}
      {showSettings && (
        <div className="overlay settings-overlay">
          <div className="overlay-content settings-content">
            <h2 className="settings-title">SETTINGS</h2>
            <div className="settings-body">
              <div className="setting-group">
                <label className="setting-label">Master Volume</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={masterVolume}
                    onChange={(e) => setMasterVolume(parseInt(e.target.value))}
                    className="setting-slider"
                  />
                  <span className="setting-value">{masterVolume}%</span>
                </div>
              </div>
              <div className="setting-group">
                <label className="setting-label">Sound Effects</label>
                <div className="setting-control">
                  <input
                    type="range"
                    min="0"
                    max="100"
                    value={soundEffectsVolume}
                    onChange={(e) =>
                      setSoundEffectsVolume(parseInt(e.target.value))
                    }
                    className="setting-slider"
                  />
                  <span className="setting-value">{soundEffectsVolume}%</span>
                </div>
              </div>
            </div>
            <div className="settings-buttons">
              <button
                className="settings-button secondary"
                onClick={handleCloseSettings}>
                CLOSE
              </button>
              <button className="settings-button" onClick={handleCloseSettings}>
                APPLY
              </button>
            </div>
          </div>
        </div>
      )}
      {showMainMenuConfirm && (
        <div className="overlay confirm-dialog-overlay">
          <div className="overlay-content confirm-dialog-content">
            <h2 className="confirm-title">Confirm</h2>
            <p>Are you sure you want to return to the main menu?</p>
            <div className="confirm-buttons">
              <button
                className="ui-button yes-button"
                onClick={handleConfirmReturn}>
                Yes
              </button>
              <button
                className="ui-button no-button"
                onClick={handleCancelReturn}>
                No
              </button>
            </div>
          </div>
        </div>
      )}
      {renderWeaponSelection()}
      {!isGameOver && !isMobile && (
        <div className="controls-info">
          {!isMobile && (
            <>
              <span>[WASD] Move</span> | <span>[J/K] Aim</span> |{" "}
              <span>[V] View</span> | <span>[ESC] Pause</span>
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

      {/* Device orientation warning overlay */}
      {renderOrientationWarning()}
    </div>
  );
};

export default GameUI;
