"use client";
import { useEffect, useRef } from "react";
import { useFrame, useThree } from "@react-three/fiber";
import type { Quality } from "@/lib/lab-devices";

// Measure only continuous rendering. Idle demand frames are not slow frames.
export default function AdaptiveResolution({
  quality,
  visible,
}: {
  quality: Quality;
  visible: boolean;
}) {
  const { setDpr, gl } = useThree();
  const sample = useRef({ frames: 0, seconds: 0, cooldown: 0 });
  useEffect(() => {
    sample.current = { frames: 0, seconds: 0, cooldown: 0 };
  }, [quality, visible]);
  useFrame((_, delta) => {
    const current = sample.current;
    if (!visible || delta > 0.2) {
      current.frames = 0;
      current.seconds = 0;
      return;
    }
    current.cooldown = Math.max(0, current.cooldown - delta);
    if (current.cooldown > 0) return;
    current.frames++;
    current.seconds += delta;
    if (current.seconds < 3) return;
    if (current.frames / current.seconds < 28) {
      setDpr(Math.max(0.75, gl.getPixelRatio() - 0.25));
      current.cooldown = 15;
    }
    current.frames = 0;
    current.seconds = 0;
  });
  return null;
}
