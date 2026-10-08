import fs from "node:fs";
import { Box3, Vector3, MeshStandardMaterial, Group } from "three";
import { GLTFExporter } from "three/addons/exporters/GLTFExporter.js";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import {
  dedup,
  prune,
  weld,
  meshopt,
  simplify,
} from "@gltf-transform/functions";
import {
  MeshoptEncoder,
  MeshoptDecoder,
  MeshoptSimplifier,
} from "meshoptimizer";
import { readModel, sources } from "./inspect.mjs";

globalThis.FileReader = class {
  readAsArrayBuffer(blob) {
    blob.arrayBuffer().then((result) => {
      this.result = result;
      this.onloadend?.();
    });
  }
};
await Promise.all([
  MeshoptEncoder.ready,
  MeshoptDecoder.ready,
  MeshoptSimplifier.ready,
]);
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({
    "meshopt.encoder": MeshoptEncoder,
    "meshopt.decoder": MeshoptDecoder,
  });
const entries = [];
for (const source of sources) {
  const { model, report } = readModel(source);
  const root = new Group();
  root.name = source.id + "_normalized";
  root.add(model);
  // Orientation established from orthographic source projections: MMSA has Y-up
  // support feet; the microscope has a Z-up base and eyepieces. No mesh edits.
  model.rotation.x = source.id === "microscope" ? -Math.PI / 2 : 0;
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  const factor = 1 / Math.max(size.x, size.y, size.z);
  model.scale.multiplyScalar(factor);
  model.position.set(
    -center.x * factor,
    -bounds.min.y * factor,
    -center.z * factor,
  );
  const pbr = new Map();
  model.traverse((o) => {
    if (!o.isMesh) return;
    const convert = (m) => {
      if (m.isMeshStandardMaterial) return m;
      if (!pbr.has(m))
        pbr.set(
          m,
          new MeshStandardMaterial({
            name: m.name,
            color: m.color,
            opacity: m.opacity,
            transparent: m.transparent,
            roughness: 0.5,
            metalness: 0.12,
            side: m.side,
          }),
        );
      return pbr.get(m);
    };
    o.material = Array.isArray(o.material)
      ? o.material.map(convert)
      : convert(o.material);
  });
  root.updateMatrixWorld(true);
  const normalized = new Box3().setFromObject(root);
  const binary = await new GLTFExporter().parseAsync(root, {
    binary: true,
    onlyVisible: true,
  });
  const directory = `public/3d/${source.id === "mmsa" ? "microgravity" : "microscopes"}`;
  fs.mkdirSync(directory, { recursive: true });
  const outputs = {};
  for (const tier of source.id === "mmsa"
    ? ["high", "medium", "low"]
    : ["high"]) {
    const document = await io.readBinary(new Uint8Array(binary));
    await document.transform(dedup(), weld());
    if (tier !== "high")
      await document.transform(
        simplify({
          simplifier: MeshoptSimplifier,
          ratio: tier === "medium" ? 0.35 : 0.1,
          error: tier === "medium" ? 0.0003 : 0.001,
          lockBorder: true,
        }),
      );
    await document.transform(
      prune(),
      meshopt({
        encoder: MeshoptEncoder,
        level: "high",
        quantizePosition: 16,
        quantizeNormal: 12,
        quantizeTexcoord: 14,
      }),
    );
    const out = `${directory}/${source.id}${tier === "high" ? "" : "-" + tier}.glb`;
    await io.write(out, document);
    const decoded = await io.read(out);
    const primitives = decoded
      .getRoot()
      .listMeshes()
      .flatMap((m) => m.listPrimitives());
    outputs[tier] = {
      url: out.replace("public", ""),
      bytes: fs.statSync(out).size,
      triangles: primitives.reduce(
        (sum, p) => sum + p.getIndices().getCount() / 3,
        0,
      ),
      vertices: primitives.reduce(
        (sum, p) => sum + p.getAttribute("POSITION").getCount(),
        0,
      ),
    };
    console.log(source.id, tier, outputs[tier]);
  }
  entries.push({
    ...report,
    orientation: {
      rotationX: model.rotation.x,
      evidence:
        source.id === "mmsa"
          ? "Support feet at minimum Y in front X/Y projection."
          : "Base at minimum Z; rotate -90 degrees about X into Y-up.",
    },
    normalization: {
      uniformScale: factor,
      translation: model.position.toArray(),
      bounds: {
        min: normalized.min.toArray(),
        max: normalized.max.toArray(),
        dimensions: normalized.getSize(new Vector3()).toArray(),
      },
      interpretation:
        "Longest dimension is one display unit. Not a claim about manufactured size.",
    },
    outputs,
  });
}
fs.writeFileSync(
  "scripts/models/manifest.json",
  JSON.stringify(entries, null, 2) + "\n",
);
