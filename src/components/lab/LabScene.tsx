"use client";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { easing } from "maath";
import { OrbitControls, ContactShadows, useCursor } from "@react-three/drei";
import { useRef, useEffect, useMemo, useState, Suspense, lazy } from "react";
import { PCFShadowMap, SRGBColorSpace, Vector3 } from "three";
import { OrbitControls as OrbitControlsImpl } from "three-stdlib";
import { useTexture } from "@react-three/drei";
import AdaptiveResolution from "./AdaptiveResolution";
import ResearchDevice from "./ResearchDevice";
import FacilityDetails, { GpuTower } from "./FacilityDetails";
import CapabilityEquipment from "./CapabilityEquipment";
import ArchiveRack from "./ArchiveRack";
import { ResearchMonitor, ResearchProjector } from "./ResearchMedia";
import { labStations, labPalette, cameraTargets, type Station } from "@/lib/lab-scene-config";
import { Block, Print, Monitor, Cable, StationLabel } from "./ScenePrimitives";
const LabPostProcessing = lazy(() => import("./LabPostProcessing"));
import {
  researchDevices,
  type ArchiveSelection,
  type DeviceId,
  type LabContent,
  type LabView,
  type Quality,
  type Vector,
} from "@/lib/lab-devices";

export type CameraCommand = {
  kind: "left" | "right" | "in" | "out" | "fwd" | "back" | "strafeL" | "strafeR";
  tick: number;
};
export type SceneProps = {
  theme?: "night" | "day" | "blossom";
  view: LabView;
  quality: Quality;
  motion: boolean;
  visible: boolean;
  debug: boolean;
  fault: number;
  content: LabContent;
  visited: DeviceId[];
  command: CameraCommand | null;
  onView: (view: LabView) => void;
  onPublication: (id: number) => void;
  selection: ArchiveSelection | null;
  onArchive: (selection: ArchiveSelection) => void;
  slideIndex: number;
  videoElement?: HTMLVideoElement | null;
  onStatus: (id: DeviceId, status: string) => void;
  onReady: () => void;
  onFailure: () => void;
};
const views = cameraTargets;

// Two-digit station number shared with the toolbar, so hover pills match.
function stationNumber(id: LabView) {
  return String(
    Math.max(0, labStations.findIndex((s) => s.id === id)),
  ).padStart(2, "0");
}

// World convention: 1 unit = 1m. Bench surface y=0.9, eye y=1.6,
// wall height 2.9, room 9.6 x 7.2.
const BENCH_SURFACE = 0.9;
const WALL_H = 2.9;

// Static dust motes: parallax depth with zero frame cost. No animation, so
// demand rendering stays idle; points only re-render when the camera moves.
// Hidden on low quality to save fill.
function LabDust({ theme }: { theme: "night" | "day" | "blossom" }) {
  const positions = useMemo(() => {
    const count = 170;
    const arr = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      arr[i * 3] = (Math.random() - 0.5) * 10.4;
      arr[i * 3 + 1] = 0.2 + Math.random() * 2.6;
      arr[i * 3 + 2] = (Math.random() - 0.5) * 8;
    }
    return arr;
  }, []);
  const color =
    theme === "night" ? "#9ddde7" : theme === "blossom" ? "#f0cfe2" : "#ffffff";
  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" args={[positions, 3]} />
      </bufferGeometry>
      <pointsMaterial
        size={0.022}
        color={color}
        transparent
        opacity={theme === "night" ? 0.32 : 0.22}
        depthWrite={false}
        sizeAttenuation
      />
    </points>
  );
}

