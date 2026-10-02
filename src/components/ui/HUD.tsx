// Top HUD component - Health, Score, Rank
import React from "react";
import { formatSupply } from "../../state/progression";

interface HUDProps {
  playerHealth: number;
  playerMaxHealth: number;
  score: number;
  coins: number;
  rank: number;
  targetsEliminated: number;
  targetsRequiredForPromotion: number;
  getMaxTargets: (rank: number) => number;
}

const HUD: React.FC<HUDProps> = ({
  playerHealth,
  playerMaxHealth,
  score,
  coins,
  rank,
  targetsEliminated,
  targetsRequiredForPromotion,
  getMaxTargets,
}) => {
  const hullIntegrityPercentage = (playerHealth / playerMaxHealth) * 100;
  const promotionProgressPercentage =
    (targetsEliminated / targetsRequiredForPromotion) * 100;

  const getHullColor = () => {
    if (hullIntegrityPercentage > 60) return "var(--color-hull-high)";
    if (hullIntegrityPercentage > 30) return "var(--color-hull-medium)";
    return "var(--color-hull-low)";
  };

  const getRankColor = () => {
    if (rank <= 15) return "var(--color-rank-low)";
    if (rank <= 25) return "var(--color-rank-medium)";
    if (rank <= 40) return "var(--color-rank-high)";
    return "var(--color-rank-elite)";
  };

  return (
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
      <div className="hud-element coin-balance-hud">
        <div className="hud-label">SUPPLY</div>
        <div className="score-value">
          {formatSupply(coins)} <span className="supply-unit">SP</span>
        </div>
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
  );
};

export default HUD;
