"use client";
import { Suspense, useMemo, useState } from "react";
import { Canvas, useLoader } from "@react-three/fiber";
import { OrbitControls } from "@react-three/drei";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import { Box3, Box3Helper, Color, Mesh, PCFShadowMap } from "three";
import {
  researchDevices,
  type LabContent,
  type Quality,
} from "@/lib/lab-devices";
import LabScene from "./LabScene";
const noop = () => {};
function Model({ url, axes }: { url: string; axes: boolean }) {
  const gltf = useLoader(GLTFLoader, url, (l) =>
    l.setMeshoptDecoder(MeshoptDecoder),
  );
  const copy = useMemo(() => {
    const s = gltf.scene.clone(true);
    s.traverse((o) => {
      if (o instanceof Mesh) {
        o.castShadow = true;
        o.receiveShadow = true;
      }
    });
    return s;
  }, [gltf]);
  const helper = useMemo(
    () => new Box3Helper(new Box3().setFromObject(copy), new Color("#8aa060")),
    [copy],
  );
  return (
    <>
      <primitive object={copy} />
      {axes && (
        <>
          <primitive object={helper} />
          <axesHelper args={[1]} />
        </>
      )}
    </>
  );
}
export default function ModelReview({ content }: { content: LabContent }) {
  const [id, setId] = useState("mmsa"),
    [tier, setTier] = useState("high"),
    [axes, setAxes] = useState(false);
  const device = researchDevices.find((d) => d.id === id) || researchDevices[0];
  const url =
    tier === "low"
      ? device.lowAsset
      : tier === "medium"
        ? device.mediumAsset
        : device.asset;
  return (
    <main style={{ background: "#e0e5d9", color: "#284337", height: "100vh" }}>
      <style>{".model-room .lab-device-label{display:none}"}</style>
      <div
        className="model-room"
        style={{ height: "calc(100vh - 80px)" }}
        data-testid="model-review"
      >
        {id === "room" ? (
          <LabScene
            selection={null}
            onArchive={noop}
            slideIndex={0}
            view="overview"
            quality={tier as Quality}
            motion={false}
            visible
            debug={axes}
            fault={0}
            content={content}
            visited={["microscope", "mmsa"]}
            command={null}
            onView={noop}
            onPublication={noop}
            onStatus={noop}
            onReady={noop}
            onFailure={noop}
          />
        ) : (
          <Canvas
            shadows={{ type: PCFShadowMap }}
            dpr={1.5}
            camera={{ position: [1.35, 0.95, 1.85], fov: 34 }}
            gl={{ preserveDrawingBuffer: true }}
          >
            <color attach="background" args={["#e0e5d9"]} />
            <hemisphereLight args={["#f5f4e9", "#788a6d", 2]} />
            <directionalLight
              position={[-2, 4, 3]}
              intensity={3.5}
              castShadow
              shadow-mapSize={[2048, 2048]}
              shadow-camera-left={-2}
              shadow-camera-right={2}
              shadow-camera-top={2}
              shadow-camera-bottom={-2}
              shadow-normalBias={0.007}
            />
            <directionalLight
              position={[3, 2, -1]}
              intensity={2}
              color="#e0eaf1"
            />
            <mesh rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
              <planeGeometry args={[200, 200]} />
              <meshStandardMaterial color="#e0e5d9" roughness={0.9} />
            </mesh>
            <Suspense fallback={null}>
              <Model url={url} axes={axes} />
            </Suspense>
            <OrbitControls
              target={[0, id === "mmsa" ? 0.37 : 0.48, 0]}
              enablePan={false}
              minDistance={1.1}
              maxDistance={4}
              maxPolarAngle={1.48}
            />
          </Canvas>
        )}
      </div>
      <div style={{ padding: 16, display: "flex", gap: 24, fontSize: 12 }}>
        <label>
          Source model{" "}
          <select
            aria-label="Source model"
            value={id}
            onChange={(e) => setId(e.target.value)}
          >
            <option value="mmsa">Microgravity Simulator</option>
            <option value="microscope">Microscope</option>
            <option value="room">Laboratory overview</option>
          </select>
        </label>
        <label>
          Detail{" "}
          <select
            aria-label="Detail level"
            value={tier}
            onChange={(e) => setTier(e.target.value)}
          >
            <option>high</option>
            <option>medium</option>
            <option>low</option>
          </select>
        </label>
        <label>
          <input
            type="checkbox"
            checked={axes}
            onChange={(e) => setAxes(e.target.checked)}
          />{" "}
          Bounds & axes
        </label>
        <span>Development only · normalized display units · {url}</span>
      </div>
    </main>
  );
}
