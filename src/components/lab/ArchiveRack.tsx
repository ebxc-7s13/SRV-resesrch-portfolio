"use client";
import { useMemo, useRef, useState } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import { Group } from "three";
import { Block, Print } from "./ScenePrimitives";
import { archiveRecords } from "@/lib/lab-archive";
import { labPalette, type Station } from "@/lib/lab-scene-config";
import type { ArchiveSelection, LabContent, Vector } from "@/lib/lab-devices";

function ResearchFolder({
  position,
  selected,
  motion,
  color,
  shelfLabel,
  index,
  total,
  onSelect,
}: {
  position: Vector;
  selected: boolean;
  motion: boolean;
  color: string;
  shelfLabel: string;
  index: number;
  total: number;
  onSelect: () => void;
}) {
  const group = useRef<Group>(null),
    cover = useRef<Group>(null);
  const [hovered, setHovered] = useState(false);
  const { invalidate } = useThree();
  useFrame((_, delta) => {
    if (!group.current || !cover.current) return;
    const z = selected ? 0.42 : hovered ? 0.12 : 0;
    const angle = selected ? -0.55 : 0;
    const t = motion ? 1 - Math.exp(-9 * Math.min(delta, 0.06)) : 1;
    group.current.position.z += (z - group.current.position.z) * t;
    cover.current.rotation.y += (angle - cover.current.rotation.y) * t;
    if (
      Math.abs(group.current.position.z - z) +
        Math.abs(cover.current.rotation.y - angle) >
      0.001
    )
      invalidate();
  });
  const folderNo = String(index + 1).padStart(2, "0");
  return (
    <group position={position}>
      <group
        ref={group}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
          invalidate();
        }}
        onPointerOut={() => {
          setHovered(false);
          invalidate();
        }}
        onClick={(e) => {
          e.stopPropagation();
          onSelect();
          invalidate();
        }}
      >
        <Block
          position={[0, 0, 0]}
          size={[0.66, 0.72, 0.28]}
          color={hovered || selected ? color : "#e0dfcc"}
          roughness={0.92}
        />
        <Block
          position={[0, 0.365, -0.05]}
          size={[0.27, 0.08, 0.22]}
          color={color}
        />
        <group ref={cover} position={[-0.335, 0, 0.151]}>
          <Block
            position={[0.335, 0, 0]}
            size={[0.67, 0.73, 0.018]}
            color={color}
          />
          <Print
            text={shelfLabel}
            sub={`FOLDER ${folderNo} / ${String(total).padStart(2, "0")}`}
            position={[0.335, 0, 0.015]}
            size={[0.62, 0.57]}
          />
        </group>
        {(hovered || selected) && (
          <Html center position={[0, 0.55, 0.25]} zIndexRange={[8, 0]}>
            <button className="lab-object-label" onClick={onSelect}>
              {shelfLabel} · {folderNo}
              <span>Open record ↗</span>
            </button>
          </Html>
        )}
      </group>
    </group>
  );
}

export default function ArchiveRack({
  station,
  content,
  selection,
  motion,
  theme,
  onSelect,
}: {
  station: Station;
  content: LabContent;
  selection: ArchiveSelection | null;
  motion: boolean;
  theme: "night" | "day" | "blossom";
  onSelect: (value: ArchiveSelection) => void;
}) {
  const kind = station.archive!;
  const records = useMemo(() => archiveRecords(content, kind), [content, kind]);
  const rows = Math.max(1, Math.ceil(records.length / 3));
  const shelfHeight = 0.94;
  const palette = labPalette[theme];
  return (
    <group position={station.position} rotation={station.rotation}>
      <Block
        position={[0, (rows * shelfHeight) / 2 + 0.3, -0.25]}
        size={[2.35, rows * shelfHeight + 0.35, 0.12]}
        color={palette.cabinet}
        metalness={0.25}
      />
      {[-1.19, 1.19].map((x) => (
        <Block
          key={x}
          position={[x, (rows * shelfHeight) / 2 + 0.22, 0]}
          size={[0.055, rows * shelfHeight + 0.55, 0.66]}
          color={palette.trim}
          metalness={0.6}
        />
      ))}
      {Array.from({ length: rows + 1 }, (_, i) => (
        <Block
          key={i}
          position={[0, 0.25 + i * shelfHeight, 0]}
          size={[2.45, 0.06, 0.7]}
          color={palette.cabinet}
          metalness={0.35}
        />
      ))}
      <Print
        text={station.label}
        sub={`${String(records.length).padStart(2, "0")} / RESEARCH RECORDS`}
        position={[0, rows * shelfHeight + 0.57, 0.1]}
        size={[2.4, 0.44]}
        dark={theme === "night"}
      />
      {records.map((record, i) => (
        <ResearchFolder
          key={record.id}
          color={station.color}
          shelfLabel={station.label}
          index={i}
          total={records.length}
          position={[
            -0.78 + (i % 3) * 0.78,
            0.66 + Math.floor(i / 3) * shelfHeight,
            0.05,
          ]}
          selected={selection?.kind === kind && selection.id === record.id}
          motion={motion}
          onSelect={() => onSelect({ kind, id: record.id })}
        />
      ))}
    </group>
  );
}
