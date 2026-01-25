// Player Stats Panel component
import React from "react";

interface PlayerStatsPanelProps {
  playerMaxHealth: number;
  playerHealthRegen: number;
  playerTurretDamage: number;
  playerFireRate: number;
  playerBulletVelocity: number;
  playerPenetration: number;
  playerSpeed: number;
  playerCameraRange: number;
}

const PlayerStatsPanel: React.FC<PlayerStatsPanelProps> = ({
  playerMaxHealth,
  playerHealthRegen,
  playerTurretDamage,
  playerFireRate,
  playerBulletVelocity,
  playerPenetration,
  playerSpeed,
  playerCameraRange,
}) => {
  return (
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
  );
};

export default PlayerStatsPanel;
