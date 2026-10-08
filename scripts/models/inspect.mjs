import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import {
  Box3,
  Vector3,
  BufferGeometry,
  Float32BufferAttribute,
  Mesh,
  Group,
  MeshStandardMaterial,
} from "three";
import { TDSLoader } from "three/addons/loaders/TDSLoader.js";

export const sources = [
  {
    id: "mmsa",
    file: "source-assets/research-devices/mmsa/MMSAmodel.obj",
    format: "obj",
  },
  {
    id: "microscope",
    file: "source-assets/research-devices/microscope/Microscope N180608.3ds",
    format: "3ds",
  },
];

export function readModel(source) {
  const bytes = fs.readFileSync(source.file);
  let model,
    report = {
      id: source.id,
      source: source.file,
      sourceBytes: bytes.length,
      sha256: crypto.createHash("sha256").update(bytes).digest("hex"),
      units: "Not specified; physical dimensions cannot be inferred.",
      missingTextures: [],
    };
  if (source.format === "obj") {
    const vertices = [],
      faces = [],
      counts = {},
      objects = [],
      groups = [],
      libraries = [],
      materials = [];
    let invalidFaces = 0;
    for (const line of bytes.toString("utf8").split(/\r?\n/)) {
      const [op, ...args] = line.trim().split(/\s+/);
      if (!op) continue;
      counts[op] = (counts[op] || 0) + 1;
      if (op === "v") vertices.push(...args.slice(0, 3).map(Number));
      if (op === "f") {
        const indices = args.map((v) => {
          const i = Number(v.split("/")[0]);
          return i < 0 ? vertices.length / 3 + i : i - 1;
        });
        for (let i = 1; i < indices.length - 1; i++) {
          if (new Set([indices[0], indices[i], indices[i + 1]]).size < 3)
            invalidFaces++;
          faces.push(indices[0], indices[i], indices[i + 1]);
        }
      }
      if (op === "o") objects.push(args.join(" "));
      if (op === "g") groups.push(args.join(" "));
      if (op === "mtllib") libraries.push(args.join(" "));
      if (op === "usemtl") materials.push(args.join(" "));
    }
    // This exact importer is intentionally guarded. Future UV/material-bearing OBJs
    // must be imported with their MTL/textures, not silently stripped by this path.
    if (
      counts.vt ||
      counts.vn ||
      libraries.length ||
      groups.length ||
      objects.length > 1
    )
      throw new Error(
        "Use a material/UV-aware importer for this source. No attributes may be discarded.",
      );
    if (
      vertices.some((v) => !Number.isFinite(v)) ||
      faces.some((i) => i < 0 || i >= vertices.length / 3)
    )
      throw new Error("Invalid geometry");
    const geometry = new BufferGeometry();
    geometry.setAttribute("position", new Float32BufferAttribute(vertices, 3));
    geometry.setIndex(faces);
    geometry.computeVertexNormals();
    model = new Group();
    const mesh = new Mesh(
      geometry,
      new MeshStandardMaterial({
        name: "Neutral engineering surface (presentation)",
        color: "#a9b3b5",
        metalness: 0.35,
        roughness: 0.46,
      }),
    );
    mesh.name = objects[0] || source.id;
    model.add(mesh);
    const parents = Int32Array.from(
      { length: vertices.length / 3 },
      (_, i) => i,
    );
    const find = (i) => {
      while (parents[i] !== i) {
        parents[i] = parents[parents[i]];
        i = parents[i];
      }
      return i;
    };
    for (let i = 0; i < faces.length; i += 3) {
      parents[find(faces[i + 1])] = find(faces[i]);
      parents[find(faces[i + 2])] = find(faces[i]);
    }
    const components = new Set(Array.from(parents, (_, i) => find(i))).size;
    report = {
      ...report,
      sourceVertices: counts.v,
      sourceFaces: counts.f,
      triangles: faces.length / 3,
      sourceNormals: counts.vn || 0,
      sourceUVs: counts.vt || 0,
      objects,
      groups,
      materialLibraries: libraries,
      sourceMaterials: [...new Set(materials)],
      indexConnectedComponents: components,
      degenerateIndexFaces: invalidFaces,
      materialPolicy:
        "No material/texture references supplied. One neutral material; no invented component classifications.",
      normalPolicy:
        "Normals calculated from the original indexed triangles. Positions and topology unchanged.",
    };
  } else {
    const loader = new TDSLoader();
    // Read embedded 3DS data. Supplied archive has no external bitmap references.
    model = loader.parse(
      bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength),
      path.dirname(source.file) + "/",
    );
    report = {
      ...report,
      format: "3DS, not OBJ",
      sourceNormals: "Derived by 3DS importer",
      materialLibraries: [],
      materialPolicy:
        "Preserve embedded diffuse colors and opacity; translate Phong finish into neutral PBR roughness.",
    };
  }
  model.updateMatrixWorld(true);
  const bounds = new Box3().setFromObject(model),
    size = bounds.getSize(new Vector3()),
    center = bounds.getCenter(new Vector3());
  const meshes = [];
  model.traverse((object) => {
    if (!object.isMesh) return;
    const g = object.geometry;
    meshes.push({
      name: object.name,
      vertices: g.attributes.position.count,
      triangles: (g.index?.count || g.attributes.position.count) / 3,
      hasUV: !!g.attributes.uv,
      hasNormals: !!g.attributes.normal,
      materials: (Array.isArray(object.material)
        ? object.material
        : [object.material]
      ).map((m) => ({
        name: m.name,
        color: "#" + m.color.getHexString(),
        opacity: m.opacity,
        map: m.map?.name || null,
      })),
    });
  });
  report = {
    ...report,
    bounds: {
      min: bounds.min.toArray(),
      max: bounds.max.toArray(),
      dimensions: size.toArray(),
      center: center.toArray(),
    },
    meshes,
  };
  return { model, report };
}

if (process.argv[1]?.endsWith("inspect.mjs")) {
  fs.mkdirSync(".qa/models", { recursive: true });
  for (const source of sources) {
    const { model, report } = readModel(source);
    fs.writeFileSync(
      `.qa/models/${source.id}-inspection.json`,
      JSON.stringify(report, null, 2),
    );
    const vertices = [];
    model.traverse((o) => {
      if (o.isMesh) {
        const a = o.geometry.attributes.position;
        const p = new Vector3();
        for (let i = 0; i < a.count; i++) {
          p.fromBufferAttribute(a, i).applyMatrix4(o.matrixWorld);
          vertices.push(p.x, p.y, p.z);
        }
      }
    });
    fs.writeFileSync(
      `.qa/models/${source.id}-points.bin`,
      Buffer.from(new Float32Array(vertices).buffer),
    );
    console.log(JSON.stringify(report, null, 2));
  }
}