function CameraRig({
  view,
  motion,
  command,
}: Pick<SceneProps, "view" | "motion" | "command">) {
  const controls = useRef<OrbitControlsImpl>(null);
  const { camera, invalidate } = useThree();
  const moving = useRef(true);
  // Glide target for walk/orbit/zoom commands: damped every frame so manual
  // movement feels like a gimbal, not stair-steps.
  const glide = useRef<{ pos: Vector3; tgt: Vector3 } | null>(null);
  const device = researchDevices.find((d) => d.id === view);
  const destination = device || views[view] || views.overview;
  const goal = useMemo(() => new Vector3(...destination.camera), [destination]);
  const target = useMemo(
    () => new Vector3(...destination.target),
    [destination],
  );
  useEffect(() => {
    moving.current = true;
    glide.current = null;
    if (controls.current) controls.current.enabled = false;
    invalidate();
  }, [view, goal, target, invalidate]);
  useFrame((_, delta) => {
    if (!controls.current) return;
    if (glide.current) {
      if (motion) {
        easing.damp3(camera.position, glide.current.pos, 7, delta);
        easing.damp3(controls.current.target, glide.current.tgt, 7, delta);
      } else {
        camera.position.copy(glide.current.pos);
        controls.current.target.copy(glide.current.tgt);
      }
      controls.current.update();
      if (
        camera.position.distanceTo(glide.current.pos) < 0.01 &&
        controls.current.target.distanceTo(glide.current.tgt) < 0.01
      ) {
        glide.current = null;
        if (!moving.current) controls.current.enabled = true;
      } else invalidate();
      return;
    }
    if (!moving.current) return;
    if (motion) {
      easing.damp3(camera.position, goal, 0.25, delta);
      easing.damp3(controls.current.target, target, 0.25, delta);
    } else {
      camera.position.copy(goal);
      controls.current.target.copy(target);
    }
    controls.current.update();
    if (
      camera.position.distanceTo(goal) < 0.006 &&
      controls.current.target.distanceTo(target) < 0.006
    ) {
      camera.position.copy(goal);
      controls.current.target.copy(target);
      controls.current.update();
      moving.current = false;
      controls.current.enabled = true;
    } else invalidate();
  });
  useEffect(() => {
    if (!command || !controls.current || moving.current) return;
    const target = controls.current.target;
    // Walk moves camera + target together on the ground plane so the view
    // direction is preserved. Clamped to the room; eye stays usable.
    if (
      command.kind === "fwd" ||
      command.kind === "back" ||
      command.kind === "strafeL" ||
      command.kind === "strafeR"
    ) {
      const forward = target.clone().sub(camera.position);
      forward.y = 0;
      if (forward.lengthSq() < 1e-6) forward.set(0, 0, -1);
      forward.normalize();
      const right = new Vector3(-forward.z, 0, forward.x);
      const step = new Vector3();
      if (command.kind === "fwd") step.copy(forward).multiplyScalar(0.45);
      else if (command.kind === "back") step.copy(forward).multiplyScalar(-0.45);
      else if (command.kind === "strafeL") step.copy(right).multiplyScalar(-0.45);
      else step.copy(right).multiplyScalar(0.45);
      const nextTarget = target.clone().add(step);
      nextTarget.x = Math.max(-5, Math.min(5, nextTarget.x));
      nextTarget.z = Math.max(-3.8, Math.min(3.8, nextTarget.z));
      nextTarget.y = Math.max(0.4, Math.min(2.4, nextTarget.y));
      const pos = camera.position
        .clone()
        .add(nextTarget.clone().sub(target));
      pos.x = Math.max(-5.2, Math.min(5.2, pos.x));
      pos.z = Math.max(-4, Math.min(6.6, pos.z));
      pos.y = Math.max(0.5, Math.min(3.0, pos.y));
      if (motion) {
        glide.current = { pos, tgt: nextTarget };
        controls.current.enabled = false;
      } else {
        camera.position.copy(pos);
        target.copy(nextTarget);
        controls.current.update();
      }
      invalidate();
      return;
    }
    const offset = camera.position.clone().sub(target);
    if (command.kind === "left" || command.kind === "right")
      offset.applyAxisAngle(
        new Vector3(0, 1, 0),
        command.kind === "left" ? -0.25 : 0.25,
      );
    else
      offset.setLength(
        Math.max(
          device?.minDistance || 1.2,
          Math.min(
            device?.maxDistance || 13,
            offset.length() * (command.kind === "in" ? 0.85 : 1.15),
          ),
        ),
      );
    const pos = target.clone().add(offset);
    if (motion) {
      glide.current = { pos, tgt: target.clone() };
      controls.current.enabled = false;
    } else {
      camera.position.copy(pos);
      controls.current.update();
    }
    invalidate();
  }, [command, camera, device, motion, invalidate]);
  const isOverview = !device && view === "overview";
  return (
    <OrbitControls
      ref={controls}
      makeDefault
      enablePan={false}
      enableDamping={motion}
      dampingFactor={0.07}
      minDistance={device?.minDistance || 1.2}
      maxDistance={device?.maxDistance || 13}
      minPolarAngle={0.25}
      maxPolarAngle={Math.PI / 2 - 0.05}
      minAzimuthAngle={isOverview ? -Math.PI / 1.1 : -Infinity}
      maxAzimuthAngle={isOverview ? Math.PI / 1.1 : Infinity}
      rotateSpeed={0.5}
      zoomSpeed={0.6}
    />
  );
}

