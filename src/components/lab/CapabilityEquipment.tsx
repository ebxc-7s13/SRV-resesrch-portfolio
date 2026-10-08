"use client";
import { Instances, Instance } from "@react-three/drei";
import { capabilityStations } from "@/lib/lab-capabilities";
import { skillGroups } from "@/lib/research-skills";
import type { LabView } from "@/lib/lab-devices";
import { Block, Print } from "./ScenePrimitives";

export default function CapabilityEquipment({
  view,
  onView,
}: {
  view: LabView;
  onView: (view: LabView) => void;
}) {
  return (
    <group>
      {capabilityStations.map((station) => {
        const skills = skillGroups[station.group] || [];
        const active =
          view === station.view ||
          (view === "microscope" && station.view === "imaging") ||
          (view === "mmsa" && station.view === "engineering");
        return (
          <group
            key={station.group}
            position={station.position}
            onClick={(e) => {
              e.stopPropagation();
              onView(station.view);
            }}
          >
            <Block
              position={[0.14, 0.01, 0]}
              size={[0.55, 0.05, 0.32]}
              color="#385562"
            />
            <Instances limit={skills.length} range={skills.length}>
              <boxGeometry args={[0.065, 0.15, 0.22]} />
              <meshStandardMaterial
                color={active ? "#8ccac6" : "#8b9a9c"}
                roughness={0.7}
              />
              {skills.map((skill, i) => (
                <Instance
                  key={skill.name}
                  position={[-0.03 + i * 0.073, 0.11, 0]}
                />
              ))}
            </Instances>
            {active && (
              <Print
                text={skills.map((s) => s.name).join(" / ")}
                sub={station.label}
                position={[0.14, 0.3, 0]}
                size={[0.75, 0.27]}
                dark
              />
            )}
          </group>
        );
      })}
    </group>
  );
}
