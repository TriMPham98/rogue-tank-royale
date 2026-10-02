import React, { useEffect, useRef, useState } from "react";
import "./StartScreen.css";
import { useGameState } from "../utils/gameState";
import { generateLevel } from "../utils/levelGenerator";
import { useSound } from "../utils/sound";
import TankWireframeDisplay from "./TankWireframeDisplay";
import { AnimState } from "./TankWireframe";
import { debug } from "../utils/debug";
import { useSettings } from "../utils/settingsContext";
import ArmoryPanel from "./ui/ArmoryPanel";
import "./ui/ArmoryPanel.css";
import "./ui/startHero.css";
import { formatSupply, useProgression } from "../state/progression";

type TransitionStep = "idle" | "fading" | "assembling";

const StartScreen: React.FC = () => {
  const [isMobile, setIsMobile] = useState(false);
  const { startGame, restartGame, isGameStarted } = useGameState((state) => {
    return {
      startGame: state.startGame,
      restartGame: state.restartGame,
      isGameStarted: state.isGameStarted,
    };
  });
  const [subtitleText, setSubtitleText] = useState("");
  const fullSubtitle = "Evade, Upgrade, Survive";
  const sound = useSound();
  const [transitionStep, setTransitionStep] = useState<TransitionStep>("idle");
  const [wireframeAnimMode, setWireframeAnimMode] = useState<AnimState>(
    AnimState.IDLE
  );
  const [showSettings, setShowSettings] = useState(false);
  const [showArmory, setShowArmory] = useState(false);
  const overlayOpenRef = useRef(false);
  overlayOpenRef.current = showArmory || showSettings;
  const bank = useProgression((s) => s.bank);
  const lifetimeBanked = useProgression((s) => s.lifetimeBanked);
  const armoryLevels = useProgression((s) =>
    Object.values(s.upgrades).reduce((sum, level) => sum + level, 0)
  );

  // Settings context
  const {
    masterVolume,
    soundEffectsVolume,
    setMasterVolume,
    setSoundEffectsVolume,
  } = useSettings();

  useEffect(() => {
    // Check if the device is mobile with improved detection
    const checkMobile = () => {
      const isMobileDevice =
        /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(
          navigator.userAgent
        ) || "ontouchstart" in window;

      const isSmallScreen = window.matchMedia("(max-width: 768px)").matches;

      return isMobileDevice || isSmallScreen;
    };

    const updateMobileState = () => {
      setIsMobile(checkMobile());
    };

    // Set initial mobile state
    updateMobileState();

    // Update on resize events
    window.addEventListener("resize", updateMobileState);

    // Only run typing animation if not transitioning
    let typingInterval: NodeJS.Timeout | undefined;
    let typingTimeout: NodeJS.Timeout | undefined;
    let charIndex = 0;
    setSubtitleText(""); // Reset subtitle text on mount
    if (transitionStep === "idle") {
      typingTimeout = setTimeout(() => {
        typingInterval = setInterval(() => {
          if (charIndex < fullSubtitle.length) {
            setSubtitleText(fullSubtitle.slice(0, charIndex + 1));
            charIndex++;
          } else {
            clearInterval(typingInterval);
          }
        }, 100);
      }, 1500); // 1.5s delay before typing starts
    }

    // Add keyboard event listener for SPACEBAR and ENTER
    const handleKeyPress = (event: KeyboardEvent) => {
      if (event.key === "Escape" && overlayOpenRef.current) {
        setShowArmory(false);
        setShowSettings(false);
        return;
      }
      if (event.key === " " || event.key === "Enter") {
        if (transitionStep === "idle" && !overlayOpenRef.current) {
          handleStartGame();
        }
      }
    };

    window.addEventListener("keydown", handleKeyPress);

    return () => {
      clearTimeout(typingTimeout); // Cleanup timeout on unmount
      clearInterval(typingInterval); // Cleanup interval
      window.removeEventListener("keydown", handleKeyPress); // Cleanup event listener
      window.removeEventListener("resize", updateMobileState); // Cleanup resize listener
    };
  }, [transitionStep]);

  const handleStartGame = () => {
    // Prevent triggering if already started or transitioning
    if (isGameStarted || transitionStep !== "idle") {
      return;
    }
    sound.play("deployTank");

    // Start fade-out CSS
    setTransitionStep("fading");

    // Start animation immediately
    setWireframeAnimMode(AnimState.ASSEMBLING_TRANSITION);

    // Setup game state immediately
    restartGame();

    // Generate level after ensuring terrain is ready
    // This subscription will be cleaned up when the component unmounts
    const unsubscribe = useGameState.subscribe((state) => {
      if (state.isTerrainReady) {
        // Only generate level once terrain is ready
        debug.log("StartScreen: Terrain ready, now generating enemies");
        generateLevel();
        unsubscribe(); // Clean up subscription once we've called generateLevel
      }
    });
  };

  // Handler for when the assembly animation completes
  const handleAssemblyComplete = (finalState: AnimState) => {
    // The transitionStep will be 'fading' when the animation completes in this flow
    if (transitionStep === "fading" && finalState === AnimState.IDLE) {
      // Ensure game hasn't already been started somehow
      if (!isGameStarted) {
        startGame(); // Now start the actual game
      }
    }
  };

  // Settings handlers
  const handleOpenSettings = () => {
    setShowSettings(true);
  };

  const handleCloseSettings = () => {
    setShowSettings(false);
  };

  return (
    <div
      className={`start-screen hero military-theme ${isMobile ? "mobile" : ""} ${
        transitionStep !== "idle" ? "deploying" : ""
      }`}>
      {/* Tank wireframe as background */}
      <div className="tank-wireframe-background">
        <TankWireframeDisplay
          width="100%"
          height="100%"
          isBackground={true}
          animationMode={wireframeAnimMode}
          onAnimationComplete={handleAssemblyComplete}
        />
      </div>

      {/* HUD frame: corner brackets + status bars, like the in-game UI */}
      <div className={`hero-frame ${transitionStep !== "idle" ? "fading-out" : ""}`} aria-hidden="true">
        <span className="hero-corner tl" />
        <span className="hero-corner tr" />
        <span className="hero-corner bl" />
        <span className="hero-corner br" />
        <div className="hero-topbar">
          <span className="hero-dot" /> SYS ONLINE
          <span className="hero-sep">//</span> MBT-7 &ldquo;ROGUE&rdquo;
          <span className="hero-sep">//</span> ARENA LINK STABLE
        </div>
        <div className="hero-bottombar">
          <span>[WASD] MOVE</span>
          <span>[J/K] AIM</span>
          <span>[V] GUNNER SIGHT</span>
          <span>[ESC] PAUSE</span>
        </div>
      </div>

      {/* Apply fading class based on transition state */}
      <div
        className={`start-screen-content hero-panel ${
          transitionStep !== "idle" ? "fading-out" : ""
        }`}>
        <div className="hero-kicker">TACTICAL ARENA SURVIVAL</div>
        <h1 className="game-title">
          <span className="title-line">ROGUE TANK</span>
          <span className="title-line accent">ROYALE</span>
        </h1>
        <h2 className="game-subtitle">
          {subtitleText}
          {subtitleText.length < fullSubtitle.length &&
            transitionStep === "idle" && (
              <span className="typing-cursor">|</span>
            )}
        </h2>
        <div className="title-decoration">
          <div className="line"></div>
          <div className="circle"></div>
          <div className="line"></div>
        </div>

        <button className="start-button" onClick={handleStartGame}>
          DEPLOY UNIT <span className="key-hint">ENTER</span>
        </button>
        <div className="hero-secondary">
          <button
            className="settings-button-start armory-button-start"
            onClick={() => setShowArmory(true)}>
            ARMORY{" "}
            <span className="armory-button-bank">{formatSupply(bank)} SP</span>
          </button>
          <button className="settings-button-start" onClick={handleOpenSettings}>
            SETTINGS
          </button>
        </div>

        <div className="hero-stats">
          <div className="hero-stat">
            <span className="hero-stat-label">BANKED SP</span>
            <span className="hero-stat-value gold">{formatSupply(bank)}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">ARMORY LV</span>
            <span className="hero-stat-value">{armoryLevels}</span>
          </div>
          <div className="hero-stat">
            <span className="hero-stat-label">LIFETIME SP</span>
            <span className="hero-stat-value">{formatSupply(lifetimeBanked)}</span>
          </div>
        </div>
      </div>
      {/* Conditionally render Loading text during fade/assembly */}
      {transitionStep === "fading" && (
        <div className="loading-text">
          <span className="loading-label">ASSEMBLING UNIT</span>
          <span className="loading-bar">
            <span className="loading-bar-fill" />
          </span>
        </div>
      )}

      {showArmory && (
        <div className="overlay armory-overlay" onClick={() => setShowArmory(false)}>
          <div className="armory-overlay-inner" onClick={(e) => e.stopPropagation()}>
            <ArmoryPanel />
            <p className="armory-overlay-hint">
              Half your unspent supply plus rank and boss bonuses are banked at the end of every run.
              Upgrades apply automatically on deploy.
            </p>
            <button
              className="settings-button-start"
              onClick={() => setShowArmory(false)}>
              CLOSE
            </button>
          </div>
        </div>
      )}

      {/* Settings overlay */}
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
    </div>
  );
};

export default StartScreen;