// Authored bench: laminate top, steel frame, modesty panel, drawer stack,
// cable tray. Surface lands exactly at BENCH_SURFACE so hero devices sit grounded.
function Bench({
  x,
  z = -1,
  width = 2.7,
  depth = 1.35,
  tone = "#3d4f45",
}: {
  x: number;
  z?: number;
  width?: number;
  depth?: number;
  tone?: string;
}) {
  const topY = BENCH_SURFACE - 0.025;
  return (
    <group position={[x, 0, z]}>
      {/* top */}
      <Block
        position={[0, topY, 0]}
        size={[width, 0.05, depth]}
        color={tone}
        roughness={0.42}
      />
      {/* pale lab edge */}
      <Block
        position={[0, topY + 0.028, 0]}
        size={[width - 0.02, 0.008, depth - 0.02]}
        color="#c9d1c0"
        roughness={0.5}
      />
      {/* rear upstand: keeps glassware off the floor gap, catches cables */}
      <Block
        position={[0, topY + 0.07, -depth / 2 + 0.02]}
        size={[width, 0.1, 0.03]}
        color={tone}
        roughness={0.5}
      />
      {/* steel legs */}
      {[-1, 1].map((sx) =>
        [-1, 1].map((sz) => (
          <Block
            key={`${sx}${sz}`}
            position={[(sx * (width / 2 - 0.08)), 0.425, sz * (depth / 2 - 0.08)]}
            size={[0.06, 0.85, 0.06]}
            color="#7d8f95"
            metalness={0.85}
            roughness={0.35}
          />
        )),
      )}
      {/* modesty + crossbar */}
      <Block
        position={[0, 0.45, -depth / 2 + 0.06]}
        size={[width - 0.2, 0.5, 0.03]}
        color="#33484e"
        roughness={0.7}
      />
      {/* drawer stack left */}
      <group position={[-(width / 2 - 0.42), 0, 0.05]}>
        <Block
          position={[0, 0.45, 0]}
          size={[0.68, 0.78, depth - 0.35]}
          color="#d4d8ca"
          roughness={0.6}
        />
        {[0.28, 0.5, 0.72].map((y) => (
          <group key={y}>
            <Block
              position={[0, y, (depth - 0.35) / 2 + 0.005]}
              size={[0.62, 0.19, 0.015]}
              color="#bfc7b8"
              roughness={0.6}
            />
            <Block
              position={[0, y + 0.03, (depth - 0.35) / 2 + 0.02]}
              size={[0.22, 0.018, 0.02]}
              color="#4c5e55"
              metalness={0.6}
              roughness={0.4}
            />
          </group>
        ))}
      </group>
      {/* cable tray + power */}
      <Block
        position={[width / 2 - 0.5, 0.78, -depth / 2 + 0.12]}
        size={[0.7, 0.06, 0.12]}
        color="#2b3a40"
        roughness={0.8}
      />
      <Block
        position={[width / 2 - 0.5, 0.82, -depth / 2 + 0.12]}
        size={[0.5, 0.03, 0.06]}
        color="#8a3b3b"
        roughness={0.6}
      />
    </group>
  );
}

