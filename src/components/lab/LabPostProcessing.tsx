"use client";
import { Bloom, EffectComposer, Noise, Vignette } from "@react-three/postprocessing";

export default function LabPostProcessing({
  theme,
}: {
  theme: "night" | "day" | "blossom";
}) {
  // HIGH preset only (LabScene mounts this at quality=high).
  // Restrained: lift instrument glow, never wash the room.
  return (
    <EffectComposer multisampling={0}>
      <Bloom
        luminanceThreshold={1.05}
        luminanceSmoothing={0.4}
        intensity={theme === "night" ? 0.28 : theme === "blossom" ? 0.16 : 0.06}
        mipmapBlur
      />
      <Noise opacity={theme === "night" ? 0.05 : 0.025} />
      <Vignette
        eskil={false}
        offset={0.24}
        darkness={theme === "night" ? 0.3 : 0.12}
      />
    </EffectComposer>
  );
}
