// Game Over Screen component
import React from "react";
import ArmoryPanel from "./ArmoryPanel";
import { formatSupply, useProgression } from "../../state/progression";

interface GameOverScreenProps {
  score: number;
  rank: number;
  elapsedTime: number;
  onRestart: () => void;
}

const GameOverScreen: React.FC<GameOverScreenProps> = ({
  score,
  rank,
  elapsedTime,
  onRestart,
}) => {
  const minutes = Math.floor(elapsedTime / 60);
  const seconds = elapsedTime % 60;
  const lastRun = useProgression((s) => s.lastRun);

  return (
    <div className="overlay game-over-overlay">
      <div className="overlay-content game-over-content">
        <h2 className="game-over-title">MISSION FAILED</h2>
        <p>Combat Score: {score}</p>
        <p>Highest Rank Achieved: {rank}</p>
        <p>
          Time Survived: {minutes}m {seconds}s
        </p>
        {lastRun && (
          <div className="run-report">
            <div className="run-report-row">
              <span>Unspent supply</span>
              <span>{formatSupply(lastRun.unspent)} SP</span>
            </div>
            <div className="run-report-row">
              <span>Rank bonus</span>
              <span>{formatSupply(lastRun.rankBonus)} SP</span>
            </div>
            {lastRun.bossBonus > 0 && (
              <div className="run-report-row">
                <span>Bosses destroyed</span>
                <span>{formatSupply(lastRun.bossBonus)} SP</span>
              </div>
            )}
            <div className="run-report-row total">
              <span>Banked</span>
              <span>+{formatSupply(lastRun.total)} SP</span>
            </div>
          </div>
        )}
        <ArmoryPanel compact />
        <button className="ui-button restart-button" onClick={onRestart}>
          RE-DEPLOY
        </button>
      </div>
    </div>
  );
};

export default GameOverScreen;