function SuspendedLights({ theme }: { theme: "night" | "day" | "blossom" }) {
  // No solid ceiling slab: battens hang at y=2.85 so the entry overview
  // never clips geometry, but the room still reads as a lit facility.
  const warm = theme === "night" ? "#fff2d7" : theme === "blossom" ? "#ffe9d6" : "#fff8e8";
  return (
    <group>
      {[-3.1, 0.2, 3.3].map((x) => (
        <group key={x} position={[x, 0, -0.6]}>
          <Block
            position={[0, 2.86, 0]}
            size={[2.2, 0.06, 0.32]}
            color="#202e34"
            roughness={0.6}
          />
          <mesh position={[0, 2.825, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[2.05, 0.24]} />
            <meshStandardMaterial
              color={warm}
              emissive={warm}
              emissiveIntensity={theme === "night" ? 1.0 : 0.55}
              roughness={0.8}
            />
          </mesh>
          {[-0.85, 0.85].map((dx) => (
            <Block
              key={dx}
              position={[dx, 3.02, 0]}
              size={[0.02, 0.32, 0.02]}
              color="#5b6d72"
              metalness={0.7}
              roughness={0.4}
            />
          ))}
        </group>
      ))}
      {/* wall-wash cove along north wall */}
      <Block
        position={[0, 2.72, -4.1]}
        size={[10, 0.05, 0.08]}
        color="#202e34"
        roughness={0.7}
      />
      <mesh position={[0, 2.68, -4.08]} rotation={[0.25, 0, 0]}>
        <planeGeometry args={[9.8, 0.1]} />
        <meshStandardMaterial
          color={warm}
          emissive={warm}
          emissiveIntensity={0.35}
          roughness={0.9}
        />
      </mesh>
    </group>
  );
}

function WorkstationDetails() {
  return (
    <>
      {/* sample handling tray on imaging bench */}
      <Block
        position={[-4.4, BENCH_SURFACE + 0.03, -0.55]}
        size={[0.5, 0.05, 0.34]}
        color="#4a5c5a"
        roughness={0.6}
      />
      {[0, 1, 2].map((i) => (
        <Block
          key={i}
          position={[-4.55 + i * 0.15, BENCH_SURFACE + 0.075, -0.55]}
          size={[0.1, 0.05, 0.24]}
          color="#ceddd5"
          roughness={0.2}
        />
      ))}
      {/* reagent bottles, engineering side */}
      <Block
        position={[4.35, BENCH_SURFACE + 0.11, -0.5]}
        size={[0.28, 0.22, 0.18]}
        color="#cad0c0"
        roughness={0.5}
      />
      <Block
        position={[4.35, BENCH_SURFACE + 0.13, -0.4]}
        size={[0.15, 0.06, 0.008]}
        color="#4c5e55"
        roughness={0.6}
      />
      {/* small-parts tray, engineering bench left end: prototype hardware */}
      <group position={[2.18, BENCH_SURFACE, -0.75]}>
        <Block
          position={[0, 0.02, 0]}
          size={[0.36, 0.04, 0.26]}
          color="#3a4d53"
          metalness={0.4}
          roughness={0.5}
        />
        {[-0.1, 0, 0.1].map((dx, i) => (
          <mesh key={dx} position={[dx, 0.085, i % 2 ? 0.05 : -0.05]}>
            <cylinderGeometry args={[0.024, 0.024, 0.09, 10]} />
            <meshStandardMaterial
              color={i === 1 ? "#8b9aa0" : "#5d737a"}
              metalness={0.85}
              roughness={0.35}
            />
          </mesh>
        ))}
        <Block
          position={[0.02, 0.055, -0.055]}
          size={[0.12, 0.03, 0.07]}
          color="#a9604c"
          roughness={0.6}
        />
      </group>
      <Block
        position={[3.9, BENCH_SURFACE + 0.13, -0.4]}
        size={[0.15, 0.06, 0.008]}
        color="#4c5e55"
        roughness={0.6}
      />
      <Cable
        points={[
          [-4.7, BENCH_SURFACE - 0.02, -1.4],
          [-5.0, 0.7, -1.7],
          [-4.95, 0.25, -1.75],
        ]}
      />
      <Cable
        points={[
          [4.35, BENCH_SURFACE - 0.02, -1.45],
          [4.7, 0.7, -1.7],
          [4.55, 0.2, -1.8],
        ]}
      />
      {/* task lamps: real spot housings, light comes from Room rig */}
      {[-4.4, 4.1].map((x) => (
        <group key={x} position={[x, BENCH_SURFACE, -1.4]}>
          <Block
            position={[0, 0.25, 0]}
            size={[0.04, 0.5, 0.04]}
            color="#3a4a50"
            metalness={0.7}
            roughness={0.4}
          />
          <Block
            position={[0, 0.52, 0.12]}
            size={[0.3, 0.06, 0.16]}
            color="#24333a"
            metalness={0.4}
            roughness={0.5}
          />
          <mesh position={[0, 0.485, 0.12]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[0.24, 0.1]} />
            <meshStandardMaterial
              color="#ffe9c4"
              emissive="#ffe9c4"
              emissiveIntensity={0.9}
            />
          </mesh>
        </group>
      ))}
    </>
  );
}

function Drawing({
  url,
  position,
  rotation,
}: {
  url: string;
  position: Vector;
  rotation?: Vector;
}) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;
  const image = texture.image as { width: number; height: number };
  const ratio = image.width / image.height;
  const width = Math.min(1.05, 0.75 * ratio),
    height = width / ratio;
  return (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      <Block
        position={[0, 0, -0.03]}
        size={[1.12, 0.8, 0.035]}
        color="#2c3f45"
        roughness={0.7}
      />
      <mesh>
        <planeGeometry args={[width, height]} />
        <meshBasicMaterial map={texture} toneMapped={false} />
      </mesh>
      <Block
        position={[0, -0.47, 0.005]}
        size={[1.12, 0.09, 0.01]}
        color="#c9d1c0"
        roughness={0.8}
      />
    </group>
  );
}

