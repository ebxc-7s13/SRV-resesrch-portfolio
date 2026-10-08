"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useThree } from "@react-three/fiber";
import { VideoTexture, SRGBColorSpace } from "three";
import { useTexture, useCursor } from "@react-three/drei";
import { Block, Print, StationLabel } from "./ScenePrimitives";
import { labStations } from "@/lib/lab-scene-config";
import type { LabMedia, Vector } from "@/lib/lab-devices";

const projectorIndex = String(
  Math.max(0, labStations.findIndex((s) => s.id === "projector")),
).padStart(2, "0");

function VideoScreen({ element }: { element: HTMLVideoElement }) {
  const { invalidate } = useThree();
  const texture = useMemo(() => {
    const value = new VideoTexture(element);
    value.colorSpace = SRGBColorSpace;
    return value;
  }, [element]);
  useEffect(() => {
    let frame = 0;
    const frameCallbacks = typeof element.requestVideoFrameCallback === "function";
    const refresh = () => invalidate();
    const update = () => {
      invalidate();
      frame = frameCallbacks
        ? element.requestVideoFrameCallback(update)
        : !element.paused ? requestAnimationFrame(update) : 0;
    };
    const start = () => { if (!frame) update(); };
    update();
    element.addEventListener("play", start);
    element.addEventListener("loadeddata", refresh);
    element.addEventListener("seeked", refresh);
    return () => {
      if (frameCallbacks) element.cancelVideoFrameCallback(frame);
      else cancelAnimationFrame(frame);
      element.removeEventListener("play", start);
      element.removeEventListener("loadeddata", refresh);
      element.removeEventListener("seeked", refresh);
      texture.dispose();
    };
  }, [element, invalidate, texture]);
  const ratio = element.videoWidth / element.videoHeight || 16 / 9;
  const width = Math.min(0.88, 0.51 * ratio);
  return (
    <mesh position={[0, 0.34, 0.041]}>
      <planeGeometry args={[width, width / ratio]} />
      <meshBasicMaterial map={texture} toneMapped={false} />
    </mesh>
  );
}

// Real research imagery on screen-space planes. Dimmed (not blank) when the
// station is not active; full brightness on approach. No fabricated content:
// the URL always comes from project_media.
function ImageScreen({
  url,
  dimmed,
  maxWidth = 0.88,
  maxHeight = 0.51,
  y = 0.34,
  z = 0.041,
}: {
  url: string;
  dimmed: boolean;
  maxWidth?: number;
  maxHeight?: number;
  y?: number;
  z?: number;
}) {
  const texture = useTexture(url);
  texture.colorSpace = SRGBColorSpace;
  const image = texture.image as { width: number; height: number } | undefined;
  const ratio = image && image.height ? image.width / image.height : 16 / 9;
  let width = maxWidth,
    height = width / ratio;
  if (height > maxHeight) {
    height = maxHeight;
    width = height * ratio;
  }
  return (
    <mesh position={[0, y, z]}>
      <planeGeometry args={[width, height]} />
      <meshBasicMaterial
        map={texture}
        toneMapped={false}
        color={dimmed ? "#8d9a9e" : "#ffffff"}
      />
    </mesh>
  );
}

function MonitorIdle({ label }: { label: string }) {
  return (
    <Print
      text={label}
      sub="RESEARCH MEDIA"
      position={[0, 0.34, 0.036]}
      size={[0.88, 0.51]}
      dark
    />
  );
}

export function ResearchMonitor({
  position,
  media,
  active,
  videoElement,
  label,
}: {
  position: Vector;
  media: LabMedia | undefined;
  active: boolean;
  videoElement?: HTMLVideoElement | null;
  label: string;
}) {
  const imageMedia = media?.media_type === "image" ? media : undefined;
  return (
    <group position={position}>
      <Block
        position={[0, 0.34, 0]}
        size={[0.94, 0.58, 0.065]}
        color="#172a31"
        roughness={0.35}
      />
      {/* screen glass: faint sheen over whatever is shown */}
      <Block
        position={[0, 0.34, 0.033]}
        size={[0.9, 0.53, 0.004]}
        color="#0a1418"
        roughness={0.15}
        shadow={false}
      />
      <Block
        position={[0, 0.02, 0]}
        size={[0.05, 0.32, 0.05]}
        color="#617780"
        metalness={0.7}
      />
      <Block
        position={[0, -0.12, 0.08]}
        size={[0.5, 0.035, 0.3]}
        color="#35484c"
      />
      {/* power LED */}
      <mesh position={[0.38, 0.075, 0.036]}>
        <circleGeometry args={[0.008, 10]} />
        <meshBasicMaterial
          color={active ? "#7fe0c3" : "#274b45"}
          toneMapped={false}
        />
      </mesh>
      {!imageMedia &&
        !(active && media?.media_type === "video" && videoElement) && (
          <MonitorIdle label={label} />
        )}
      {active && media?.media_type === "video" && videoElement && (
        <VideoScreen element={videoElement} />
      )}
      {imageMedia && (
        <Suspense fallback={<MonitorIdle label={label} />}>
          <ImageScreen
            url={imageMedia.file_path}
            dimmed={!active}
          />
        </Suspense>
      )}
    </group>
  );
}

export function ResearchProjector({
  media,
  active,
  onOpen,
}: {
  media: LabMedia | undefined;
  active: boolean;
  onOpen: () => void;
}) {
  const imageMedia = media?.media_type === "image" ? media : undefined;
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  return (
    <group
      position={[0.75, 1.95, -4.08]}
      onPointerOver={(e) => {
        e.stopPropagation();
        setHovered(true);
      }}
      onPointerOut={() => setHovered(false)}
    >
      {hovered && !active && (
        <StationLabel
          position={[0, -1.05, 0.15]}
          index={projectorIndex}
          title="Research projector"
          onSelect={onOpen}
        />
      )}
      <Block
        position={[0, 0, -0.045]}
        size={[2.4, 1.5, 0.09]}
        color="#1a2a32"
        metalness={0.35}
        roughness={0.5}
      />
      {/* idle face doubles as loading matte behind the slide */}
      <Print
        text="Research image collection"
        sub="PROJECTOR / OPEN TO EXPLORE"
        position={[0, 0, 0.008]}
        size={[2.44, 1.42]}
        dark
      />
      {imageMedia && (
        <Suspense fallback={null}>
          <ImageScreen
            key={imageMedia.id}
            url={imageMedia.file_path}
            dimmed={!active}
            maxWidth={2.2}
            maxHeight={1.34}
            y={0}
            z={0.013}
          />
        </Suspense>
      )}
      {/* ceiling unit */}
      <mesh
        position={[0, 1.06, 1.1]}
        onClick={(e) => {
          e.stopPropagation();
          onOpen();
        }}
      >
        <boxGeometry args={[0.55, 0.18, 0.38]} />
        <meshStandardMaterial color="#698087" metalness={0.4} roughness={0.4} />
      </mesh>
      {/* lens practical: faint standby glow, bright when projecting */}
      <mesh position={[0, 1.03, 0.905]}>
        <sphereGeometry args={[0.028, 12, 12]} />
        <meshStandardMaterial
          color="#0e1a20"
          emissive={active ? "#cdeeff" : "#41626d"}
          emissiveIntensity={active ? 2.4 : 0.5}
          roughness={0.3}
        />
      </mesh>
    </group>
  );
}
