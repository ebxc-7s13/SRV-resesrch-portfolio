"use client";
import { labStations, guidedRoute } from "@/lib/lab-scene-config";
import type { LabView } from "@/lib/lab-devices";

export default function LabNavigation({
  view,
  tour,
  autoTour = false,
  onTour,
  onView,
}: {
  view: LabView;
  tour: boolean;
  autoTour?: boolean;
  onTour: (tour: boolean) => void;
  onView: (view: LabView) => void;
}) {
  const index = Math.max(0, guidedRoute.indexOf(view));
  const station =
    labStations.find((s) => s.id === view) ||
    labStations.find(
      (s) => s.id === (view === "mmsa" ? "engineering" : "imaging"),
    )!;
  return (
    <div className="lab-navigation-system">
      <div className="lab-guided-controls">
        <button
          className="lab-button primary"
          aria-pressed={tour}
          onClick={() => {
            onTour(!tour);
            if (!tour) onView("overview");
          }}
        >
          {tour ? "End guided tour" : "Start guided tour"}
        </button>
        <button
          className="lab-button"
          disabled={index === 0}
          onClick={() => onView(guidedRoute[index - 1])}
        >
          ← Previous station
        </button>
        <button
          className="lab-button"
          disabled={index === guidedRoute.length - 1}
          onClick={() => onView(guidedRoute[index + 1])}
        >
          Next station →
        </button>
        <span className="lab-eyebrow">
          {String(index + 1).padStart(2, "0")} / {guidedRoute.length}
        </span>
      </div>
      {tour && (
        <div className="lab-tour-caption" aria-live="polite">
          <strong>{station.label}</strong>
          <p>{station.description}</p>
          <small>
            {autoTour
              ? "Auto-advancing every 9 seconds. Use Previous / Next to take over, or End tour to explore freely."
              : "Move at your own pace. Drag to look around a station. Choose a device to orbit and inspect it."}
          </small>
        </div>
      )}
      <details className="lab-floor-plan">
        <summary>
          Laboratory floor plan <span>Choose a destination ↗</span>
        </summary>
        <div className="lab-plan-scroll">
          <div
            className="lab-spatial-plan"
            role="group"
            aria-label="Spatial floor plan"
          >
            <svg
              viewBox="0 0 700 400"
              preserveAspectRatio="none"
              aria-hidden="true"
            >
              <path d="M20 380 V20 H680 V380 M20 380 H285 M415 380 H680" />
              <path className="plan-aisle" d="M350 380 V155 M80 210 H620" />
              <rect x="105" y="90" width="180" height="65" />
              <rect x="420" y="90" width="175" height="65" />
              <rect x="305" y="160" width="105" height="50" />
            </svg>
            {labStations.map((s, i) => (
              <button
                key={s.id}
                className="lab-plan-marker"
                aria-label={`Move to ${s.label}`}
                aria-pressed={station.id === s.id}
                onClick={() => onView(s.id)}
                style={{
                  left: `${((s.position[0] + 5.5) / 11) * 100}%`,
                  top: `${s.id === "overview" ? 94 : ((s.position[2] + 4.2) / 8.4) * 100}%`,
                }}
              >
                <span>{String(i).padStart(2, "0")}</span>
                <strong>{s.label}</strong>
              </button>
            ))}
          </div>
        </div>
        <nav aria-label="Laboratory floor plan">
          {labStations.map((s, i) => (
            <button
              key={s.id}
              onClick={() => onView(s.id)}
              aria-pressed={view === s.id}
              style={{ gridColumn: s.id === "overview" ? "1 / -1" : undefined }}
            >
              <span>{String(i).padStart(2, "0")}</span>
              <strong>{s.label}</strong>
            </button>
          ))}
        </nav>
      </details>
    </div>
  );
}