function ComputationalWorkstation({
  content,
  view,
  visible,
  motion,
  onView,
}: Pick<SceneProps, "content" | "view" | "onView" | "visible" | "motion">) {
  const projects = content.computationalProjects || [];
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return (
    <group
      position={[0, 0, 0.55]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onView("computational");
      }}
    >
      {hovered && (
        <StationLabel
          position={[0, 1.78, 0]}
          index={stationNumber("computational")}
          title="AI workstation"
          onSelect={() => onView("computational")}
        />
      )}
      {/* freestanding desk, lower than wet benches */}
      <Block
        position={[0, 0.72, 0]}
        size={[1.9, 0.05, 0.8]}
        color="#46584f"
        roughness={0.45}
      />
      {[-0.85, 0.85].map((x) => (
        <Block
          key={x}
          position={[x, 0.36, 0]}
          size={[0.06, 0.72, 0.7]}
          color="#5d737a"
          metalness={0.6}
          roughness={0.4}
        />
      ))}
      <Block
        position={[0, 0.2, -0.28]}
        size={[1.6, 0.4, 0.04]}
        color="#2c3a40"
        roughness={0.8}
      />
      {[-0.48, 0.48].map((x, i) => (
        <ResearchMonitor
          key={x}
          position={[x, 0.74, -0.12]}
          label={projects[i]?.title || "Computational research"}
          media={content.media?.find(
            (m) => m.project_id === projects[i]?.id && m.media_type === "image",
          )}
          active={visible && view === "computational"}
        />
      ))}
      <GpuTower motion={motion} active={visible && view === "computational"} />
      {/* keyboard slab + papers = used workstation */}
      <Block
        position={[-0.1, 0.755, 0.28]}
        size={[0.62, 0.025, 0.2]}
        color="#222f36"
        roughness={0.7}
      />
      {/* shift mug: someone works here */}
      <group position={[-0.72, 0.795, 0.15]}>
        <mesh>
          <cylinderGeometry args={[0.045, 0.04, 0.1, 14]} />
          <meshStandardMaterial color="#a9604c" roughness={0.6} />
        </mesh>
        <mesh position={[0.055, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
          <torusGeometry args={[0.028, 0.008, 8, 16, Math.PI * 1.5]} />
          <meshStandardMaterial color="#a9604c" roughness={0.6} />
        </mesh>
      </group>
      <Block
        position={[0.62, 0.755, 0.22]}
        size={[0.3, 0.02, 0.4]}
        color="#e6e2d2"
        roughness={0.95}
      />
      <Block
        position={[0.62, 0.77, 0.22]}
        size={[0.26, 0.015, 0.34]}
        color="#dcd6c2"
        roughness={0.95}
      />
      <Print
        text="AI / COMPUTATIONAL"
        sub="03 / Workstation"
        position={[0, 0.55, 0.41]}
        size={[1.3, 0.2]}
      />
    </group>
  );
}

function DeskStation({
  station,
  theme,
  onView,
}: {
  station: Station;
  theme: "night" | "day" | "blossom";
  onView: (view: LabView) => void;
}) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const palette = labPalette[theme];
  return (
    <group
      position={station.position}
      rotation={station.rotation}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
      onClick={(e) => {
        e.stopPropagation();
        onView(station.id);
      }}
    >
      {hovered && (
        <StationLabel
          position={[0, 1.78, 0.1]}
          index={stationNumber(station.id)}
          title={station.label}
          onSelect={() => onView(station.id)}
        />
      )}
      <Block
        position={[0, 0.87, 0]}
        size={[1.5, 0.06, 0.75]}
        color={palette.benchTop}
        roughness={0.5}
      />
      <Block
        position={[-0.55, 0.43, 0]}
        size={[0.5, 0.86, 0.6]}
        color={palette.cabinet}
        roughness={0.65}
      />
      <Block
        position={[0.55, 0.43, 0]}
        size={[0.08, 0.86, 0.6]}
        color={palette.cabinet}
        metalness={0.3}
        roughness={0.5}
      />
      <Monitor position={[0, 0.9, -0.08]} label={station.label} />
      {/* lived desk: open notebook + pen, keyboard, paper stack */}
      <Block
        position={[-0.4, 0.92, 0.22]}
        size={[0.3, 0.022, 0.4]}
        color="#e6e2d2"
        roughness={0.95}
      />
      <Block
        position={[-0.4, 0.935, 0.22]}
        size={[0.26, 0.012, 0.34]}
        color="#f0ece0"
        roughness={0.95}
      />
      <mesh position={[-0.4, 0.948, 0.22]} rotation={[0, 0.3, Math.PI / 2]}>
        <cylinderGeometry args={[0.008, 0.008, 0.15, 8]} />
        <meshStandardMaterial color="#2c3e70" roughness={0.5} />
      </mesh>
      <Block
        position={[0.02, 0.912, -0.04]}
        size={[0.5, 0.02, 0.16]}
        color="#222f36"
        roughness={0.7}
      />
      <Block
        position={[0.44, 0.915, 0.18]}
        size={[0.24, 0.015, 0.3]}
        color="#d8dfcf"
        roughness={0.95}
      />
      <Print
        text={
          station.id === "desk"
            ? "Background / capabilities"
            : "Research collaboration"
        }
        sub="SELECT TO EXPLORE"
        position={[0, 0.62, 0.385]}
        size={[1.3, 0.2]}
        dark={theme === "night"}
      />
    </group>
  );
}

