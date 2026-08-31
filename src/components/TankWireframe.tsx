import React, { useRef, useState, useEffect } from "react";
import { Box, Cylinder, Sphere } from "@react-three/drei";
import { Group, Vector3 } from "three";
import { useFrame } from "@react-three/fiber";
import { useGameState } from "../utils/gameState"; // Import gameState hook

// Animation states
export enum AnimState {
  IDLE, // Fully assembled, not moving
  ASSEMBLING_LOOP, // Original assembling -> rotating loop
  ROTATING, // Looping rotation
  PAUSED, // Looping pause
  ASSEMBLING_ONCE, // DEPRECATED (Assemble once and then stop)
  ASSEMBLING_TRANSITION,
  ROTATING_TRANSITION,
  PAUSED_TRANSITION,
}

// Easing function (ease-out cubic)
const easeOutCubic = (t: number) => 1 - Math.pow(1 - t, 3);

interface TankWireframeProps {
  animationMode?: AnimState;
  onAnimationComplete?: (finalState: AnimState) => void;
}

const TankWireframe: React.FC<TankWireframeProps> = ({
  animationMode = AnimState.ASSEMBLING_LOOP, // Default to looping animation
  onAnimationComplete,
}) => {
  const tankRef = useRef<Group>(null);
  const turretRef = useRef<Group>(null);
  const [animationProgress, setAnimationProgress] = useState(0);
  const [animState, setAnimState] = useState<AnimState>(animationMode);
  const [rotationAngle, setRotationAngle] = useState(0);
  const restartLoopTimeoutRef = useRef<NodeJS.Timeout | null>(null); // Ref to store timeout ID

  // Reset state when animationMode prop changes
  useEffect(() => {
    setAnimState(animationMode);
    setAnimationProgress(0);
    setRotationAngle(0);
    if (
      animationMode === AnimState.IDLE ||
      animationMode === AnimState.PAUSED
    ) {
      setAnimationProgress(1);
    }
  }, [animationMode]);

  // Cleanup timeout on unmount
  useEffect(() => {
    return () => {
      if (restartLoopTimeoutRef.current) {
        clearTimeout(restartLoopTimeoutRef.current);
      }
    };
  }, []);

  // Cleanup timeout if animState changes away from PAUSED
  useEffect(() => {
    if (
      animState !== AnimState.PAUSED &&
      animState !== AnimState.PAUSED_TRANSITION &&
      restartLoopTimeoutRef.current
    ) {
      clearTimeout(restartLoopTimeoutRef.current);
      restartLoopTimeoutRef.current = null;
    }
  }, [animState]);

  // Define the starting positions for each piece (far away)
  const startingPositions = {
    body: new Vector3(0, 20, 0),
    frontPart: new Vector3(0, 25, -1.35),
    leftDetail: new Vector3(-30, 0.35, -0.8),
    rightDetail: new Vector3(30, 0.35, -0.8),
    rearDetail: new Vector3(0, 20, 0.9),
    frontLeftLight: new Vector3(-20, 0.1, 15),
    frontRightLight: new Vector3(20, 0.1, 15),
    rearLeftLight: new Vector3(-30, 0.1, -15),
    rearRightLight: new Vector3(30, 0.1, -15),
    leftTrack: new Vector3(-30, -0.3, 0),
    rightTrack: new Vector3(30, -0.3, 0),
    leftTrackTop: new Vector3(-30, 0.05, 0),
    rightTrackTop: new Vector3(30, 0.05, 0),
    turretBase: new Vector3(0, 30, 0),
    turretTop: new Vector3(0, 35, -0.3),
    cannon: new Vector3(0, 0.25, 15),
    cannonTip: new Vector3(0, 0.25, 16),
    leftArmor: new Vector3(-30, 0.25, 0),
    rightArmor: new Vector3(30, 0.25, 0),
    antenna: new Vector3(0.4, 30, -0.4),
    antennaTop: new Vector3(0.4, 35, -0.4),
    sight: new Vector3(0, 20, 0.5),
    dome: new Vector3(0, 30, 0.2),
    turretConnector: new Vector3(0, 28, 0),
    glacis: new Vector3(0, 22, 10),
    leftSkirt: new Vector3(-30, -0.04, 0),
    rightSkirt: new Vector3(30, -0.04, 0),
    cupola: new Vector3(0.12, 32, -0.18),
    muzzleBrake: new Vector3(0, 0.25, 18),
  };

  // Define the target positions (final positions)
  const targetPositions = {
    body: new Vector3(0, 0, 0),
    frontPart: new Vector3(0, 0.2, -1.35),
    leftDetail: new Vector3(-0.5, 0.35, -0.8),
    rightDetail: new Vector3(0.5, 0.35, -0.8),
    rearDetail: new Vector3(0, 0.35, 0.9),
    frontLeftLight: new Vector3(-0.6, 0.1, 1.15),
    frontRightLight: new Vector3(0.6, 0.1, 1.15),
    rearLeftLight: new Vector3(-0.75, 0.1, -1.15),
    rearRightLight: new Vector3(0.75, 0.1, -1.15),
    leftTrack: new Vector3(-0.8, -0.3, 0),
    rightTrack: new Vector3(0.8, -0.3, 0),
    leftTrackTop: new Vector3(-0.8, 0.05, 0),
    rightTrackTop: new Vector3(0.8, 0.05, 0),
    turretBase: new Vector3(0, 0.25, 0),
    turretTop: new Vector3(0, 0.55, -0.3),
    cannon: new Vector3(0, 0.25, 1.1),
    cannonTip: new Vector3(0, 0.25, 2),
    leftArmor: new Vector3(-0.65, 0.25, 0),
    rightArmor: new Vector3(0.65, 0.25, 0),
    antenna: new Vector3(0.4, 0.55, -0.4),
    antennaTop: new Vector3(0.4, 1.0, -0.4),
    sight: new Vector3(0, 0.4, 0.5),
    dome: new Vector3(0, 0.6, 0.2),
    turretConnector: new Vector3(0, 0.4, 0),
    glacis: new Vector3(0, 0.1, 0.98),
    leftSkirt: new Vector3(-0.94, -0.04, 0),
    rightSkirt: new Vector3(0.94, -0.04, 0),
    cupola: new Vector3(0.12, 0.58, -0.18),
    muzzleBrake: new Vector3(0, 0.25, 2.16),
  };

  // Animation timing for each part (when they start moving, between 0 and 1)
  const animationStarts = {
    body: 0,
    frontPart: 0.05,
    leftDetail: 0.1,
    rightDetail: 0.1,
    rearDetail: 0.15,
    frontLeftLight: 0.2,
    frontRightLight: 0.2,
    rearLeftLight: 0.22,
    rearRightLight: 0.22,
    leftTrack: 0.25,
    rightTrack: 0.25,
    leftTrackTop: 0.28,
    rightTrackTop: 0.28,
    rollers: 0.32,
    turretConnector: 0.43,
    turretBase: 0.45,
    turretTop: 0.5,
    cannon: 0.55,
    cannonTip: 0.6,
    leftArmor: 0.65,
    rightArmor: 0.65,
    antenna: 0.7,
    antennaTop: 0.72,
    sight: 0.75,
    dome: 0.78,
    glacis: 0.07,
    leftSkirt: 0.26,
    rightSkirt: 0.26,
    cupola: 0.8,
    muzzleBrake: 0.62,
  };

  // Roller positions with calculated interpolations
  const rollerPositionsLeft = [...Array(6)].map((_, i) => ({
    start: new Vector3(-30, -0.3, -0.8 + i * 0.36),
    end: new Vector3(-0.8, -0.3, -0.8 + i * 0.36),
    delay: i * 0.01,
  }));

  const rollerPositionsRight = [...Array(6)].map((_, i) => ({
    start: new Vector3(30, -0.3, -0.8 + i * 0.36),
    end: new Vector3(0.8, -0.3, -0.8 + i * 0.36),
    delay: i * 0.01,
  }));

  // Calculate position based on animation progress
  const getPosition = (partName: string, progress: number) => {
    if (animState === AnimState.IDLE) {
      return targetPositions[partName as keyof typeof targetPositions];
    }

    const start = startingPositions[partName as keyof typeof startingPositions];
    const end = targetPositions[partName as keyof typeof targetPositions];
    const partStartTime =
      animationStarts[partName as keyof typeof animationStarts];

    if (progress < partStartTime) return start;
    if (progress > partStartTime + 0.2) return end;

    const partProgress = (progress - partStartTime) / 0.2;
    const easedProgress = easeOutCubic(partProgress);
    return new Vector3(
      start.x + (end.x - start.x) * easedProgress,
      start.y + (end.y - start.y) * easedProgress,
      start.z + (end.z - start.z) * easedProgress
    );
  };

  // Get roller position with individual delays
  const getRollerPosition = (
    isLeft: boolean,
    index: number,
    progress: number
  ) => {
    if (animState === AnimState.IDLE) {
      const positions = isLeft ? rollerPositionsLeft : rollerPositionsRight;
      return positions[index].end;
    }

    const positions = isLeft ? rollerPositionsLeft : rollerPositionsRight;
    const { start, end, delay } = positions[index];
    const rollerStartTime = animationStarts.rollers + delay;

    if (progress < rollerStartTime) return start;
    if (progress > rollerStartTime + 0.15) return end;

    const partProgress = (progress - rollerStartTime) / 0.15;
    const easedProgress = easeOutCubic(partProgress);
    return new Vector3(
      start.x + (end.x - start.x) * easedProgress,
      start.y + (end.y - start.y) * easedProgress,
      start.z + (end.z - start.z) * easedProgress
    );
  };

  // Animation loop using useFrame
  useFrame((_, delta) => {
    const assemblySpeed = 0.25;
    const rotationSpeed = 0.25;

    if (animState === AnimState.ASSEMBLING_LOOP) {
      setAnimationProgress((prev) => {
        const newProgress = prev + delta * assemblySpeed;
        if (newProgress >= 1) {
          setAnimState(AnimState.ROTATING);
          return 1;
        }
        return newProgress;
      });
    } else if (animState === AnimState.ASSEMBLING_ONCE) {
      setAnimationProgress((prev) => {
        const newProgress = prev + delta * assemblySpeed;
        if (newProgress >= 1) {
          setAnimState(AnimState.IDLE);
          onAnimationComplete?.(AnimState.IDLE);
          return 1;
        }
        return newProgress;
      });
    } else if (animState === AnimState.ROTATING) {
      setRotationAngle((prev) => {
        const newAngle = prev + delta * rotationSpeed;
        const targetRotation = Math.PI * 2;
        if (newAngle >= targetRotation) {
          setAnimState(AnimState.PAUSED);
          if (restartLoopTimeoutRef.current) {
            clearTimeout(restartLoopTimeoutRef.current);
          }
          restartLoopTimeoutRef.current = setTimeout(() => {
            setAnimState((currentState) => {
              if (currentState === AnimState.PAUSED) {
                setAnimationProgress(0);
                return AnimState.ASSEMBLING_LOOP;
              }
              return currentState;
            });
          }, 1000);
          return targetRotation % (Math.PI * 2);
        }
        return newAngle;
      });
    } else if (animState === AnimState.ASSEMBLING_TRANSITION) {
      setAnimationProgress((prev) => {
        const newProgress = prev + delta * assemblySpeed;
        if (newProgress >= 1) {
          onAnimationComplete?.(AnimState.IDLE);
          useGameState.setState({ isWireframeAssembled: true });
          setAnimState(AnimState.IDLE);
          return 1;
        }
        return newProgress;
      });
    } else if (animState === AnimState.ROTATING_TRANSITION) {
      setRotationAngle((prev) => {
        const newAngle = prev + delta * rotationSpeed;
        const targetRotation = Math.PI * 2;
        if (newAngle >= targetRotation) {
          setAnimState(AnimState.PAUSED_TRANSITION);
          if (restartLoopTimeoutRef.current) {
            clearTimeout(restartLoopTimeoutRef.current);
          }
          const transitionPauseDuration = 500;
          restartLoopTimeoutRef.current = setTimeout(() => {
            onAnimationComplete?.(AnimState.IDLE);
            setAnimState(AnimState.IDLE);
            setRotationAngle(0);
          }, transitionPauseDuration);
          return targetRotation % (Math.PI * 2);
        }
        return newAngle;
      });
    }
  });

  // Determine current positions based on progress or IDLE state
  const currentProgress = animState === AnimState.IDLE ? 1 : animationProgress;
  const currentRotation = animState === AnimState.IDLE ? 0 : rotationAngle;

  // Dynamic scale: 1.0 for IDLE, 1.5 for animation states
  const tankScale = animState === AnimState.IDLE ? 1.0 : 1.5;

  return (
    <group
      ref={tankRef}
      position={[0, 0, 0]}
      scale={tankScale}
      rotation={[0, currentRotation, 0]}>
      {/* Tank Body */}
      <Box
        args={[1.8, 0.6, 2.2]}
        position={getPosition("body", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[1.2, 0.4, 0.5]}
        position={getPosition("frontPart", currentProgress).toArray()}
        rotation={[Math.PI / 6, 0, 0]}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[1.72, 0.2, 0.58]}
        position={getPosition("glacis", currentProgress).toArray()}
        rotation={[-0.42, 0, 0]}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.1, 0.3, 2.28]}
        position={getPosition("leftSkirt", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.1, 0.3, 2.28]}
        position={getPosition("rightSkirt", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.5, 0.1, 0.3]}
        position={getPosition("leftDetail", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.5, 0.1, 0.3]}
        position={getPosition("rightDetail", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.8, 0.1, 0.25]}
        position={getPosition("rearDetail", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>

      {/* Lights (front and back) */}
      <Box
        args={[0.15, 0.1, 0.05]}
        position={getPosition("frontLeftLight", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.15, 0.1, 0.05]}
        position={getPosition("frontRightLight", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.15, 0.1, 0.05]}
        position={getPosition("rearLeftLight", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.15, 0.1, 0.05]}
        position={getPosition("rearRightLight", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>

      {/* Tank Tracks */}
      <Box
        args={[0.4, 0.25, 2.4]}
        position={getPosition("leftTrack", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.4, 0.25, 2.4]}
        position={getPosition("rightTrack", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.2, 0.1, 2.2]}
        position={getPosition("leftTrackTop", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>
      <Box
        args={[0.2, 0.1, 2.2]}
        position={getPosition("rightTrackTop", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Box>

      {/* Tank Rollers */}
      {[...Array(6)].map((_, i) => (
        <Cylinder
          key={`roller-l-${i}`}
          args={[0.12, 0.12, 0.1, 6]}
          position={getRollerPosition(true, i, currentProgress).toArray()}
          rotation={[0, 0, Math.PI / 2]}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
      ))}
      {[...Array(6)].map((_, i) => (
        <Cylinder
          key={`roller-r-${i}`}
          args={[0.12, 0.12, 0.1, 6]}
          position={getRollerPosition(false, i, currentProgress).toArray()}
          rotation={[0, 0, Math.PI / 2]}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
      ))}

      {/* Turret Connecting Cylinder */}
      <Cylinder
        args={[0.6, 0.6, 0.15, 12]}
        position={getPosition("turretConnector", currentProgress).toArray()}>
        <meshBasicMaterial
          color="#00FF00"
          wireframe={true}
          opacity={0.8}
          transparent={true}
        />
      </Cylinder>

      {/* Tank Turret Group */}
      <group position={[0, 0.475, 0]} ref={turretRef}>
        <Cylinder
          args={[0.7, 0.8, 0.5, 12]}
          position={getPosition("turretBase", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.35, 0.35, 0.15, 8]}
          position={getPosition("turretTop", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.12, 0.12, 1.8, 8]}
          position={getPosition("cannon", currentProgress).toArray()}
          rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.18, 0.18, 0.3, 8]}
          position={getPosition("cannonTip", currentProgress).toArray()}
          rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.14, 0.2, 0.12, 8]}
          position={getPosition("muzzleBrake", currentProgress).toArray()}
          rotation={[Math.PI / 2, 0, 0]}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.22, 0.22, 0.14, 8]}
          position={getPosition("cupola", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Box
          args={[0.25, 0.35, 1]}
          position={getPosition("leftArmor", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Box>
        <Box
          args={[0.25, 0.35, 1]}
          position={getPosition("rightArmor", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Box>
        <Cylinder
          args={[0.05, 0.05, 0.2, 6]}
          position={getPosition("antenna", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Cylinder
          args={[0.02, 0.02, 1.0, 6]}
          position={getPosition("antennaTop", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Cylinder>
        <Box
          args={[0.25, 0.15, 0.15]}
          position={getPosition("sight", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Box>
        <Sphere
          args={[0.15, 8, 8]}
          position={getPosition("dome", currentProgress).toArray()}>
          <meshBasicMaterial
            color="#00FF00"
            wireframe={true}
            opacity={0.8}
            transparent={true}
          />
        </Sphere>
      </group>
    </group>
  );
};

export default TankWireframe;
