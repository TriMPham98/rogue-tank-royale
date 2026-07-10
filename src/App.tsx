import { useEffect, useRef, useState } from "react";
import "./App.css";
import GameScene from "./components/GameScene";
import GameUI from "./components/GameUI";
import { useGameState } from "./utils/gameState";
import { generateLevel } from "./utils/levelGenerator";
import { debug } from "./utils/debug";
import { globalFPSTracker } from "./utils/fpsTracker";
import StartScreen from "./components/StartScreen";
import FPSDisplay from "./components/FPSDisplay";
import { SettingsProvider, useSettings } from "./utils/settingsContext";
import { updateGlobalVolumeSettings } from "./utils/sound";

function AppContent() {
  // Use a ref to ensure initialization only happens once
  const initialized = useRef(false);
  // Ref to track if the current pause state was initiated by the upgrade UI effect
  const pausedByUpgradeUI = useRef(false);
  // Add a ref to track last toggle time
  const lastToggleTime = useRef(0);
  // Add state for FPS display visibility
  const [showFPSDisplay, setShowFPSDisplay] = useState(false);

  const {
    togglePause,
    isPaused,
    level,
    showUpgradeUI,
    advanceLevel,
    isGameStarted,
    checkOrientation,
  } = useGameState();

  const { masterVolume, soundEffectsVolume } = useSettings();

  // Update global volume settings whenever they change
  useEffect(() => {
    updateGlobalVolumeSettings(masterVolume, soundEffectsVolume);
  }, [masterVolume, soundEffectsVolume]);

  // Initialize game state on first render, but don't start the game automatically
  useEffect(() => {
    // Only run basic initialization once, without starting the game
    if (!initialized.current) {
      try {
        initialized.current = true;
      } catch (error) {
        debug.error("Error initializing game:", error);
      }
    }
  }, []);

  // Handle mobile device orientation changes
  useEffect(() => {
    // Set up orientation change detection
    const handleOrientationChange = () => {
      // Check orientation and update game state
      checkOrientation();
    };

    // Initial check
    checkOrientation();

    // Add event listeners for orientation changes
    window.addEventListener("orientationchange", handleOrientationChange);
    window.addEventListener("resize", handleOrientationChange);

    return () => {
      // Clean up event listeners
      window.removeEventListener("orientationchange", handleOrientationChange);
      window.removeEventListener("resize", handleOrientationChange);
    };
  }, [checkOrientation]);

  // Handle escape key for pausing
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Only respond to keyboard controls if the game has started
      if (!isGameStarted) return;

      if (e.key === "Escape" && !showUpgradeUI) {
        // Prevent multiple toggles within 200ms
        const now = Date.now();
        if (now - lastToggleTime.current < 200) {
          return;
        }
        lastToggleTime.current = now;
        togglePause();
      }

      // Debug key for testing level progression (press 'L' to level up)
      if ((e.key === "l" || e.key === "L") && e.shiftKey) {
        if (import.meta.env.DEV) {
          console.log(
            `Advancing level from ${level} to ${level + 1} for lighting test`
          );
        }
        advanceLevel();

        // Generate new level enemies
        try {
          generateLevel();
        } catch (error) {
          debug.error("Error generating level:", error);
        }
      }

      // FPS debugging keys
      if ((e.key === "f" || e.key === "F") && e.shiftKey) {
        // Shift+F: Show current FPS immediately (dev only)
        if (import.meta.env.DEV) {
          const metrics = globalFPSTracker.getMetrics();
          const currentLevel = globalFPSTracker.getCurrentLevel();
          const weaponCount = globalFPSTracker.getSecondaryWeaponCount();
          console.log(
            `🎯 Level ${currentLevel} | ${weaponCount} Weapons | FPS: ${metrics.fps} | Frame Time: ${metrics.averageFrameTime}ms`
          );
        }
      }

      if ((e.key === "p" || e.key === "P") && e.shiftKey) {
        // Shift+P: Force log current performance (since automatic logging only happens on level changes)
        if (import.meta.env.DEV) {
          const metrics = globalFPSTracker.getMetrics();
          const currentLevel = globalFPSTracker.getCurrentLevel();
          const weaponCount = globalFPSTracker.getSecondaryWeaponCount();

          console.group(`🎮 Manual Performance Check - Level ${currentLevel}`);
          console.log(`🎯 Level: ${currentLevel}`);
          console.log(`🔫 Secondary Weapons: ${weaponCount}`);
          console.log(`📊 Average FPS: ${metrics.fps}`);
          console.log(`⏱️  Average Frame Time: ${metrics.averageFrameTime}ms`);
          console.log(`🚀 Best Frame Time: ${metrics.minFrameTime}ms`);
          console.log(`🐌 Worst Frame Time: ${metrics.maxFrameTime}ms`);
          console.log(`📈 Frames Sampled: ${metrics.frameCount}`);

          // Performance assessment
          if (metrics.fps >= 55) {
            console.log("✅ Performance: Excellent");
          } else if (metrics.fps >= 45) {
            console.log("🟡 Performance: Good");
          } else if (metrics.fps >= 30) {
            console.log("🟠 Performance: Fair");
          } else {
            console.log("🔴 Performance: Poor");
          }

          console.groupEnd();
        }
      }

      if ((e.key === "h" || e.key === "H") && e.shiftKey) {
        // Shift+H: Toggle FPS display visibility
        setShowFPSDisplay((prev) => {
          const newValue = !prev;
          if (import.meta.env.DEV) {
            console.log(`👁️ FPS display ${newValue ? "shown" : "hidden"}`);
          }
          return newValue;
        });
      }
    };

    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [
    togglePause,
    showUpgradeUI,
    isPaused,
    level,
    advanceLevel,
    isGameStarted,
  ]);

  // Effect to automatically pause/unpause ONLY when the upgrade UI appears/disappears
  useEffect(() => {
    if (!isGameStarted) return;

    if (showUpgradeUI) {
      // Upgrade UI is now showing
      if (!isPaused) {
        // If game is not paused, pause it and remember we did it.
        pausedByUpgradeUI.current = true;
        togglePause();
      } else {
        // If game was already paused (manually), ensure our flag is false.
        pausedByUpgradeUI.current = false;
      }
    } else {
      // Upgrade UI is now hidden
      if (isPaused && pausedByUpgradeUI.current) {
        // If the game is paused AND we paused it for the UI, unpause it.
        togglePause();
      }
      // Always reset the flag when UI is hidden.
      pausedByUpgradeUI.current = false;
    }
    // Dependencies ONLY include showUpgradeUI and isGameStarted
    // to prevent running when isPaused changes manually.
  }, [showUpgradeUI, isGameStarted, togglePause]);

  // Only render start screen if game not started
  if (!isGameStarted) {
    return <StartScreen />;
  }

  return (
    <div className="app">
      <GameScene />
      <GameUI />
      <FPSDisplay visible={showFPSDisplay} position="top-right" />
    </div>
  );
}

function App() {
  return (
    <SettingsProvider>
      <AppContent />
    </SettingsProvider>
  );
}

export default App;
