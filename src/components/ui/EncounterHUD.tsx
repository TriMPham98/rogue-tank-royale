// Red zone alerts and the boss health bar
import React from "react";
import { shallow } from "zustand/shallow";
import { useGameState } from "../../utils/gameState";

const BOSS_NAMES = ["GOLIATH", "BEHEMOTH", "LEVIATHAN", "COLOSSUS", "TITAN"];

const RedZoneAlert: React.FC = () => {
  const { phase, secondsLeft, inside } = useGameState((s) => {
    const dx = s.playerTankPosition[0] - s.redZoneCenter[0];
    const dz = s.playerTankPosition[2] - s.redZoneCenter[1];
    return {
      phase: s.redZonePhase,
      secondsLeft: s.redZoneSecondsLeft,
      inside:
        s.redZonePhase !== "idle" &&
        dx * dx + dz * dz < s.redZoneRadius * s.redZoneRadius,
    };
  }, shallow);

  if (phase === "idle") return null;

  return (
    <div className={`red-zone-alert ${phase} ${inside ? "inside" : ""}`} role="alert">
      <div className="red-zone-alert-title">
        {phase === "warning" ? "RED ZONE DETECTED" : "BOMBARDMENT IN PROGRESS"}
      </div>
      <div className="red-zone-alert-sub">
        {phase === "warning"
          ? `Shelling begins in ${secondsLeft}s${inside ? " — MOVE OUT" : ""}`
          : `${inside ? "YOU ARE INSIDE THE RED ZONE" : "Stay clear"} · ${secondsLeft}s`}
      </div>
    </div>
  );
};

const BossBar: React.FC = () => {
  const { boss, incoming, level } = useGameState(
    (s) => ({
      boss: s.enemies.find((e) => e.type === "boss"),
      incoming: s.bossIncoming,
      level: s.level,
    }),
    shallow
  );

  const name = BOSS_NAMES[Math.max(0, Math.floor(level / 10) - 1) % BOSS_NAMES.length];

  if (incoming) {
    return (
      <div className="boss-banner incoming" role="alert">
        <div className="boss-banner-kicker">WARNING</div>
        <div className="boss-banner-title">HEAVY ASSAULT TANK INBOUND</div>
        <div className="boss-banner-sub">Destroy {name} to advance</div>
      </div>
    );
  }

  if (!boss) return null;

  const max = boss.maxHealth || boss.health;
  const pct = Math.max(0, Math.min(1, boss.health / max));

  return (
    <div className={`boss-bar ${pct < 0.4 ? "enraged" : ""}`}>
      <div className="boss-bar-label">
        <span>{name}</span>
        <span className="boss-bar-tag">{pct < 0.4 ? "ENRAGED" : "BOSS"}</span>
      </div>
      <div className="boss-bar-track">
        <div className="boss-bar-fill" style={{ width: `${pct * 100}%` }} />
      </div>
    </div>
  );
};

const EncounterHUD: React.FC = () => (
  <>
    <BossBar />
    <RedZoneAlert />
  </>
);

export default EncounterHUD;
