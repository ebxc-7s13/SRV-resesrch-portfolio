"use client";
import {
  Suspense,
  useEffect,
  useMemo,
  useState,
  useRef,
  Component,
  type ReactNode,
} from "react";
import { useLoader, useFrame, useThree, type ThreeEvent } from "@react-three/fiber";
import { Html, useCursor } from "@react-three/drei";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { MeshoptDecoder } from "three/addons/libs/meshopt_decoder.module.js";
import {
  Box3,
  Box3Helper,
  Color,
  Mesh,
  MeshStandardMaterial,
  Object3D,
  Group,
} from "three";
import {
  researchDevices,
  type DeviceId,
  type Quality,
} from "@/lib/lab-devices";

type Config = (typeof researchDevices)[number];
type Props = {
  device: Config;
  quality: Quality;
  active: boolean;
  visited: boolean;
  dimmed: boolean;
  debug: boolean;
  showLabel?: boolean;
  motion?: boolean;
  onSelect: (id: DeviceId) => void;
  onStatus: (id: DeviceId, status: string) => void;
};

class AssetBoundary extends Component<
  { children: ReactNode; onError: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onError();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

function LoadedModel({
  url,
  dimmed,
  hovered,
  shadows,
  onReady,
  debug,
}: {
  url: string;
  dimmed: boolean;
  hovered: boolean;
  shadows: boolean;
  onReady: () => void;
  debug: boolean;
}) {
  const gltf = useLoader(GLTFLoader, url, (loader) =>
    loader.setMeshoptDecoder(MeshoptDecoder),
  );
  const scene = useMemo(() => {
    const copy = gltf.scene.clone(true);
    copy.traverse((o) => {
      if (o instanceof Mesh) {
        o.material = Array.isArray(o.material)
          ? o.material.map((m) => m.clone())
          : o.material.clone();
      }
    });
    return copy;
  }, [gltf.scene]);
  useEffect(() => {
    onReady();
  }, [onReady]);
  useEffect(() => {
    scene.traverse((o) => {
      if (!(o instanceof Mesh)) return;
      o.castShadow = shadows;
      o.receiveShadow = shadows;
      for (const mat of Array.isArray(o.material) ? o.material : [o.material]) {
        if (mat instanceof MeshStandardMaterial) {
          if (!mat.userData.originalColor)
            mat.userData.originalColor = mat.color.clone();
          mat.color
            .copy(mat.userData.originalColor)
            .multiplyScalar(dimmed ? 0.46 : 1);
          mat.emissive.set(hovered ? "#aab9b5" : "#000000");
          mat.emissiveIntensity = hovered ? 0.06 : 0;
        }
      }
    });
  }, [scene, dimmed, hovered, shadows]);
  useEffect(
    () => () => {
      scene.traverse((o) => {
        if (o instanceof Mesh)
          for (const m of Array.isArray(o.material) ? o.material : [o.material])
            m.dispose();
      });
    },
    [scene],
  );
  const helper = useMemo(
    () => new Box3Helper(new Box3().setFromObject(scene), new Color("#9baf9e")),
    [scene],
  );
  useEffect(
    () => () => {
      helper.geometry.dispose();
      (helper.material as MeshStandardMaterial).dispose();
    },
    [helper],
  );
  return (
    <>
      <primitive object={scene} dispose={null} />
      {(debug || hovered) && <primitive object={helper} />}{" "}
      {debug && <axesHelper args={[0.65]} />}
    </>
  );
}

function LoadingStatus({
  id,
  onStatus,
}: {
  id: DeviceId;
  onStatus: Props["onStatus"];
}) {
  useEffect(() => {
    onStatus(id, "loading");
  }, [id, onStatus]);
  return null;
}

export default function ResearchDevice({
  device,
  showLabel = true,
  motion = false,
  quality,
  active,
  visited,
  dimmed,
  debug,
  onSelect,
  onStatus,
}: Props) {
  const [hovered, setHovered] = useState(false);
  useCursor(hovered);
  const url =
    quality === "low"
      ? device.lowAsset
      : active && quality === "high"
        ? device.asset
        : device.mediumAsset;
  const onReady = useMemo(
    () => () => onStatus(device.id, "ready"),
    [device.id, onStatus],
  );
  const lightTarget = useMemo(() => {
    const target = new Object3D();
    target.position.set(...device.target);
    return target;
  }, [device]);
  const handleClick = (e: ThreeEvent<MouseEvent>) => {
    e.stopPropagation();
    if (e.delta < 8) onSelect(device.id);
  };
  const modelGroup=useRef<Group>(null);
  const {pointer,invalidate}=useThree();
  useFrame((_,delta)=>{
    if(!modelGroup.current)return;
    const goal=device.rotation[1]+(motion&&hovered?pointer.x*.025:0);
    const diff=goal-modelGroup.current.rotation.y;
    modelGroup.current.rotation.y+=diff*(motion?1-Math.exp(-9*delta):1);
    if(Math.abs(diff)>.0001)invalidate();
  });
  const top = device.id === "mmsa" ? 2.35 : 1.85;
  return (
    <>
      <group
        ref={modelGroup}
        position={[...device.position]}
        rotation={[...device.rotation]}
        scale={device.scale}
        onPointerOver={(e) => {
          e.stopPropagation();
          setHovered(true);
        }}
        onPointerOut={() => setHovered(false)}
        onClick={handleClick}
      >
        {visited && (
          <AssetBoundary key={url} onError={() => onStatus(device.id, "error")}>
            <Suspense
              fallback={<LoadingStatus id={device.id} onStatus={onStatus} />}
            >
              <LoadedModel
                url={url}
                dimmed={dimmed}
                hovered={hovered}
                shadows={quality !== "low"}
                onReady={onReady}
                debug={debug}
              />
            </Suspense>
          </AssetBoundary>
        )}
      </group>
      {!active && showLabel && (
        <Html
          position={[device.position[0], top, device.position[2]]}
          center
          zIndexRange={[20, 0]}
        >
          <button
            className={`lab-device-label ${hovered ? "is-hovered" : ""}`}
            onClick={() => onSelect(device.id)}
          >
            <span>{device.id === "mmsa" ? "02" : "01"}</span>
            <span className="lab-device-title">{device.title}</span>
            <b>↗</b>
          </button>
        </Html>
      )}
      {/* bench ring: hover/selection reads on the surface, not a floating card */}
      {(hovered || active) && (
        <mesh
          position={[device.position[0], 0.913, device.position[2]]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry
            args={[device.id === "mmsa" ? 0.98 : 0.44, device.id === "mmsa" ? 1.05 : 0.49, 48]}
          />
          <meshBasicMaterial
            color={active ? "#8fd8d2" : "#5f7a76"}
            transparent
            opacity={active ? 0.85 : 0.5}
            toneMapped={false}
          />
        </mesh>
      )}
      {active && (
        <>
          <primitive object={lightTarget} />
          <spotLight
            position={[device.position[0] + 1.2, 2.8, device.position[2] + 1.1]}
            target={lightTarget}
            intensity={7}
            angle={0.55}
            penumbra={0.9}
            color="#fff2df"
          />
        </>
      )}
      {debug && (
        <>
          <axesHelper position={[...device.position]} args={[1]} />
          <mesh position={[...device.target]}>
            <sphereGeometry args={[0.035, 8, 8]} />
            <meshBasicMaterial color="#c26745" />
          </mesh>
        </>
      )}
    </>
  );
}
