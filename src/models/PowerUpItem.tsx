import { useRef } from "react";
import { useFrame } from "@react-three/fiber";
import { Group, Mesh } from "three";
import { PowerUp, useGameState } from "../utils/gameState";
import { getPickupAssets } from "./pickups/pickupAssets";
import GlowSprite from "./fx/GlowSprite";
import { fx, FX_COLORS } from "./fx/fxSystem";

interface PowerUpItemProps {
  powerUp: PowerUp;
}

// Power-up lives 15s, then blinks for its final 5s
const LIFETIME = 20;
const BLINK_WINDOW = 5;
const HOVER_HEIGHT = 0.8;

const Medkit = () => {
  const { geometry: g, material: m } = getPickupAssets();
  return (
    <group rotation={[0.18, 0, 0.08]}>
      <mesh geometry={g.medkitCase} material={m.medkitShell} castShadow />
      <mesh geometry={g.medkitSeam} material={m.medkitTrim} position={[0, 0.07, 0]} />
      <mesh geometry={g.crossLong} material={m.medkitCross} position={[0, 0.245, 0]} />
      <mesh geometry={g.crossShort} material={m.medkitCross} position={[0, 0.245, 0]} />
      {[1, -1].map((side) => (
        <group key={side} position={[0, -0.03, side * 0.283]}>
          <mesh geometry={g.crossSideV} material={m.medkitCross} />
          <mesh geometry={g.crossSideH} material={m.medkitCross} />
        </group>
      ))}
      <mesh geometry={g.handleBar} material={m.medkitTrim} position={[0, 0.33, 0]} />
      <mesh geometry={g.handlePost} material={m.medkitTrim} position={[-0.135, 0.28, 0]} />
      <mesh geometry={g.handlePost} material={m.medkitTrim} position={[0.135, 0.28, 0]} />
      <mesh geometry={g.latch} material={m.medkitTrim} position={[-0.27, 0.07, 0.29]} />
      <mesh geometry={g.latch} material={m.medkitTrim} position={[0.27, 0.07, 0.29]} />
    </group>
  );
};

const Coin = () => {
  const { geometry: g, material: m } = getPickupAssets();
  return (
    <group scale={0.95}>
      <mesh geometry={g.coinDisc} material={m.gold} castShadow />
      <mesh geometry={g.coinRim} material={m.gold} />
      <mesh geometry={g.coinFace} material={m.goldDeep} />
      <mesh geometry={g.coinStar} material={m.gold} position={[0, 0, 0.05]} />
      <mesh geometry={g.coinStar} material={m.gold} position={[0, 0, -0.05]} rotation={[0, Math.PI, 0]} />
    </group>
  );
};

const PowerUpItem = ({ powerUp }: PowerUpItemProps) => {
  const floatRef = useRef<Group>(null);
  const ringRef = useRef<Mesh>(null);
  const lifeTimeRef = useRef(LIFETIME);
  const spinRef = useRef(Math.random() * Math.PI * 2);

  // Get only the collectPowerUp function, use direct store access for position
  const collectPowerUp = useGameState((state) => state.collectPowerUp);
  const getState = useRef(useGameState.getState).current;

  const isCoin = powerUp.type === "coin";
  const { geometry, material } = getPickupAssets();

  // Hover animation and collision detection with player tank
  useFrame((state, delta) => {
    if (!floatRef.current) return;

    const playerTankPosition = getState().playerTankPosition;
    if (!playerTankPosition) return;

    lifeTimeRef.current -= delta;
    if (lifeTimeRef.current <= 0) {
      collectPowerUp(powerUp.id, false);
      return;
    }

    const t = state.clock.getElapsedTime();

    // Expiring pickups blink faster as they run out
    let visible = true;
    if (lifeTimeRef.current <= BLINK_WINDOW) {
      const urgency = 1 - lifeTimeRef.current / BLINK_WINDOW;
      visible = Math.sin(t * (8 + urgency * 22)) > -0.35;
    }
    floatRef.current.visible = visible;

    spinRef.current += delta * (isCoin ? 2.6 : 1.2);
    floatRef.current.rotation.y = spinRef.current;
    floatRef.current.position.y = HOVER_HEIGHT + Math.sin(t * 3) * 0.15;

    if (ringRef.current) {
      ringRef.current.visible = visible;
      const pulse = 1 + ((t * 0.9) % 1) * 0.25;
      ringRef.current.scale.set(pulse, pulse, pulse);
    }

    // Check for collision with player tank
    const dx = playerTankPosition[0] - powerUp.position[0];
    const dy = playerTankPosition[1] - powerUp.position[1];
    const dz = playerTankPosition[2] - powerUp.position[2];
    const distance = Math.sqrt(dx * dx + dy * dy + dz * dz);

    // If player is close enough, collect the power-up
    if (distance < 2) {
      fx.pickup(
        powerUp.position[0],
        powerUp.position[1] + HOVER_HEIGHT,
        powerUp.position[2],
        isCoin ? FX_COLORS.coin : FX_COLORS.health
      );
      collectPowerUp(powerUp.id, true);
    }
  });

  return (
    <group position={powerUp.position}>
      <group ref={floatRef} position={[0, HOVER_HEIGHT, 0]}>
        {isCoin ? <Coin /> : <Medkit />}
        <GlowSprite
          color={isCoin ? "#ffcf4a" : "#ff4040"}
          size={isCoin ? 1.9 : 2.3}
          opacity={0.42}
        />
      </group>
      <mesh
        ref={ringRef}
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.04, 0]}
        geometry={geometry.groundRing}
        material={isCoin ? material.coinRing : material.healthRing}
        renderOrder={2}
      />
    </group>
  );
};

export default PowerUpItem;
