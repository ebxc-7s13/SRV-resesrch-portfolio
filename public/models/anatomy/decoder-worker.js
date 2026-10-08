import { MeshoptDecoder } from "./meshopt-decoder.js";

// The JavaScript decoder runs here so its initial compilation and decoding
// cannot block homepage input, animation, or scrolling. No WASM or blob worker.
self.onmessage = (event) => {
  const { id, count, size, source, mode, filter } = event.data || {};
  try {
    if (!Number.isSafeInteger(id) || !Number.isSafeInteger(count) || count < 0 ||
        !Number.isSafeInteger(size) || size <= 0 ||
        !Number.isSafeInteger(count * size) || count * size > 128 * 1024 * 1024 ||
        !(source instanceof ArrayBuffer) ||
        !["ATTRIBUTES", "TRIANGLES", "INDICES"].includes(mode)) {
      throw new Error("Invalid anatomical decode request.");
    }
    const output = new Uint8Array(count * size);
    MeshoptDecoder.decodeGltfBuffer(output, count, size, new Uint8Array(source), mode, filter);
    self.postMessage({ id, output: output.buffer }, [output.buffer]);
  } catch (error) {
    self.postMessage({ id, error: error instanceof Error ? error.message : "Anatomical decode failed." });
  }
};

self.postMessage({ type: "ready" });
