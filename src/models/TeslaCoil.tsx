import { useRef, useEffect, useState, RefObject } from "react"; // Import RefObject
import { Group, Object3DEventMap } from "three"; // Import Object3DEventMap
import { SecondaryWeapon } from "../utils/gameState";
import { debug } from "../utils/debug";
import TeslaArc from "./TeslaArc";
import { useWeaponTracking } from "../utils/weaponTracking";
import { TeslaModel } from "./weaponVisuals/WeaponModels";

interface TeslaCoilProps {
  weaponInstance: SecondaryWeapon;
  position: [number, number, number];
  rotation: number;
}

interface ActiveArcData {
  id: string;
  position: [number, number, number];
  rotation: number;
  targetId: string;
  damage: number;
  range: number;
}

const TeslaCoil = ({ weaponInstance, position, rotation }: TeslaCoilProps) => {
  // Initialize the ref correctly for a Group
  const coilRef = useRef<Group<Object3DEventMap>>(null);
  const [activeArcs, setActiveArcs] = useState<ActiveArcData[]>([]);

  // Use the shared weapon tracking logic and get enhanced range
  const { instanceId, weaponRange } = useWeaponTracking({
    weaponInstance,
    position,
    rotation,
    // Use type assertion here:
    weaponRef: coilRef as RefObject<Group<Object3DEventMap>>,
    barrelLength: 0,
    fireOffsetY: 0.7,
    onFire: (firePosition, targetId) => {
      if (!targetId) return;

      const arcId = `${instanceId}-${Date.now()}-${Math.random()
        .toString(36)
        .substring(2, 7)}`;
      setActiveArcs((prevArcs) => [
        ...prevArcs,
        {
          id: arcId,
          position: firePosition,
          rotation: coilRef.current?.rotation.y ?? 0,
          targetId: targetId,
          damage: weaponInstance.damage,
          range: weaponRange, // Use enhanced range
        },
      ]);
    },
  });

  const removeArc = (id: string) => {
    setActiveArcs((prevArcs) => prevArcs.filter((arc) => arc.id !== id));
  };

  useEffect(() => {
    debug.log(`Tesla Coil instance ${instanceId} mounted.`);
    return () => {
      debug.log(`Tesla Coil instance ${instanceId} unmounted`);
      setActiveArcs([]);
    };
  }, [instanceId]);

  // Apply position and rotation to the group
  useEffect(() => {
    if (coilRef.current) {
      coilRef.current.position.set(...position);
      coilRef.current.rotation.set(0, rotation, 0);
    }
  }, [position, rotation]);

  const getCoilWorldPosition = (): [number, number, number] | null => {
    const p = coilRef.current?.position;
    return p ? [p.x, p.y, p.z] : null;
  };

  return (
    <>
      {/* Tesla Coil weapon model Group */}
      <group ref={coilRef}>
        <TeslaModel getWorldPosition={getCoilWorldPosition} />
      </group>

      {/* Render tesla arcs */}
      {activeArcs.map((arc) => (
        <TeslaArc
          key={arc.id}
          id={arc.id}
          position={arc.position}
          rotation={arc.rotation}
          damage={arc.damage}
          targetId={arc.targetId}
          range={arc.range}
          onRemove={removeArc}
        />
      ))}
    </>
  );
};

export default TeslaCoil;
