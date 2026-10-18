"use client";
import { useEffect } from "react";
import { useThree } from "@react-three/fiber";
import {
  Color,
  Line,
  Material,
  Mesh,
  MeshBasicMaterial,
  Object3D,
  Points,
  type WebGLProgramParametersWithUniforms,
} from "three";

/**
 * Stone Mode for the laboratory: every mesh, line and point cloud in the
 * scene is shown in the same pale limestone WITHOUT touching geometry,
 * transforms, hierarchy, cameras or interactions.
 *
 * Each original material is cloned once (per mesh instance) and the clone's
 * shader maps the final diffuse colour — after textures, vertex colours and
 * instance colours — onto the stone luminance ramp, strips hue from emissive
 * light, removes metalness and adds a fine object-space grain. Originals are
 * kept untouched and restored when Stone Mode unmounts; clones are disposed.
 * Screens (unlit textured materials) keep their full-range image, desaturated.
 */

const STONE_TINT = new Color("#d3cec5");

type Registry = {
  swapped: Map<Object3D, Material | Material[]>;
  clones: Map<Material, Material>;
  stone: Set<Material>;
};

function stoneClone(original: Material, registry: Registry): Material {
  const cached = registry.clones.get(original);
  if (cached) return cached;
  // Custom shaders carry live uniforms (render targets, time): leave them.
  if (original.type === "ShaderMaterial" || original.type === "RawShaderMaterial") return original;
  const material = original.clone();
  const isScreen = material instanceof MeshBasicMaterial && !!material.map;
  const m = material as Material & { metalness?: number; roughness?: number; emissiveIntensity?: number; envMapIntensity?: number };
  if (typeof m.metalness === "number") m.metalness = 0;
  if (typeof m.roughness === "number") m.roughness = Math.max(0.82, m.roughness);
  if (typeof m.envMapIntensity === "number") m.envMapIntensity = 0.4;
  const previous = material.onBeforeCompile.bind(material);
  material.onBeforeCompile = (shader: WebGLProgramParametersWithUniforms, renderer) => {
    previous(shader, renderer);
    shader.uniforms.stoneTint = { value: STONE_TINT };
    shader.vertexShader = shader.vertexShader
      .replace("#include <common>", "#include <common>\nvarying vec3 vStonePos;")
      .replace("#include <begin_vertex>", "#include <begin_vertex>\nvStonePos = position;");
    const ramp = isScreen
      // Screens: keep the research image's full tonal range.
      ? "diffuseColor.rgb = vec3(stoneLum) * mix(vec3(1.0), stoneTint, 0.18);"
      // Solids: compress every colour into the limestone range so all parts
      // read as one material, with small tonal steps for legibility.
      : "float stoneTone = 0.44 + 0.36 * pow(clamp(stoneLum, 0.0, 1.0), 0.55);\n" +
        "diffuseColor.rgb = stoneTint * stoneTone * (0.955 + 0.09 * stoneGrain);";
    shader.fragmentShader = shader.fragmentShader
      .replace("#include <common>", "#include <common>\nuniform vec3 stoneTint;\nvarying vec3 vStonePos;\nfloat stoneHash(vec3 p) { return fract(sin(dot(floor(p), vec3(12.9898, 78.233, 37.719))) * 43758.5453); }")
      .replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nfloat stoneLum = dot(diffuseColor.rgb, vec3(0.2126, 0.7152, 0.0722));\nfloat stoneGrain = stoneHash(vStonePos * 420.0) * 0.6 + stoneHash(vStonePos * 90.0) * 0.4;\n" + ramp,
      );
    if (shader.fragmentShader.includes("#include <emissivemap_fragment>"))
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <emissivemap_fragment>",
        "#include <emissivemap_fragment>\ntotalEmissiveRadiance = vec3(dot(totalEmissiveRadiance, vec3(0.2126, 0.7152, 0.0722))) * 0.45;",
      );
  };
  const key = material.customProgramCacheKey.bind(material);
  material.customProgramCacheKey = () => `stone-${isScreen ? "screen" : "solid"}-${key()}`;
  material.needsUpdate = true;
  registry.clones.set(original, material);
  registry.stone.add(material);
  return material;
}

function apply(root: Object3D, registry: Registry) {
  let changed = false;
  root.traverse((node) => {
    if (!(node instanceof Mesh || node instanceof Line || node instanceof Points)) return;
    const current = node.material as Material | Material[];
    const list = Array.isArray(current) ? current : [current];
    // Already stone (our clone), or a new original swapped in by React.
    if (list.every((m) => registry.stone.has(m) || m.type === "ShaderMaterial" || m.type === "RawShaderMaterial")) return;
    registry.swapped.set(node, current);
    node.material = Array.isArray(current) ? current.map((m) => stoneClone(m, registry)) : stoneClone(current, registry);
    changed = true;
  });
  return changed;
}

export default function StoneMaterials() {
  const scene = useThree((s) => s.scene);
  const invalidate = useThree((s) => s.invalidate);
  useEffect(() => {
    const registry: Registry = { swapped: new Map(), clones: new Map(), stone: new Set() };
    if (apply(scene, registry)) invalidate();
    // Models, media and labels mount asynchronously: keep checking.
    const id = window.setInterval(() => { if (apply(scene, registry)) invalidate(); }, 400);
    return () => {
      window.clearInterval(id);
      // Restore every original so the normal laboratory is untouched.
      registry.swapped.forEach((original, node) => {
        const mesh = node as Mesh;
        const current = mesh.material as Material | Material[];
        const ours = (Array.isArray(current) ? current : [current]).every((m) => registry.stone.has(m) || m.type.endsWith("ShaderMaterial"));
        if (ours) mesh.material = original;
      });
      registry.stone.forEach((clone) => clone.dispose());
      invalidate();
    };
  }, [scene, invalidate]);
  return null;
}