function Room({
  theme = "night",
  selection,
  onArchive,
  motion,
  visible,
  slideIndex,
  videoElement,
  quality,
  content,
  visited,
  onView,
  view,
}: Pick<
  SceneProps,
  | "quality"
  | "content"
  | "visited"
  | "onPublication"
  | "onView"
  | "view"
  | "theme"
  | "selection"
  | "onArchive"
  | "motion"
  | "visible"
  | "slideIndex"
  | "videoElement"
>) {
  const palette = labPalette[theme];
  return (
    <group>
      {/* floor: vinyl base + zone inlays + aisle runner */}
      <Block
        position={[0, -0.12, 0]}
        size={[11.6, 0.24, 9]}
        color="#1c272c"
        roughness={0.95}
      />
      <Block
        position={[0, 0.002, 0]}
        size={[11, 0.012, 8.4]}
        color={palette.floor}
        roughness={0.88}
        shadow={false}
      />
      {/* imaging zone tint */}
      <Block
        position={[-3.6, 0.009, -0.9]}
        size={[3.3, 0.006, 2.6]}
        color={theme === "night" ? "#2c4148" : "#b9cdc9"}
        roughness={0.9}
        shadow={false}
      />
      {/* engineering zone tint */}
      <Block
        position={[3.35, 0.009, -0.9]}
        size={[3.5, 0.006, 2.6]}
        color={theme === "night" ? "#413832" : "#d3c4ae"}
        roughness={0.9}
        shadow={false}
      />
      {/* central aisle runner */}
      <Block
        position={[0, 0.011, 1.35]}
        size={[9, 0.006, 1]}
        color={theme === "night" ? "#31444b" : "#aebfba"}
        roughness={0.85}
        shadow={false}
      />
      {/* floor joints */}
      {[-2.75, 0, 2.75].map((x) => (
        <Block
          key={"x" + x}
          position={[x, 0.013, 0]}
          size={[0.014, 0.004, 8.4]}
          color="#141d21"
          roughness={0.95}
          shadow={false}
        />
      ))}

      {/* north wall: archive spine */}
      <Block
        position={[0, WALL_H / 2, -4.2]}
        size={[11, WALL_H, 0.15]}
        color={palette.wall}
        roughness={0.94}
      />
      {/* west wall stays; east + south open so the view is never blocked */}
      <Block
        position={[-5.5, WALL_H / 2, 0]}
        size={[0.15, WALL_H, 8.55]}
        color={palette.wall}
        roughness={0.94}
      />
      {/* open edges get a slim floor trim instead of walls */}
      <Block
        position={[5.5, 0.03, 0]}
        size={[0.1, 0.06, 8.4]}
        color="#202e34"
        roughness={0.8}
      />
      <Block
        position={[0, 0.03, 4.2]}
        size={[11, 0.06, 0.1]}
        color="#202e34"
        roughness={0.8}
      />
      {/* skirting */}
      <Block
        position={[0, 0.07, -4.1]}
        size={[10.9, 0.14, 0.04]}
        color="#202e34"
        roughness={0.8}
      />
      <Block
        position={[-5.4, 0.07, 0]}
        size={[0.04, 0.14, 8.3]}
        color="#202e34"
        roughness={0.8}
      />
      {/* acoustic batten rhythm, upper west wall: premium facility cue */}
      {[-5.4].map((x) =>
        [-2.8, -2.42, -2.04, -1.66, -1.28, -0.9].map((z) => (
          <Block
            key={`${x}${z}`}
            position={[x, 2.575, z]}
            size={[0.05, 0.65, 0.13]}
            color={palette.cabinet}
            roughness={0.85}
          />
        )),
      )}
      {/* north windows: controlled light, upper band */}
      {[-2.2, 2.6].map((x) => (
        <group key={x}>
          <Block
            position={[x, 2.3, -4.11]}
            size={[1.15, 0.9, 0.05]}
            color="#1d2c33"
            roughness={0.5}
          />
          <Block
            position={[x, 2.3, -4.08]}
            size={[1.02, 0.78, 0.02]}
            color={theme === "night" ? "#33484e" : "#cfe0e2"}
            roughness={0.15}
            metalness={0.1}
          />
          <Block
            position={[x, 2.3, -4.07]}
            size={[0.03, 0.78, 0.015]}
            color="#1d2c33"
            roughness={0.6}
          />
        </group>
      ))}

      {/* wall signage: mounted upper band, 2x crisp canvas */}
      <Print
        text="BIOMEDICAL IMAGING"
        sub="01 / Microscopy"
        position={[-4.2, 2.55, -4.1]}
        size={[2.2, 0.4]}
        dark={theme === "night"}
        detail
      />
      <Print
        text="MICROGRAVITY BAY"
        sub="02 / Engineering"
        position={[4.35, 2.55, -4.1]}
        size={[2.2, 0.4]}
        dark={theme === "night"}
        detail
      />
      <Print
        text="SILUVERU / RESEARCH LABORATORY"
        sub="Biomedical engineering · Experimental systems"
        position={[-5.4, 1.9, 0.6]}
        size={[2.2, 0.55]}
        rotation={[0, Math.PI / 2, 0]}
        dark={theme === "night"}
        detail
      />
      {/* entry wayfinding sits flat on the floor: nothing floating */}
      <Print
        text="ENTRY"
        sub="Research / archive / discovery"
        position={[0, 0.02, 3.9]}
        rotation={[-Math.PI / 2, 0, 0]}
        size={[2.6, 0.5]}
        dark={theme === "night"}
        detail
      />

      <SuspendedLights theme={theme} />

      {/* ZONE 1 + ZONE 2 benches */}
      <Bench x={-3.7} z={-1} width={2.7} depth={1.35} tone={palette.benchTop} />
      <Bench x={3.35} z={-1} width={3.0} depth={1.5} tone={palette.benchTop} />
      <WorkstationDetails />
      <FacilityDetails theme={theme} quality={quality} />

      <ComputationalWorkstation
        content={content}
        view={view}
        onView={onView}
        visible={visible}
        motion={motion}
      />
      <CapabilityEquipment view={view} onView={onView} />
      {labStations
        .filter((s) => s.archive)
        .map((station) => (
          <ArchiveRack
            key={station.id}
            station={station}
            content={content}
            selection={selection}
            onSelect={onArchive}
            motion={motion}
            theme={theme}
          />
        ))}
      <ResearchProjector
        media={
          content.media?.filter((m) => m.media_type === "image")[slideIndex]
        }
        active={visible && view === "projector"}
        onOpen={() => onView("projector")}
      />
      {content.devices.map((d) => (
        <ResearchMonitor
          key={d.id}
          position={d.id === "mmsa" ? [4.3, BENCH_SURFACE, -1.5] : [-4.5, BENCH_SURFACE, -1.5]}
          label={
            d.id === "mmsa"
              ? "Microgravity experiment"
              : "Microscopy acquisition"
          }
          media={
            content.media?.find(
              (m) => m.project_id === d.project?.id && m.media_type === "video",
            ) ||
            content.media?.find(
              (m) => m.project_id === d.project?.id && m.media_type === "image",
            )
          }
          active={
            visible &&
            (view === d.id ||
              view === (d.id === "mmsa" ? "engineering" : "imaging"))
          }
          videoElement={videoElement}
        />
      ))}
      {labStations
        .filter((s) => s.id === "desk" || s.id === "contact")
        .map((s) => (
          <DeskStation key={s.id} station={s} theme={theme} onView={onView} />
        ))}
      {content.devices.map((d) =>
        d.figure && visited.includes(d.id) ? (
          <Suspense key={d.id} fallback={null}>
            <Drawing
              url={d.figure.file_path}
              position={d.id === "mmsa" ? [4.7, 1.85, -4.1] : [-5.36, 1.7, -1]}
              rotation={d.id === "mmsa" ? undefined : [0, Math.PI / 2, 0]}
            />
          </Suspense>
        ) : null,
      )}
      {/* patent blueprint cabinet under the projector screen */}
      <group position={[0.9, 0, -3.85]}>
        <Block position={[0, 0.55, 0]} size={[1.5, 1.1, 0.5]} color="#9aa79e" roughness={0.6} />
        {[0.3, 0.62, 0.94].map((y) => (
          <group key={y}>
            <Block
              position={[0, y, 0.26]}
              size={[1.34, 0.22, 0.015]}
              color="#c6cec0"
              roughness={0.6}
            />
            <Block
              position={[0, y + 0.03, 0.275]}
              size={[0.3, 0.02, 0.015]}
              color="#4c5e55"
              metalness={0.5}
              roughness={0.5}
            />
          </group>
        ))}
      </group>
      {/* safety cabinet on the entry partition: every wet lab has one */}
      <group position={[-4.6, 0, 4.02]}>
        <Block
          position={[0, 0.55, 0]}
          size={[0.24, 0.52, 0.18]}
          color="#8a3b3b"
          roughness={0.55}
        />
        <Block
          position={[0, 0.83, 0]}
          size={[0.26, 0.05, 0.2]}
          color="#d8dfcf"
          roughness={0.6}
        />
        <Print
          text="SAFETY"
          sub="LAB STATION"
          position={[0, 0.55, 0.095]}
          size={[0.2, 0.12]}
        />
      </group>
      {/* south archive plinths are the racks themselves; entry bench stays clear */}
      <Block
        position={[2.05, 0.14, 3.6]}
        size={[1.2, 0.28, 0.4]}
        color="#5c6f66"
        roughness={0.7}
      />
      <Block
        position={[2.05, 0.3, 3.6]}
        size={[1.3, 0.05, 0.44]}
        color="#c9d1c0"
        roughness={0.55}
      />
      {/* soft grounding for heroes + benches */}
      {quality !== "low" && (
        <ContactShadows
          position={[0, 0.02, -0.5]}
          opacity={theme === "night" ? 0.55 : 0.35}
          scale={12}
          blur={2.2}
          far={3.2}
          resolution={512}
          color="#0c1518"
          frames={1}
        />
      )}
    </group>
  );
}

