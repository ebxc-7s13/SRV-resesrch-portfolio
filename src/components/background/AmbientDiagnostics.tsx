"use client";

import { useEffect } from "react";
import { useThree } from "@react-three/fiber";

interface TimerExtension {
  TIME_ELAPSED_EXT: number;
  GPU_DISJOINT_EXT: number;
}

interface PendingQuery {
  query: WebGLQuery;
  epoch: number;
}

const WARMUP_MS = 3000;
const REPORT_MS = 3000;
const MAX_SAMPLES = 600;

function append(samples: number[], value: number) {
  samples.push(value);
  if (samples.length > MAX_SAMPLES) samples.shift();
}

function distribution(samples: number[]) {
  const sorted = [...samples].sort((a, b) => a - b);
  const percentile = (fraction: number) => {
    if (!sorted.length) return null;
    return Math.round(sorted[Math.ceil(sorted.length * fraction) - 1] * 100) / 100;
  };
  return {
    samples: sorted.length,
    p50: percentile(0.5),
    p95: percentile(0.95),
    p99: percentile(0.99),
  };
}

/** Mount only in an explicitly opted-in profiling build. No extra frame loop or UI. */
export default function AmbientDiagnostics() {
  const renderer = useThree((state) => state.gl);

  useEffect(() => {
    const canvas = renderer.domElement;
    const originalRender = renderer.render;
    const context = renderer.getContext();
    const gl = typeof WebGL2RenderingContext !== "undefined" && context instanceof WebGL2RenderingContext
      ? context : null;
    let extension: TimerExtension | null = null;
    try {
      extension = gl?.getExtension("EXT_disjoint_timer_query_webgl2") as TimerExtension | null;
    } catch {
      // Frame and CPU measurements remain useful when GPU timers are unavailable.
    }
    const frameSamples: number[] = [];
    const cpuSamples: number[] = [];
    const gpuSamples: number[] = [];
    const pending: PendingQuery[] = [];
    let epoch = 0;
    let warmUntil = performance.now() + WARMUP_MS;
    let lastFrame = 0;
    let lastReport = performance.now();
    let frameCount = 0;
    let longTaskCount = 0;
    let longTaskMs = 0;
    let discardedIntervals = 0;
    let observer: PerformanceObserver | undefined;

    const clearQueries = () => {
      for (const { query } of pending) {
        try {
          gl?.deleteQuery(query);
        } catch {
          // A lost context already releases its query resources.
        }
      }
      pending.length = 0;
    };
    const resetTiming = () => {
      epoch++;
      lastFrame = 0;
      warmUntil = performance.now() + WARMUP_MS;
    };
    document.addEventListener("visibilitychange", resetTiming);
    try {
      if (PerformanceObserver.supportedEntryTypes.includes("longtask")) {
        observer = new PerformanceObserver((list) => {
          if (document.hidden) return;
          for (const entry of list.getEntries()) {
            if (entry.startTime < warmUntil) continue;
            longTaskCount++;
            longTaskMs += entry.duration;
          }
        });
        observer.observe({ type: "longtask", buffered: false });
      }
    } catch {
      // Long-task observation is optional and unsupported in some browsers.
    }

    const pollQueries = () => {
      if (!gl || !extension) return;
      if (gl.getParameter(extension.GPU_DISJOINT_EXT)) {
        clearQueries();
        return;
      }
      for (let index = pending.length - 1; index >= 0; index--) {
        const { query, epoch: queryEpoch } = pending[index];
        if (!gl.getQueryParameter(query, gl.QUERY_RESULT_AVAILABLE)) continue;
        if (queryEpoch === epoch && !document.hidden) {
          const elapsed: unknown = gl.getQueryParameter(query, gl.QUERY_RESULT);
          if (typeof elapsed === "number" && Number.isFinite(elapsed) && elapsed >= 0) {
            append(gpuSamples, elapsed / 1_000_000);
          }
        }
        gl.deleteQuery(query);
        pending.splice(index, 1);
      }
    };

    const instrumentedRender: typeof renderer.render = function (scene, camera) {
      const start = performance.now();
      const interval = lastFrame ? start - lastFrame : 0;
      lastFrame = start;
      const visible = !document.hidden;
      const measurable = visible && start >= warmUntil && interval > 0 && interval <= 250;
      if (visible && interval > 250) {
        // Embedded browsers can throttle occluded tabs without changing visibilityState.
        discardedIntervals++;
        epoch++;
      }
      if (measurable) append(frameSamples, interval);
      frameCount++;
      let activeQuery: WebGLQuery | null = null;
      if (gl && extension && frameCount % 10 === 0) {
        try {
          pollQueries();
          if (measurable && pending.length < 4 && !gl.isContextLost() &&
              !gl.getQuery(extension.TIME_ELAPSED_EXT, gl.CURRENT_QUERY)) {
            activeQuery = gl.createQuery();
            if (activeQuery) gl.beginQuery(extension.TIME_ELAPSED_EXT, activeQuery);
          }
        } catch {
          if (activeQuery) {
            gl.deleteQuery(activeQuery);
            activeQuery = null;
          }
          extension = null;
          clearQueries();
        }
      }

      const cpuStart = performance.now();
      try {
        originalRender.call(renderer, scene, camera);
      } finally {
        const end = performance.now();
        if (measurable) append(cpuSamples, end - cpuStart);
        if (activeQuery && gl && extension) {
          try {
            gl.endQuery(extension.TIME_ELAPSED_EXT);
            pending.push({ query: activeQuery, epoch });
          } catch {
            gl.deleteQuery(activeQuery);
            extension = null;
          }
        }
        if (visible && end >= warmUntil && end - lastReport >= REPORT_MS) {
          canvas.dataset.ambientProfile = JSON.stringify({
            frameMs: distribution(frameSamples),
            cpuMs: distribution(cpuSamples),
            gpuMs: distribution(gpuSamples),
            gpuAvailable: Boolean(extension),
            discardedIntervals,
            longTasks: { count: longTaskCount, totalMs: Math.round(longTaskMs) },
            calls: renderer.info.render.calls,
            triangles: renderer.info.render.triangles,
            width: canvas.width,
            height: canvas.height,
            reportedAt: Math.round(end),
          });
          lastReport = end;
          longTaskCount = 0;
          longTaskMs = 0;
        }
      }
    };
    renderer.render = instrumentedRender;
    return () => {
      if (renderer.render === instrumentedRender) renderer.render = originalRender;
      document.removeEventListener("visibilitychange", resetTiming);
      observer?.disconnect();
      clearQueries();
      delete canvas.dataset.ambientProfile;
    };
  }, [renderer]);

  return null;
}
