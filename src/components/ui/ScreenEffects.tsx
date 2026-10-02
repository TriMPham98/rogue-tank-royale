// Full-screen feedback layer: hit flash, low-hull pulse, and red-zone tint
import React, { useEffect, useRef, useState } from "react";
import { useGameState } from "../../utils/gameState";

const ScreenEffects: React.FC = () => {
  const healthFraction = useGameState((s) => s.playerHealth / s.playerMaxHealth);
  const playerHealth = useGameState((s) => s.playerHealth);
  const redZoneBombing = useGameState((s) => s.redZonePhase === "bombing");
  const [hitKey, setHitKey] = useState(0);
  const [hitStrength, setHitStrength] = useState(0);
  const prevHealthRef = useRef(playerHealth);

  useEffect(() => {
    const prev = prevHealthRef.current;
    prevHealthRef.current = playerHealth;
    const lost = prev - playerHealth;
    // Ignore regen ticks and resets; flash scales with the size of the hit
    if (lost >= 1) {
      setHitStrength(Math.min(1, 0.35 + lost / 30));
      setHitKey((k) => k + 1);
    }
  }, [playerHealth]);

  const critical = healthFraction > 0 && healthFraction <= 0.3;

  return (
    <div className="screen-effects" aria-hidden="true">
      {hitKey > 0 && (
        <div
          key={hitKey}
          className="fx-hit-flash"
          style={{ "--hit": hitStrength } as React.CSSProperties}
        />
      )}
      {critical && <div className="fx-critical" />}
      {redZoneBombing && <div className="fx-redzone" />}
      <div className="fx-vignette" />
    </div>
  );
};

export default ScreenEffects;