function SceneContents(props: SceneProps) {
  const { gl, invalidate } = useThree();
  const sample = useRef({ frames: 0, seconds: 0 });
  useFrame((_, delta) => {
    if (process.env.NODE_ENV !== "development" || !props.debug) return;
    gl.domElement.dataset.drawCalls = String(gl.info.render.calls);
    gl.domElement.dataset.triangles = String(gl.info.render.triangles);
    if (delta < 0.15) {
      sample.current.frames++;
      sample.current.seconds += delta;
    } else {
      sample.current.frames = 0;
      sample.current.seconds = 0;
    }
    if (sample.current.frames >= 30) {
      gl.domElement.dataset.activeFps = String(
        Math.round(sample.current.frames / sample.current.seconds),
      );
      sample.current = { frames: 0, seconds: 0 };
    }
  });
  const { onReady, onFailure } = props;
  useEffect(() => {
    onReady();
    const canvas = gl.domElement;
    const fail = (e: Event) => {
      e.preventDefault();
      onFailure();
    };
    canvas.addEventListener("webglcontextlost", fail);
    return () => canvas.removeEventListener("webglcontextlost", fail);
  }, [gl, onReady, onFailure]);
  useEffect(() => {
    invalidate();
  }, [props.visible, invalidate]);
  useEffect(() => {
    if (
      process.env.NODE_ENV === "development" &&
      props.debug &&
      props.fault > 0
    )
      gl.getContext().getExtension("WEBGL_lose_context")?.loseContext();
  }, [gl, props.debug, props.fault]);
  const inspecting = researchDevices.some((d) => d.id === props.view);
  const night = props.theme === "night";
  const blossom = props.theme === "blossom";
  return (
    <>
      {/* Room tones harmonized with the site background system (the lab keeps
          its own opaque stage — postprocessing requires an opaque buffer). */}
      <color
        attach="background"
        args={[night ? "#101b22" : blossom ? "#e4d8dd" : "#dbe6e8"]}
      />
      <fog
        attach="fog"
        args={[night ? "#101b22" : blossom ? "#e4d8dd" : "#dbe6e8", 15, 34]}
      />
      {/* base: soft room bounce, lifted at night so overheads read */}
      <hemisphereLight
        args={[
          night ? "#cfe4e2" : "#f7f3e6",
          night ? "#2c3a35" : "#8a978d",
          inspecting ? 0.9 : night ? 0.95 : 1.15,
        ]}
      />
      {/* key: warm south-high sun/window */}
      <directionalLight
        position={[3.5, 5.5, 4.5]}
        intensity={night ? 1.7 : 2.2}
        color={night ? "#ffeeda" : "#fff6e2"}
        castShadow={props.quality !== "low"}
        shadow-mapSize={props.quality === "high" ? [2048, 2048] : [1024, 1024]}
        shadow-camera-left={-8}
        shadow-camera-right={8}
        shadow-camera-top={7}
        shadow-camera-bottom={-7}
        shadow-bias={-0.0004}
        shadow-normalBias={0.025}
      />
      {/* fill: cool north bounce, no shadow */}
      <directionalLight
        position={[-2, 3.2, -4]}
        intensity={night ? 0.55 : 0.85}
        color={blossom ? "#e8d3e2" : "#d8e8f1"}
      />
      {/* rim: cool edge definition so instrument silhouettes separate from
          the fluid backdrop (night gets the strongest read) */}
      <directionalLight
        position={[-4.5, 4.2, -6]}
        intensity={night ? 0.85 : 0.4}
        color={blossom ? "#f6e7f0" : night ? "#e8f4f6" : "#ffffff"}
      />
      {/* accents: one warm imaging spot, one cool engineering spot */}
      {props.quality !== "low" && (
        <>
          <spotLight
            position={[-3.7, 2.7, 0.3]}
            angle={0.55}
            penumbra={0.9}
            intensity={night ? 20 : 12}
            distance={6.5}
            decay={2}
            color="#ffd9a8"
            target-position={[-3.7, 0.9, -1]}
          />
          <spotLight
            position={[3.35, 2.7, 0.3]}
            angle={0.55}
            penumbra={0.9}
            intensity={night ? 22 : 13}
            distance={7}
            decay={2}
            color="#cfeef2"
            target-position={[3.35, 0.9, -1]}
          />
          <pointLight
            position={[0, 1.75, 1.1]}
            intensity={night ? 2.6 : 1.2}
            distance={3.6}
            decay={2}
            color={blossom ? "#f3d3e6" : "#d9ecf0"}
          />
        </>
      )}
      <AdaptiveResolution quality={props.quality} visible={props.visible} />
      <Room {...props} />
      {props.quality !== "low" && <LabDust theme={props.theme || "night"} />}
      {props.quality === "high" && (
        <Suspense fallback={null}>
          <LabPostProcessing theme={props.theme || "night"} />
        </Suspense>
      )}
      {researchDevices.map((device) => (
        <ResearchDevice
          key={device.id}
          device={device}
          motion={props.motion}
          showLabel={["overview", "imaging", "engineering", device.id].includes(
            props.view,
          )}
          quality={props.quality}
          active={props.view === device.id}
          visited={props.visited.includes(device.id)}
          dimmed={
            researchDevices.some((d) => d.id === props.view) &&
            props.view !== device.id
          }
          debug={props.debug}
          onSelect={props.onView}
          onStatus={props.onStatus}
        />
      ))}
      <CameraRig
        view={props.view}
        motion={props.motion}
        command={props.command}
      />
      {props.debug && <gridHelper args={[10, 10, "#836952", "#9bada1"]} />}
    </>
  );
}
export default function LabScene(props: SceneProps) {
  return (
    <Canvas
      camera={{ position: views.overview.camera, fov: 50, near: 0.05, far: 60 }}
      dpr={
        props.quality === "high"
          ? [1, 1.75]
          : props.quality === "medium"
            ? [1, 1.25]
            : 1
      }
      shadows={props.quality === "low" ? false : { type: PCFShadowMap }}
      frameloop={props.visible ? "demand" : "never"}
      gl={{
        antialias: props.quality !== "low",
        alpha: false,
        powerPreference:
          props.quality === "low" ? "low-power" : "high-performance",
      }}
      fallback={
        <div className="lab-canvas-fallback">
          Interactive 3D laboratory. Accessible controls and research links are
          provided outside the canvas.
        </div>
      }
    >
      <SceneContents {...props} />
    </Canvas>
  );
}
