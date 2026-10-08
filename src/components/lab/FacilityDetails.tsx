"use client";
import { useRef } from "react";
import { Instances, Instance } from "@react-three/drei";
import { useFrame, useThree } from "@react-three/fiber";
import { Group } from "three";
import { Block, Print, Cable } from "./ScenePrimitives";
import { labPalette } from "@/lib/lab-scene-config";
import type { Quality, Vector } from "@/lib/lab-devices";

function Stool({ position, rotation = 0 }: { position: Vector; rotation?: number }) {
  return (
    <group position={position} rotation={[0, rotation, 0]}>
      <Block
        position={[0, 0.62, 0]}
        size={[0.42, 0.07, 0.42]}
        color="#2e4046"
        roughness={0.85}
      />
      <mesh position={[0, 0.32, 0]}>
        <cylinderGeometry args={[0.03, 0.03, 0.56, 10]} />
        <meshStandardMaterial color="#839294" metalness={0.85} roughness={0.3} />
      </mesh>
      {[0, Math.PI / 2.4, (Math.PI * 2) / 1.5].map((r) => (
        <group key={r} rotation={[0, r, 0]}>
          <Block
            position={[0.2, 0.05, 0]}
            size={[0.3, 0.03, 0.04]}
            color="#485b60"
            metalness={0.6}
            roughness={0.45}
          />
        </group>
      ))}
      <Block
        position={[0, 0.35, 0]}
        size={[0.3, 0.03, 0.3]}
        color="#3a4d53"
        metalness={0.5}
        roughness={0.5}
      />
    </group>
  );
}
export function GpuTower({
  motion,
  active,
}: {
  motion: boolean;
  active: boolean;
}) {
  const fans = useRef<Group>(null),
    { invalidate } = useThree();
  useFrame((_, dt) => {
    if (active && motion && fans.current) {
      fans.current.rotation.z += dt * 0.4;
      invalidate();
    }
  });
  return (
    <group position={[1.17, 0.5, 0.05]}>
      <Block
        position={[0, 0, 0]}
        size={[0.4, 0.86, 0.6]}
        color="#1a2c36"
        metalness={0.4}
        roughness={0.45}
      />
      <Block
        position={[0, 0.28, 0.305]}
        size={[0.29, 0.04, 0.012]}
        color="#7fd4d5"
        roughness={0.4}
      />
      <group position={[0, -0.05, 0.306]} ref={fans}>
        {[0, Math.PI / 2, Math.PI, Math.PI * 1.5].map((r) => (
          <mesh key={r} rotation={[0, 0, r]} position={[0, 0, 0]}>
            <boxGeometry args={[0.25, 0.02, 0.014]} />
            <meshStandardMaterial
              color="#629092"
              emissive="#46808c"
              emissiveIntensity={0.12}
            />
          </mesh>
        ))}
      </group>
      <Print
        text="Compute"
        sub="RESEARCH WORKSTATION"
        position={[0, 0.11, 0.314]}
        size={[0.28, 0.14]}
        dark
      />
    </group>
  );
}
export default function FacilityDetails({
  theme,
  quality,
}: {
  theme: "night" | "day" | "blossom";
  quality: Quality;
}) {
  const palette = labPalette[theme];
  return (
    <group>
      {/* stools pulled up to benches, slightly rotated = in use */}
      <Stool position={[-3.6, 0, 0.45]} rotation={0.4} />
      <Stool position={[3.2, 0, 0.5]} rotation={-0.5} />
      <Stool position={[0.1, 0, 2.05]} rotation={2.9} />
      {quality !== "low" && (
        <>
          {/* keyboard on computational desk */}
          <Instances limit={24} range={24} castShadow={quality === "high"}>
            <boxGeometry args={[0.06, 0.016, 0.045]} />
            <meshStandardMaterial color="#2c3a40" roughness={0.75} />
            {Array.from({ length: 24 }, (_, i) => (
              <Instance
                key={i}
                position={[
                  -0.36 + (i % 8) * 0.085,
                  0.762,
                  0.76 + Math.floor(i / 8) * 0.058,
                ]}
              />
            ))}
          </Instances>
          {/* sample vials on imaging bench */}
          <Instances limit={12} range={12} castShadow={quality === "high"}>
            <cylinderGeometry args={[0.03, 0.028, 0.14, 10]} />
            <meshStandardMaterial
              color="#b9d0c9"
              roughness={0.2}
              transparent
              opacity={0.8}
            />
            {Array.from({ length: 12 }, (_, i) => (
              <Instance
                key={i}
                position={[
                  -3.0 + (i % 4) * 0.1,
                  0.975,
                  -0.62 + Math.floor(i / 4) * 0.09,
                ]}
              />
            ))}
          </Instances>
          <Cable
            points={[
              [0.9, 0.75, 0.5],
              [1.15, 0.5, 0.55],
              [1.17, 0.2, 0.58],
            ]}
          />
          <Print
            text="Sample handling"
            sub="IMAGING WORKBENCH"
            position={[-2.85, 1.06, -0.42]}
            size={[0.4, 0.17]}
            dark={theme === "night"}
          />
          {/* corner storage, clear of projector + archives */}
          {[
            { x: -5.0, z: -3.6 },
            { x: 5.0, z: -2.3 },
          ].map(({ x, z }) => (
            <group key={x} position={[x, 0.25, z]}>
              <Block
                position={[0, 0, 0]}
                size={[0.7, 0.5, 0.5]}
                color={palette.cabinet}
                roughness={0.65}
              />
              <Block
                position={[0, 0.28, 0]}
                size={[0.74, 0.05, 0.54]}
                color={palette.trim}
                metalness={0.4}
                roughness={0.5}
              />
              <Print
                text="Equipment"
                sub="LAB STORAGE"
                position={[0, 0.02, 0.26]}
                size={[0.5, 0.2]}
                dark={theme === "night"}
              />
            </group>
          ))}
          {/* waste bins near benches */}
          {[
            [-1.8, 0.55],
            [4.8, 0.5],
          ].map(([x, z], i) => (
            <mesh key={i} position={[x, 0.21, z]}>
              <cylinderGeometry args={[0.16, 0.13, 0.42, 14]} />
              <meshStandardMaterial color="#3a4d53" roughness={0.7} metalness={0.3} />
            </mesh>
          ))}
          {/* paper stacks on south plinth = active paperwork */}
          {[0, 1, 2].map((i) => (
            <Block
              key={i}
              position={[1.75 + i * 0.32, 0.345 + i * 0.012, 3.6]}
              size={[0.28, 0.035 + i * 0.012, 0.36]}
              color={i === 1 ? "#e6e2d2" : "#d8dfcf"}
              roughness={0.95}
            />
          ))}
          <Print
            text="Imaging preparation"
            sub="WORK AREA / KEEP CLEAR"
            position={[-5.4, 0.75, -1]}
            rotation={[0, Math.PI / 2, 0]}
            size={[0.6, 0.2]}
            dark={theme === "night"}
          />
          {/* bench placard: east wall is gone, so the tag lives on the bench */}
          <Print
            text="Instrument power"
            sub="ENGINEERING BAY"
            position={[2.1, 0.915, -0.45]}
            rotation={[-Math.PI / 2, 0, 0]}
            size={[0.45, 0.16]}
            dark={theme === "night"}
          />
        </>
      )}
    </group>
  );
}
