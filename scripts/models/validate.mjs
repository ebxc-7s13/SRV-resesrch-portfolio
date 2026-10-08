import fs from "node:fs";
import assert from "node:assert/strict";
import { NodeIO } from "@gltf-transform/core";
import { ALL_EXTENSIONS } from "@gltf-transform/extensions";
import { MeshoptDecoder } from "meshoptimizer";

await MeshoptDecoder.ready;
const io = new NodeIO()
  .registerExtensions(ALL_EXTENSIONS)
  .registerDependencies({ "meshopt.decoder": MeshoptDecoder });
const manifest = JSON.parse(
  fs.readFileSync("scripts/models/manifest.json", "utf8"),
);
for (const entry of manifest) {
  for (const [tier, output] of Object.entries(entry.outputs)) {
    const file = `public${output.url}`;
    assert.equal(
      fs.statSync(file).size,
      output.bytes,
      `${file}: manifest size`,
    );
    const document = await io.read(file);
    let triangles = 0,
      vertices = 0;
    const min = [Infinity, Infinity, Infinity],
      max = [-Infinity, -Infinity, -Infinity];
    for (const node of document.getRoot().listNodes()) {
      if (!node.getMesh()) continue;
      const matrix = node.getWorldMatrix();
      for (const primitive of node.getMesh().listPrimitives()) {
        const positions = primitive.getAttribute("POSITION");
        const normals = primitive.getAttribute("NORMAL");
        assert.ok(normals, `${file}: normals required`);
        assert.ok(primitive.getMaterial(), `${file}: material required`);
        triangles += primitive.getIndices().getCount() / 3;
        vertices += positions.getCount();
        for (const value of normals.getArray())
          assert.ok(Number.isFinite(value));
        const values = [];
        for (let i = 0; i < positions.getCount(); i++) {
          positions.getElement(i, values);
          for (let axis = 0; axis < 3; axis++) {
            const value =
              matrix[axis] * values[0] +
              matrix[4 + axis] * values[1] +
              matrix[8 + axis] * values[2] +
              matrix[12 + axis];
            assert.ok(Number.isFinite(value));
            min[axis] = Math.min(min[axis], value);
            max[axis] = Math.max(max[axis], value);
          }
        }
      }
    }
    assert.equal(triangles, output.triangles);
    assert.equal(vertices, output.vertices);
    for (let axis = 0; axis < 3; axis++) {
      assert.ok(
        Math.abs(min[axis] - entry.normalization.bounds.min[axis]) < 0.002,
        `${file}: lower bound ${axis}`,
      );
      assert.ok(
        Math.abs(max[axis] - entry.normalization.bounds.max[axis]) < 0.002,
        `${file}: upper bound ${axis}`,
      );
    }
    for (const texture of document.getRoot().listTextures())
      assert.ok(
        !/^https?:/.test(texture.getURI()),
        "No external texture dependencies",
      );
    console.log(
      `${entry.id} ${tier}: decoded, ${triangles} triangles, stable bounds, finite normals, ${output.bytes} bytes`,
    );
  }
}
function walk(directory) {
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const path = `${directory}/${entry.name}`;
    if (entry.isDirectory()) walk(path);
    else
      assert.ok(
        !/\.(obj|3ds|gsm|zip|mtl)$/i.test(path),
        `Raw source in production: ${path}`,
      );
  }
}
walk("public/3d");
console.log("No raw research model sources in public/3d.");
