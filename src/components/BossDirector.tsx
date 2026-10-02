import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { useGameState } from "../utils/gameState";
import { GAME_CONSTANTS } from "../constants/game";
import { isBossLevel } from "../utils/enemyHitbox";
import SoundManager from "../utils/sound";

/** Find an open spot ~24 units from the player, inside the zone and clear of rocks. */
const pickBossSpawn = (): [number, number, number] => {
  const s = useGameState.getState();
  const [px, , pz] = s.playerTankPosition;
  const limit = GAME_CONSTANTS.HALF_MAP_SIZE - GAME_CONSTANTS.MAP_BOUNDARY_BUFFER - 3;
  const [cx, cz] = s.safeZoneActive ? s.safeZoneCenter : [0, 0];
  const zoneR = s.safeZoneActive ? Math.max(4, s.safeZoneRadius - 4) : Infinity;

  let best: [number, number, number] = [cx, 0.5, cz];
  for (let attempt = 0; attempt < 24; attempt++) {
    const a = Math.random() * Math.PI * 2;
    const d = 24 - attempt * 0.6;
    let x = Math.max(-limit, Math.min(limit, px + Math.cos(a) * d));
    let z = Math.max(-limit, Math.min(limit, pz + Math.sin(a) * d));
    const fromCenter = Math.hypot(x - cx, z - cz);
    if (fromCenter > zoneR) {
      x = cx + ((x - cx) / fromCenter) * zoneR;
      z = cz + ((z - cz) / fromCenter) * zoneR;
    }
    const blocked = s.terrainObstacles.some(
      (o) =>
        Math.hypot(o.position[0] - x, o.position[2] - z) <
        o.size + GAME_CONSTANTS.BOSS_RADIUS + 1
    );
    best = [x, 0.5, z];
    if (!blocked && Math.hypot(x - px, z - pz) > 12) break;
  }
  return best;
};

/**
 * Spawns a boss on every BOSS_LEVEL_INTERVAL-th level once the upgrade /
 * weapon pickers close. The level can't advance until it's destroyed.
 */
const BossDirector = () => {
  const getState = useRef(useGameState.getState).current;
  const introTimerRef = useRef(0);

  useFrame((_, delta) => {
    const s = getState();
    if (!s.isGameStarted || s.isGameOver || s.isPaused) return;
    if (s.showUpgradeUI || s.showWeaponSelection) return;
    if (!isBossLevel(s.level) || s.bossSpawnedForLevel === s.level) return;

    if (!s.bossIncoming) {
      introTimerRef.current = GAME_CONSTANTS.BOSS_INTRO_DELAY;
      useGameState.setState({ bossIncoming: true });
      SoundManager.setVolume("bossAlarm", 0.6);
      SoundManager.play("bossAlarm");
      return;
    }

    introTimerRef.current -= Math.min(delta, 0.1);
    if (introTimerRef.current > 0) return;

    const bossIndex = Math.floor(s.level / GAME_CONSTANTS.BOSS_LEVEL_INTERVAL) - 1;
    const tankHealth =
      GAME_CONSTANTS.ENEMY_TANK_BASE_HEALTH +
      s.level * GAME_CONSTANTS.ENEMY_HEALTH_SCALE_PER_LEVEL;
    const health = Math.round(
      tankHealth * (GAME_CONSTANTS.BOSS_HEALTH_MULTIPLIER + bossIndex * 2)
    );

    s.spawnEnemy({
      type: "boss",
      position: pickBossSpawn(),
      health,
      maxHealth: health,
      speed: GAME_CONSTANTS.BOSS_SPEED,
    });
    useGameState.setState({
      bossIncoming: false,
      bossActive: true,
      bossSpawnedForLevel: s.level,
    });
  });

  return null;
};

export default BossDirector;
