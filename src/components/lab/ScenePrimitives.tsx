"use client";
import { useMemo, useEffect } from "react";
import { useThree } from "@react-three/fiber";
import { Html } from "@react-three/drei";
import {
  CatmullRomCurve3,
  CanvasTexture,
  SRGBColorSpace,
  Vector3,
} from "three";
import type { Vector } from "@/lib/lab-devices";
export function Block({
  position,
  size,
  color = "#b5bfbb",
  roughness = 0.7,
  metalness = 0,
  shadow = true,
}: {
  position: Vector;
  size: Vector;
  color?: string;
  roughness?: number;
  metalness?: number;
  shadow?: boolean;
}) {
  return (
    <mesh position={position} castShadow={shadow} receiveShadow>
      <boxGeometry args={size} />
      <meshStandardMaterial
        color={color}
        roughness={roughness}
        metalness={metalness}
      />
    </mesh>
  );
}
export function Print({
  text,
  sub = "",
  position,
  size = [1.7, 0.5],
  rotation = [0, 0, 0],
  dark = false,
  detail = false,
}: {
  text: string;
  sub?: string;
  position: Vector;
  size?: [number, number];
  rotation?: Vector;
  dark?: boolean;
  detail?: boolean;
}) {
  // Crisp at distance: anisotropic filtering kills grazing-angle blur on
  // wall signage, and large signs render at 2x canvas density.
  const maxAnisotropy = useThree((s) => s.gl.capabilities.getMaxAnisotropy());
  const texture = useMemo(() => {
    const k = detail ? 2 : 1;
    const c = document.createElement("canvas");
    c.width = 1024 * k;
    c.height = 320 * k;
    const ctx = c.getContext("2d")!;
    ctx.fillStyle = dark ? "#203b3c" : "#e8e9df";
    ctx.fillRect(0, 0, c.width, c.height);
    ctx.fillStyle = dark ? "#9fc4c0" : "#5c7268";
    ctx.font = `500 ${28 * k}px monospace`;
    ctx.fillText(sub.toUpperCase(), 45 * k, 75 * k);
    // accent rule = editorial signage, not a plain card
    ctx.fillStyle = dark ? "#8fd8d2" : "#3f6675";
    ctx.fillRect(45 * k, 92 * k, 72 * k, 5 * k);
    ctx.fillStyle = dark ? "#f2f0e6" : "#243c38";
    let fontSize = 56 * k,
      lines: string[] = [];
    do {
      ctx.font = `500 ${fontSize}px sans-serif`;
      lines = [];
      let line = "";
      for (const word of text.split(" ")) {
        if (ctx.measureText(line + word).width > 930 * k && line) {
          lines.push(line.trim());
          line = "";
        }
        line += word + " ";
      }
      if (line) lines.push(line.trim());
      if (lines.length * fontSize * 1.15 <= 190 * k) break;
      fontSize -= 2 * k;
    } while (fontSize > 18 * k);
    lines.forEach((line, i) =>
      ctx.fillText(line, 45 * k, 135 * k + i * fontSize * 1.15),
    );
    const t = new CanvasTexture(c);
    t.colorSpace = SRGBColorSpace;
    t.anisotropy = Math.min(8, maxAnisotropy);
    return t;
  }, [text, sub, dark, detail, maxAnisotropy]);
  useEffect(() => () => texture.dispose(), [texture]);
  return (
    <mesh position={position} rotation={rotation}>
      <planeGeometry args={size} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}
export function Monitor({
  position,
  label,
}: {
  position: Vector;
  label: string;
}) {
  return (
    <group position={position}>
      <Block
        position={[0, 0.34, 0]}
        size={[0.8, 0.48, 0.065]}
        color="#293b3b"
      />
      <Print
        position={[0, 0.34, 0.035]}
        text={label}
        sub="Research archive"
        size={[0.74, 0.42]}
        dark
      />
      <Block
        position={[0, 0.08, 0]}
        size={[0.045, 0.2, 0.04]}
        color="#58665f"
      />
      <Block
        position={[0, -0.015, 0.04]}
        size={[0.36, 0.025, 0.23]}
        color="#4f605a"
      />
      <Block
        position={[0, -0.009, 0.37]}
        size={[0.6, 0.016, 0.18]}
        color="#9faaa4"
      />
    </group>
  );
}
export function Cable({ points }: { points: Vector[] }) {
  const curve = useMemo(() => {
    // Cubic tubing is environmental wiring only, never a fabricated device part.
    return new CatmullRomCurve3(points.map((p) => new Vector3(...p)));
  }, [points]);
  return (
    <mesh>
      <tubeGeometry args={[curve, 16, 0.011, 5, false]} />
      <meshStandardMaterial color="#313e3a" roughness={0.9} />
    </mesh>
  );
}

// Shared hover pill: section name only, never a component list. Smaller and
// more translucent than the hero device labels; parents render it only while
// hovered so the room stays clean at rest.
export function StationLabel({
  position,
  index,
  title,
  onSelect,
}: {
  position: Vector;
  index: string;
  title: string;
  onSelect: () => void;
}) {
  return (
    <Html position={position} center zIndexRange={[20, 0]}>
      <button className="lab-station-label" onClick={onSelect}>
        <span>{index}</span>
        <span className="lab-station-title">{title}</span>
        <b>↗</b>
      </button>
    </Html>
  );
}
