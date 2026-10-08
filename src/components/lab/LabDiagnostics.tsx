"use client";
import { useEffect, useState } from "react";

/** Local development evidence only; no telemetry leaves this page. */
export default function LabDiagnostics() {
  const [requests, setRequests] = useState<object[]>([]);
  useEffect(() => {
    const read = () =>
      setRequests(
        performance
          .getEntriesByType("resource")
          .filter(
            (entry) =>
              entry.name.includes("/3d/") &&
              !entry.name.includes("/_next/image"),
          )
          .map((entry) => {
            const resource = entry as PerformanceResourceTiming;
            return {
              path: new URL(resource.name).pathname,
              bytes: resource.encodedBodySize,
              transferred: resource.transferSize,
              milliseconds: Math.round(resource.duration),
            };
          }),
      );
    read();
    const observer = new PerformanceObserver(read);
    observer.observe({ type: "resource", buffered: true });
    return () => observer.disconnect();
  }, []);
  return (
    <details className="lab-network-debug">
      <summary>Model network requests ({requests.length})</summary>
      <pre>{JSON.stringify(requests, null, 2)}</pre>
    </details>
  );
}
