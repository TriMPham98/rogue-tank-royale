import React, { useCallback } from "react";
import "./TacticalDisplay.css";

interface TacticalDisplayProps {
  playerTankPosition: [number, number, number] | null;
  playerTurretRotation: number;
  combatZoneRadius: number;
  combatZoneCenter: [number, number];
  combatZoneActive: boolean;
  hostiles: Array<{
    id: string;
    position: [number, number, number];
    type: string;
  }>;
  combatZoneTargetRadius: number;
  rank: number;
  isPreContainmentShiftRank: boolean;
  elapsedTime: number;
  redZone?: {
    phase: "idle" | "warning" | "bombing";
    center: [number, number];
    radius: number;
  };
}

const TacticalDisplay: React.FC<TacticalDisplayProps> = ({
  playerTankPosition,
  playerTurretRotation,
  combatZoneRadius,
  combatZoneCenter,
  combatZoneActive,
  hostiles,
  combatZoneTargetRadius,
  rank,
  isPreContainmentShiftRank,
  elapsedTime,
  redZone,
}) => {
  // Format time as MM:SS
  const formatTime = (seconds: number) => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes.toString().padStart(2, "0")}:${remainingSeconds
      .toString()
      .padStart(2, "0")}`;
  };

  const renderTacticalDisplay = useCallback(() => {
    const mapSize = 150;
    const gameWorldSize = 100;
    const scale = mapSize / gameWorldSize;

    const playerXRaw = playerTankPosition
      ? playerTankPosition[0] * scale + mapSize / 2
      : mapSize / 2;
    const playerYRaw = playerTankPosition
      ? playerTankPosition[2] * scale + mapSize / 2
      : mapSize / 2;
    const playerX = Math.max(3, Math.min(mapSize - 3, playerXRaw));
    const playerY = Math.max(3, Math.min(mapSize - 3, playerYRaw));

    const zoneCenterX = combatZoneCenter[0] * scale + mapSize / 2;
    const zoneCenterY = combatZoneCenter[1] * scale + mapSize / 2;
    const zoneRadiusPixels = combatZoneRadius * scale;
    const zoneTargetRadiusPixels = combatZoneTargetRadius * scale;

    const zoneTier = Math.floor(rank / 5);
    const isPreShiftRank = rank % 5 === 4 && rank >= 4;

    const nextZoneRadius = Math.max(5, 50 - (zoneTier + 1) * 4);
    const nextZoneRadiusPixels = nextZoneRadius * scale;

    return (
      <>
        <div className="elapsed-time-display">{formatTime(elapsedTime)}</div>
        <div className="tactical-display">
          <div className="radar-bg">
            <div className="grid-overlay"></div>
            <div className="grid-sections"></div>
          </div>

          {combatZoneActive && (
            <>
              <div
                className="zone-circle current-zone"
                style={{
                  left: `${zoneCenterX - zoneRadiusPixels}px`,
                  top: `${zoneCenterY - zoneRadiusPixels}px`,
                  width: `${zoneRadiusPixels * 2}px`,
                  height: `${zoneRadiusPixels * 2}px`,
                }}
              />

              {combatZoneTargetRadius < combatZoneRadius &&
                combatZoneRadius - combatZoneTargetRadius > 0.1 && (
                  <div
                    className="zone-circle target-zone"
                    style={{
                      left: `${zoneCenterX - zoneTargetRadiusPixels}px`,
                      top: `${zoneCenterY - zoneTargetRadiusPixels}px`,
                      width: `${zoneTargetRadiusPixels * 2}px`,
                      height: `${zoneTargetRadiusPixels * 2}px`,
                    }}
                  />
                )}

              {isPreShiftRank && (
                <div
                  className="zone-circle next-zone-preview"
                  style={{
                    left: `${zoneCenterX - nextZoneRadiusPixels}px`,
                    top: `${zoneCenterY - nextZoneRadiusPixels}px`,
                    width: `${nextZoneRadiusPixels * 2}px`,
                    height: `${nextZoneRadiusPixels * 2}px`,
                  }}
                />
              )}
            </>
          )}

          {redZone && redZone.phase !== "idle" && (
            <div
              className={`zone-circle red-zone ${redZone.phase}`}
              style={{
                left: `${(redZone.center[0] - redZone.radius) * scale + mapSize / 2}px`,
                top: `${(redZone.center[1] - redZone.radius) * scale + mapSize / 2}px`,
                width: `${redZone.radius * 2 * scale}px`,
                height: `${redZone.radius * 2 * scale}px`,
              }}
            />
          )}

          {hostiles.map((hostile) => {
            const hostileXRaw = hostile.position[0] * scale + mapSize / 2;
            const hostileYRaw = hostile.position[2] * scale + mapSize / 2;
            const hostileX = Math.max(2, Math.min(mapSize - 2, hostileXRaw));
            const hostileY = Math.max(2, Math.min(mapSize - 2, hostileYRaw));

            let hostileClass = "hostile-marker tank";
            if (hostile.type === "turret")
              hostileClass = "hostile-marker turret";
            else if (hostile.type === "bomber")
              hostileClass = "hostile-marker bomber";
            else if (hostile.type === "boss")
              hostileClass = "hostile-marker boss";

            return (
              <div
                key={`tacmap-hostile-${hostile.id}`}
                className={hostileClass}
                style={{
                  left: `${hostileX}px`,
                  top: `${hostileY}px`,
                }}
              />
            );
          })}

          <div
            className="player-marker"
            style={{
              left: `${playerX}px`,
              top: `${playerY}px`,
            }}>
            <div
              className="turret-indicator"
              style={{
                transform: `rotate(${-playerTurretRotation + Math.PI / 2}rad)`,
              }}
            />
          </div>
        </div>
      </>
    );
  }, [
    playerTankPosition,
    playerTurretRotation,
    combatZoneRadius,
    combatZoneCenter,
    combatZoneActive,
    hostiles,
    combatZoneTargetRadius,
    rank,
    isPreContainmentShiftRank,
    elapsedTime,
    redZone,
  ]);

  return renderTacticalDisplay();
};

export default TacticalDisplay;
