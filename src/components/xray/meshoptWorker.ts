import type { MeshoptDecoder } from "three/examples/jsm/libs/meshopt_decoder.module.js";

type Decoder = typeof MeshoptDecoder;
type PendingDecode = {
  resolve: (output: Uint8Array) => void;
  reject: (error: Error) => void;
  timer: ReturnType<typeof setTimeout>;
};

const TIMEOUT_MS = 15_000;

/** One self-origin decoder worker reused by all anatomical packs. */
export function createMeshoptWorker(): { decoder: Decoder; dispose: () => void } {
  const worker = new Worker("/models/anatomy/decoder-worker.js", { type: "module" });
  const pending = new Map<number, PendingDecode>();
  let nextId = 0;
  let stopped: Error | null = null;
  let startupTimer: ReturnType<typeof setTimeout> | undefined;

  function shutdown(error: Error) {
    if (stopped) return;
    stopped = error;
    if (startupTimer !== undefined) clearTimeout(startupTimer);
    worker.onmessage = null;
    worker.onerror = null;
    worker.onmessageerror = null;
    worker.terminate();
    for (const request of pending.values()) {
      clearTimeout(request.timer);
      request.reject(error);
    }
    pending.clear();
  }

  worker.onmessage = (event: MessageEvent<unknown>) => {
    if (stopped || !event.data || typeof event.data !== "object") return;
    const message = event.data as { type?: unknown; id?: unknown; output?: unknown; error?: unknown };
    if (message.type === "ready") {
      if (startupTimer !== undefined) clearTimeout(startupTimer);
      startupTimer = undefined;
      return;
    }
    if (typeof message.id !== "number") return;
    const request = pending.get(message.id);
    if (!request) return;
    if (typeof message.error === "string") {
      shutdown(new Error(`Anatomical decoding failed: ${message.error}`));
      return;
    }
    if (!(message.output instanceof ArrayBuffer)) {
      shutdown(new Error("The anatomical decoder returned an invalid response."));
      return;
    }
    pending.delete(message.id);
    clearTimeout(request.timer);
    request.resolve(new Uint8Array(message.output));
  };
  worker.onerror = (event) => {
    // The caller handles this rejection by restoring the static illustration.
    event.preventDefault();
    shutdown(new Error("The anatomical decoder worker could not start or stopped unexpectedly."));
  };
  worker.onmessageerror = () => shutdown(new Error("The anatomical decoder response could not be read."));
  startupTimer = setTimeout(() => shutdown(new Error("The anatomical decoder worker took too long to start.")), TIMEOUT_MS);

  function decodeGltfBufferAsync(
    count: number,
    size: number,
    source: Uint8Array,
    mode: string,
    filter?: string,
  ): Promise<Uint8Array> {
    if (stopped) return Promise.reject(stopped);
    return new Promise((resolve, reject) => {
      const id = ++nextId;
      const timer = setTimeout(() => shutdown(new Error("Anatomical decoding took too long.")), TIMEOUT_MS);
      pending.set(id, { resolve, reject, timer });
      try {
        // Buffer views share the fetched GLB. Transfer only this private copy.
        const copy = source.slice();
        worker.postMessage({ id, count, size, mode, filter, source: copy.buffer }, [copy.buffer]);
      } catch (error) {
        shutdown(error instanceof Error ? error : new Error("Anatomical decoding could not be requested."));
      }
    });
  }

  function synchronousDecode(): never {
    throw new Error("The anatomical decoder only supports asynchronous worker decoding.");
  }

  const decoder: Decoder = {
    supported: true,
    ready: Promise.resolve(),
    decodeGltfBufferAsync,
    decodeGltfBuffer: synchronousDecode,
    decodeVertexBuffer: synchronousDecode,
    decodeIndexBuffer: synchronousDecode,
    decodeIndexSequence: synchronousDecode,
    // This adapter owns exactly one worker; GLTFLoader never calls useWorkers.
    useWorkers: () => {},
  };

  return {
    decoder,
    dispose: () => shutdown(new Error("Anatomical decoding was cancelled.")),
  };
}
