"use client";
import dynamic from "next/dynamic";
import Image from "next/image";
import {
  Component,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import {
  projectSections,
  researchDevices,
  type ArchiveSelection,
  type DeviceId,
  type LabContent,
  type LabView,
  type Quality,
} from "@/lib/lab-devices";
import { safeExternalHref } from "@/lib/safe-url";
import type { CameraCommand } from "./LabScene";
import LabDiagnostics from "./LabDiagnostics";
import LabArchivePanel from "./LabArchivePanel";
import LabNavigation from "./LabNavigation";
import LabVideoPlayer from "./LabVideoPlayer";
import ProjectorPanel from "./ProjectorPanel";
import { labStations, guidedRoute } from "@/lib/lab-scene-config";
import { archiveRecords } from "@/lib/lab-archive";
import { capabilityStations } from "@/lib/lab-capabilities";
import { projectsMentioningSkills } from "@/lib/lab-skill-projects";
import { skillGroups } from "@/lib/research-skills";

const LabScene = dynamic(() => import("./LabScene"), {
  ssr: false,
  loading: () => (
    <div className="lab-loading" role="status">
      <span className="lab-spinner" />
      Preparing the laboratory…
    </div>
  ),
});
const viewLabels: Record<LabView, string> = {
  projects: "Project rack",
  patents: "Patent cabinet",
  theses: "Thesis archive",
  notes: "Research notes",
  desk: "Researcher desk",
  contact: "Contact terminal",
  projector: "Research projector",
  overview: "Laboratory overview",
  imaging: "Biomedical imaging",
  engineering: "Microgravity research bay",
  publications: "Publication wall",
  computational: "AI / computational workstation",
  microscope: "Microscope inspection",
  mmsa: "Microgravity simulator inspection",
};
class SceneBoundary extends Component<
  { children: ReactNode; onFailure: () => void },
  { failed: boolean }
> {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  componentDidCatch() {
    this.props.onFailure();
  }
  render() {
    return this.state.failed ? null : this.props.children;
  }
}

export default function LabExperience({ content }: { content: LabContent }) {
  const [theme] = useState<"night">("night");
  const deepLinkHandled = useRef(false);
  const [selection, setSelection] = useState<ArchiveSelection | null>(null);
  const [tour, setTour] = useState(false);
  const [slideIndex, setSlideIndex] = useState(0),
    [slideshow, setSlideshow] = useState(false);
  const images = (content.media || []).filter((m) => m.media_type === "image");
  const [entered, setEntered] = useState(false),
    [failed, setFailed] = useState(false),
    [ready, setReady] = useState(false);
  const [view, setView] = useState<LabView>("overview"),
    [quality, setQuality] = useState<Quality>("medium");
  const [visited, setVisited] = useState<DeviceId[]>([]),
    [statuses, setStatuses] = useState<Record<string, string>>({});
  const [reduced, setReduced] = useState(true),
    [paused, setPaused] = useState(false),
    [visible, setVisible] = useState(true);
  const [publicationId, setPublicationId] = useState<number | null>(null),
    [command, setCommand] = useState<CameraCommand | null>(null);
  const [debug, setDebug] = useState(false),
    [fault, setFault] = useState(0),
    [capture, setCapture] = useState(false),
    [previewMotion, setPreviewMotion] = useState(false);
  const stage = useRef<HTMLDivElement>(null),
    panelHeading = useRef<HTMLHeadingElement>(null),
    returnButton = useRef<HTMLButtonElement>(null);
  const [videoElement, setVideoElement] = useState<HTMLVideoElement | null>(
    null,
  );
  const mediaDevice = content.devices.find(
    (d) =>
      d.id === view || (d.id === "mmsa" ? "engineering" : "imaging") === view,
  );
  const activeVideo = content.media?.find(
    (m) =>
      m.project_id === mediaDevice?.project?.id && m.media_type === "video",
  );
  const activeDevice = researchDevices.find((d) => d.id === view);
  const record = content.devices.find((d) => d.id === view);
  const publication = content.publications.find((p) => p.id === publicationId);
  const archive = labStations.find((s) => s.id === view)?.archive;
  const panelOpen =
    !!activeVideo ||
    !!activeDevice ||
    !!publication ||
    !!archive ||
    ["computational", "desk", "contact", "projector"].includes(view);
  const motionEnabled =
    !paused &&
    (!reduced ||
      (process.env.NODE_ENV === "development" && debug && previewMotion));

  useEffect(() => {
    if (
      !slideshow ||
      !visible ||
      !entered ||
      view !== "projector" ||
      !motionEnabled ||
      images.length < 2
    )
      return;
    const timer = window.setInterval(
      () => setSlideIndex((i) => (i + 1) % images.length),
      8000,
    );
    return () => clearInterval(timer);
  }, [slideshow, visible, entered, view, motionEnabled, images.length]);
  useEffect(() => {
    if (!tour || !visible || !entered || !motionEnabled) return;
    // Guided tour advances on its own; any manual station choice resets
    // the countdown via the view dependency. Paused / reduced-motion
    // stays fully manual.
    const next = guidedRoute[(guidedRoute.indexOf(view) + 1) % guidedRoute.length];
    const timer = window.setTimeout(() => go(next), 9000);
    return () => clearTimeout(timer);
    // go is a stable hoisted helper below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tour, visible, entered, motionEnabled, view]);
  useEffect(() => {
    document.documentElement.dataset.theme = "night";
  }, []);
  useEffect(() => {
    const handleDeepLink = () => {
      const requested = new URLSearchParams(location.search).get("device");
      if (requested === "mmsa" || requested === "microscope") {
        enter(requested);
        // Ordinary visits stay in 2D; an explicit inspection URL enters the model.
        if (location.hash === "#lab")
          stage.current?.scrollIntoView({ block: "start", behavior: "instant" });
      }
    };
    if (!deepLinkHandled.current) {
      deepLinkHandled.current = true;
      handleDeepLink();
    }
    // Home exhibit: hero/research links use ?device=…#lab without remount.
    window.addEventListener("popstate", handleDeepLink);
    window.addEventListener("hashchange", handleDeepLink);
    return () => {
      window.removeEventListener("popstate", handleDeepLink);
      window.removeEventListener("hashchange", handleDeepLink);
    };
    // enter is a stable hoisted helper below.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () => setReduced(media.matches);
    sync();
    media.addEventListener("change", sync);
    const small =
      matchMedia("(pointer: coarse)").matches || window.innerWidth < 700;
    const memory = (navigator as Navigator & { deviceMemory?: number })
      .deviceMemory;
    // CPU count cannot establish GPU capacity. High detail is an explicit choice.
    setQuality(
      small || (memory !== undefined && memory < 4) ? "low" : "medium",
    );
    try {
      setPaused(localStorage.getItem("motion-preference") === "paused");
    } catch {}
    setDebug(
      process.env.NODE_ENV === "development" &&
        new URLSearchParams(location.search).get("debug") === "1",
    );
    return () => media.removeEventListener("change", sync);
  }, []);
  useEffect(() => {
    let intersecting = true;
    const sync = () => setVisible(intersecting && !document.hidden);
    const observer = new IntersectionObserver(
      ([entry]) => {
        intersecting = entry.isIntersecting;
        sync();
      },
      { rootMargin: "80px" },
    );
    if (stage.current) observer.observe(stage.current);
    document.addEventListener("visibilitychange", sync);
    return () => {
      observer.disconnect();
      document.removeEventListener("visibilitychange", sync);
    };
  }, []);
  const onReady = useCallback(() => {
    setReady(true);
    // Populate both benches when the room opens. Detail tiers still load
    // only when a device is selected, and no GLBs load before entering 3D.
    setVisited((ids) =>
      researchDevices.every((device) => ids.includes(device.id))
        ? ids
        : researchDevices.map((device) => device.id),
    );
  }, []);
  const onFailure = useCallback(() => {
    setFailed(true);
    setEntered(false);
  }, []);
  const onStatus = useCallback(
    (id: DeviceId, status: string) =>
      setStatuses((s) => (s[id] === status ? s : { ...s, [id]: status })),
    [],
  );
  function enter(next: LabView = "overview") {
    if (!entered) {
      try {
        const c = document.createElement("canvas");
        const gl = c.getContext("webgl2");
        if (!gl) {
          setFailed(true);
          return;
        }
        gl.getExtension("WEBGL_lose_context")?.loseContext();
      } catch {
        setFailed(true);
        return;
      }
    }
    setFailed(false);
    setFault(0);
    setEntered(true);
    setView(next);
    requestAnimationFrame(() =>
      stage.current?.scrollIntoView({ block: "start", behavior: "instant" }),
    );
    setSelection(null);
    setPublicationId(null);
    if (next === "engineering" || next === "mmsa")
      setVisited((ids) => (ids.includes("mmsa") ? ids : [...ids, "mmsa"]));
    if (next === "imaging" || next === "microscope")
      setVisited((ids) =>
        ids.includes("microscope") ? ids : [...ids, "microscope"],
      );
  }
  function go(next: LabView) {
    enter(next);
  }
  function returnToLab() {
    setView("overview");
    setSelection(null);
    setPublicationId(null);
    returnButton.current?.focus();
  }
  function showArchive(value: ArchiveSelection) {
    enter(value.kind);
    setSelection(value);
    if (value.kind === "publications") setPublicationId(value.id);
  }
  function showPublication(id: number) {
    enter("publications");
    setSelection({ kind: "publications", id });
    setPublicationId(id);
  }
  useEffect(() => {
    if (panelOpen) panelHeading.current?.focus({ preventScroll: true });
  }, [view, publicationId, selection, panelOpen]);
  function camera(kind: CameraCommand["kind"]) {
    setCommand({ kind, tick: Date.now() });
  }
  function pause() {
    const next = !paused;
    setPaused(next);
    try {
      localStorage.setItem("motion-preference", next ? "paused" : "system");
    } catch {}
  }

  return (
    <>
      <section className="lab-intro">
        <div>
          <div className="lab-eyebrow">
            <span />
            THE RESEARCH ENVIRONMENT
          </div>
          <h1>
            A closer look
            <br />
            at discovery<span>.</span>
          </h1>
        </div>
        <div className="lab-intro-copy">
          <p>
            Step inside the laboratory. Explore the devices, inspect the
            engineering, and follow the research behind each experiment.
          </p>
          <a href="#research-devices" className="lab-text-link">
            Browse the research devices <span>↘</span>
          </a>
        </div>
      </section>
      <section
        className="lab-explorer"
        aria-label="Interactive research laboratory"
        onKeyDown={(e) => {
          if (e.key === "Escape" && panelOpen) returnToLab();
        }}
      >
        <div className="lab-stage-top">
          <div className="lab-location">
            <span className="lab-live-dot" />
            {viewLabels[view]}
          </div>
          <div className="lab-stage-meta">
            SILUVERU RESEARCH LAB /{" "}
            <span>{activeDevice ? "INSPECTION" : "EXPLORATION"}</span>
          </div>
        </div>
        <div className={`lab-workspace ${panelOpen ? "with-panel" : ""}`}>
          <div
            ref={stage}
            className="lab-stage"
            data-capture={capture}
            data-microscope-state={statuses.microscope || "idle"}
            data-mmsa-state={statuses.mmsa || "idle"}
            aria-label="Laboratory visualization"
            tabIndex={entered ? 0 : -1}
            aria-describedby={entered ? "lab-camera-help" : undefined}
            onKeyDown={(event) => {
              if (event.target !== event.currentTarget || !entered) return;
              const actions: Record<string, CameraCommand["kind"]> = {
                ArrowLeft: "left",
                ArrowRight: "right",
                ArrowUp: "in",
                ArrowDown: "out",
                KeyW: "fwd",
                KeyS: "back",
                KeyA: "strafeL",
                KeyD: "strafeR",
              };
              const kind = actions[event.code];
              if (kind) {
                event.preventDefault();
                camera(kind);
              }
            }}
          >
            {!entered || failed ? (
              <div className="lab-cover">
                <Image
                  width={1024}
                  height={640}
                  priority
                  sizes="(max-width: 760px) 90vw, 1280px"
                  src="/3d/environment/laboratory.webp?v=20260914b"
                  alt="Overview of the research laboratory with the supplied microscope and microgravity simulator on separate workbenches"
                />
                <div className="lab-cover-shade" />
                <div className="lab-entry">
                  <span className="lab-entry-icon">↗</span>
                  <h2>
                    {failed
                      ? "Research, within reach."
                      : "Your invitation to explore."}
                  </h2>
                  <p>
                    {failed
                      ? "The 3D view is unavailable on this device. Every research entry remains available below."
                      : "Devices, research archives, experiments, and the people behind them."}
                  </p>
                  {!failed && (
                    <button
                      className="lab-button primary"
                      onClick={() => enter()}
                    >
                      Enter the laboratory <span>→</span>
                    </button>
                  )}
                  {failed && (
                    <>
                      <a
                        className="lab-button primary"
                        href="#research-devices"
                      >
                        Explore the research ↓
                      </a>
                      <button
                        className="lab-button subtle"
                        onClick={() => enter()}
                      >
                        Try 3D again
                      </button>
                    </>
                  )}
                </div>
              </div>
            ) : (
              <SceneBoundary onFailure={onFailure}>
                <LabScene
                  theme={theme}
                  view={view}
                  quality={quality}
                  motion={motionEnabled}
                  visible={visible}
                  debug={debug && !capture}
                  fault={fault}
                  content={content}
                  visited={visited}
                  command={command}
                  onView={go}
                  onPublication={showPublication}
                  selection={selection}
                  onArchive={showArchive}
                  slideIndex={slideIndex}
                  videoElement={videoElement}
                  onStatus={onStatus}
                  onReady={onReady}
                  onFailure={onFailure}
                />
              </SceneBoundary>
            )}
            {entered && (
              <div className="lab-scene-top">
                <button
                  ref={returnButton}
                  className="lab-floating-button"
                  onClick={returnToLab}
                >
                  ← Return to lab
                </button>
                <span className="lab-view-number">
                  {String(
                    Math.max(
                      0,
                      labStations.findIndex(
                        (s) =>
                          s.id ===
                          (view === "mmsa"
                            ? "engineering"
                            : view === "microscope"
                              ? "imaging"
                              : view),
                      ),
                    ),
                  ).padStart(2, "0")}
                  <i> / {labStations.length - 1}</i>
                </span>
              </div>
            )}
            {entered && !ready && (
              <div className="lab-render-status" role="status">
                Preparing the room…
              </div>
            )}
            {entered && (
              <div
                className="lab-inspection-controls"
                aria-label="Laboratory camera controls"
              >
                <button
                  onClick={() => camera("left")}
                  aria-label="Rotate device view left"
                >
                  ↶
                </button>
                <button
                  onClick={() => camera("right")}
                  aria-label="Rotate device view right"
                >
                  ↷
                </button>
                <span />
                <button onClick={() => camera("out")} aria-label="Zoom out">
                  −
                </button>
                <button onClick={() => camera("in")} aria-label="Zoom in">
                  +
                </button>
                <small id="lab-camera-help">
                  {activeDevice
                    ? "Drag to orbit · WASD to walk · Arrow keys rotate / zoom"
                    : "Drag to look around · WASD to walk · Arrow keys rotate / zoom"}
                </small>
              </div>
            )}
            {entered && (
              <div className="lab-scene-status" role="status">
                {activeDevice && statuses[activeDevice.id] === "loading"
                  ? "Loading the supplied research model…"
                  : activeDevice && statuses[activeDevice.id] === "error"
                    ? "Model could not load. The research panel is still available."
                    : activeDevice
                      ? "Controlled inspection"
                      : view === "engineering" && statuses.mmsa === "loading"
                        ? "Loading the microgravity exhibit…"
                        : "Select a station to explore"}
              </div>
            )}
            {debug && entered && (
              <div className="lab-debug">
                <strong>DEVELOPMENT / MODEL INSPECTOR</strong>
                <pre>
                  {JSON.stringify(
                    {
                      view,
                      quality,
                      systemReducedMotion: reduced,
                      motionEnabled,
                      models: statuses,
                      origin: activeDevice?.position,
                      rotation: activeDevice?.rotation,
                      displayScale: activeDevice?.scale,
                      cameraTarget: activeDevice?.target,
                      hierarchy:
                        activeDevice?.id === "mmsa"
                          ? "mmsa_normalized → (unnamed transform) → geometry_0"
                          : "microscope_normalized → (unnamed transform) → Layer_dia-",
                      units: "normalized display units",
                    },
                    null,
                    2,
                  )}
                </pre>
                <span>Axes · bounding box · camera target enabled</span>
              </div>
            )}
          </div>
          {panelOpen && (
            <aside
              className="lab-research-panel"
              aria-label="Selected research record"
            >
              <div className="lab-panel-top">
                <span>
                  {activeDevice
                    ? "DEVICE / RESEARCH RECORD"
                    : "RESEARCH LIBRARY"}
                </span>
                <button onClick={returnToLab} aria-label="Close research panel">
                  ×
                </button>
              </div>
              <div className="lab-panel-scroll">
                <span className="lab-eyebrow">
                  {activeDevice?.bay || publication?.journal}
                </span>
                <h2 ref={panelHeading} tabIndex={-1}>
                  {activeDevice?.title ||
                    publication?.title ||
                    viewLabels[view]}
                </h2>
                {activeVideo && entered && visible && (
                  <LabVideoPlayer
                    key={activeVideo.id}
                    media={activeVideo}
                    playing={motionEnabled}
                    onElement={setVideoElement}
                  />
                )}
                {activeDevice && (
                  <>
                    <p className="lab-panel-project">
                      {record?.project?.title ||
                        "The associated project record is currently unavailable."}
                    </p>
                    {record?.project && (
                      <>
                        <span className="lab-status-tag">
                          {record.project.status.replaceAll("_", " ")}
                        </span>
                        <a
                          className="lab-button primary lab-full-research"
                          href={`/research/${record.project.slug}`}
                        >
                          View full research <span>↗</span>
                        </a>
                      </>
                    )}
                    <p className="lab-record-note">
                      {activeDevice.id === "mmsa"
                        ? "The supplied MMSA geometry represents the researcher’s simulator. The neutral finish is for presentation; source units are unspecified."
                        : "Supplied microscope model, linked to the imaging research. The source does not establish that this geometry is an exact model of the OncoSpectrix prototype."}
                    </p>
                    {record?.project &&
                      projectSections.map(([key, label], i) =>
                        record.project?.[key] ? (
                          <details
                            className="lab-detail"
                            key={key}
                            open={i === 0}
                          >
                            <summary>
                              {label}
                              <span>+</span>
                            </summary>
                            <p>{record.project[key]}</p>
                          </details>
                        ) : null,
                      )}
                    <div className="lab-associated">
                      <h3>Associated publications</h3>
                      <p>No associated publications listed.</p>
                      <button
                        className="lab-text-link"
                        onClick={() => go("publications")}
                      >
                        Explore the publication wall ↗
                      </button>
                    </div>
                    <div className="lab-associated">
                      <h3>Associated patents</h3>
                      {record?.patents.length ? (
                        record.patents.map((p) => (
                          <article key={p.id}>
                            <span className="lab-status-tag">
                              {p.status.replaceAll("_", " ")}
                            </span>
                            <h4>{p.title}</h4>
                            <p>{p.description}</p>
                            <a className="lab-text-link" href="/patents">
                              View patent records ↗
                            </a>
                          </article>
                        ))
                      ) : (
                        <p>No associated patents listed.</p>
                      )}
                    </div>
                    <p className="lab-record-note">
                      Research and patent status labels reproduce the source
                      records. Scientific claims and filing status retain the
                      confirmation notes on the full research pages.
                    </p>
                  </>
                )}
                {archive && !publication && (
                  <LabArchivePanel
                    content={content}
                    kind={archive}
                    selection={selection}
                    onSelect={showArchive}
                  />
                )}
                {view === "projector" && (
                  <ProjectorPanel
                    images={images}
                    index={slideIndex}
                    motion={motionEnabled}
                    playing={slideshow && motionEnabled}
                    onIndex={setSlideIndex}
                    onPlaying={setSlideshow}
                  />
                )}
                {view === "desk" && (
                  <>
                    <p>
                      The capabilities below are preserved from the existing
                      About page.
                    </p>
                    {Object.entries(skillGroups).map(([label, skills]) => (
                      <details className="lab-detail" key={label} open>
                        <summary>{label}</summary>
                        <div className="lab-skill-tags">
                          {skills.map((s) => (
                            <span key={s.name}>{s.name}</span>
                          ))}
                        </div>
                      </details>
                    ))}
                    <a className="lab-button primary" href="/about">
                      Meet the researcher ↗
                    </a>
                    <a className="lab-text-link" href="/timeline">
                      Research timeline ↗
                    </a>
                  </>
                )}
                {view === "contact" && (
                  <>
                    <p>
                      Discuss collaborations in biomedical imaging, optical
                      diagnostics, and computational research.
                    </p>
                    <a className="lab-button primary" href="/contact">
                      Open the contact form ↗
                    </a>
                  </>
                )}
                {capabilityStations
                  .filter(
                    (s) =>
                      s.view === view ||
                      (view === "microscope" && s.view === "imaging") ||
                      (view === "mmsa" && s.view === "engineering"),
                  )
                  .map((station) => (
                    <details className="lab-detail" key={station.group}>
                      <summary>{station.group}</summary>
                      <p>
                        Capabilities represented by the{" "}
                        {station.label.toLowerCase()}.
                      </p>
                      <div className="lab-skill-tags">
                        {skillGroups[station.group].map((skill) => (
                          <a key={skill.name} href="/about">
                            {skill.name}
                          </a>
                        ))}
                      </div>
                      {projectsMentioningSkills(
                        content.projects || [],
                        station.group,
                      ).map(({ project, mentions }) => (
                        <p key={project.id}>
                          <a
                            className="lab-text-link"
                            href={`/research/${project.slug}`}
                          >
                            {project.title} ↗
                          </a>
                          <br />
                          <small>Mentions: {mentions.join(" · ")}</small>
                        </p>
                      ))}
                    </details>
                  ))}
                {view === "computational" && (
                  <div className="lab-computational-records">
                    {content.computationalProjects?.length ? (
                      content.computationalProjects.map((project) => (
                        <article key={project.id}>
                          <span className="lab-status-tag">
                            {project.status.replaceAll("_", " ")}
                          </span>
                          <h3>{project.title}</h3>
                          {project.cover_image && (
                            <Image
                              src={project.cover_image}
                              alt={project.title}
                              width={500}
                              height={320}
                              sizes="(max-width:760px) 85vw, 340px"
                            />
                          )}
                          <p>{project.research_problem}</p>
                          <a
                            className="lab-button primary"
                            href={`/research/${project.slug}`}
                          >
                            Read the full case study ↗
                          </a>
                        </article>
                      ))
                    ) : (
                      <p>
                        Computational research records are currently
                        unavailable.
                      </p>
                    )}
                  </div>
                )}
                {publication && (
                  <>
                    <span className="lab-status-tag">
                      {publication.status.replaceAll("_", " ")} ·{" "}
                      {publication.year}
                    </span>
                    <p className="lab-panel-project">{publication.authors}</p>
                    {publication.abstract && (
                      <div className="lab-abstract">
                        <h3>Abstract</h3>
                        <p>{publication.abstract}</p>
                      </div>
                    )}
                    <a className="lab-button primary" href="/publications">
                      View publication records ↗
                    </a>
                    {publication.doi && (
                      <a
                        className="lab-text-link"
                        href={`https://doi.org/${publication.doi}`}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Open DOI ↗
                      </a>
                    )}
                    {safeExternalHref(publication.pdf_url) && (
                      <a
                        className="lab-text-link"
                        href={safeExternalHref(publication.pdf_url)!}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        Read manuscript ↗
                      </a>
                    )}
                    <p className="lab-record-note">
                      Publication status, year, and venue are source metadata
                      awaiting confirmation against final records.
                    </p>
                  </>
                )}
              </div>
            </aside>
          )}
        </div>
        <div className="lab-toolbar">
          <nav aria-label="Laboratory stations">
            {labStations
              .map(
                (s, i) => [s.id, String(i).padStart(2, "0"), s.label] as const,
              )
              .map(([key, num, title]) => (
                <button
                  key={key}
                  className={
                    view === key ||
                    (key === "imaging" && view === "microscope") ||
                    (key === "engineering" && view === "mmsa")
                      ? "selected"
                      : ""
                  }
                  aria-pressed={
                    view === key ||
                    (key === "imaging" && view === "microscope") ||
                    (key === "engineering" && view === "mmsa")
                  }
                  onClick={() => go(key)}
                >
                  <span>{num}</span>
                  {title}
                </button>
              ))}
          </nav>
          <div className="lab-preferences">
            <label>
              Quality
              <select
                value={quality}
                onChange={(e) => setQuality(e.target.value as Quality)}
                aria-label="3D quality"
              >
                <option value="high">High</option>
                <option value="medium">Medium</option>
                <option value="low">Low</option>
              </select>
            </label>
            <button
              aria-pressed={paused}
              onClick={pause}
              title={reduced ? "System reduced motion is respected" : undefined}
            >
              {paused ? "Resume motion" : "Pause motion"}
            </button>
            {entered && (
              <button
                onClick={() => {
                  setEntered(false);
                  setReady(false);
                  returnToLab();
                }}
              >
                2D view
              </button>
            )}
          </div>
        </div>
        <LabNavigation view={view} tour={tour} autoTour={tour && motionEnabled && visible && entered} onTour={setTour} onView={go} />
        {process.env.NODE_ENV === "development" && debug && (
          <>
            <div className="lab-debug-controls">
              <span>Development checks</span>
              <button
                onClick={() => setFault((v) => v + 1)}
                disabled={!entered}
              >
                Simulate WebGL context loss
              </button>
              <button
                aria-pressed={capture}
                onClick={() => setCapture((v) => !v)}
              >
                Capture clean scene
              </button>
              <span>System reduced motion: {reduced ? "on" : "off"}</span>
              <label>
                <input
                  type="checkbox"
                  checked={previewMotion}
                  onChange={(e) => setPreviewMotion(e.target.checked)}
                />{" "}
                Preview animated transitions
              </label>
            </div>
            <LabDiagnostics />
          </>
        )}
      </section>
      <section
        className="lab-device-directory"
        id="research-devices"
        aria-label="Research devices"
      >
        <div className="lab-section-heading">
          <div>
            <span className="lab-eyebrow">THE RESEARCH DEVICES</span>
            <h2>
              Real artifacts.
              <br />
              Open questions.
            </h2>
          </div>
          <p>
            Every exhibit connects to its research record.
            <br />
            Explore with or without the 3D experience.
          </p>
        </div>
        {content.unavailable && (
          <p role="status" className="lab-record-note">
            Research records are temporarily unavailable. You can still visit
            the project pages below.
          </p>
        )}
        <div className="lab-device-cards">
          {researchDevices.map((d, i) => {
            const item = content.devices.find((r) => r.id === d.id);
            return (
              <article key={d.id} className="lab-device-card">
                <div className="lab-card-image">
                  <Image
                    width={1024}
                    height={512}
                    sizes="(max-width: 760px) 90vw, 50vw"
                    src={d.preview}
                    alt={`Rendered view of the supplied ${d.title.toLowerCase()} model`}
                    loading="lazy"
                  />
                  <span className="lab-card-number">
                    0{i + 1} / {d.bay}
                  </span>
                  <button
                    onClick={() => {
                      enter(d.id);
                      stage.current?.scrollIntoView({
                        behavior: reduced || paused ? "instant" : "smooth",
                        block: "center",
                      });
                    }}
                    aria-label={`Inspect ${d.title} in 3D`}
                  >
                    Inspect in 3D ↗
                  </button>
                </div>
                <div className="lab-card-body">
                  <h3>{d.title}</h3>
                  <p>{item?.project?.title || d.bay}</p>
                  <a
                    href={`/research/${item?.project?.slug || d.sourceSlug}`}
                    className="lab-text-link"
                  >
                    View research <span>↗</span>
                  </a>
                </div>
              </article>
            );
          })}
        </div>
      </section>
      <section
        className="lab-all-archives"
        aria-label="Complete research archive"
      >
        <div className="lab-section-heading">
          <div>
            <span className="lab-eyebrow">THE COMPLETE COLLECTION</span>
            <h2>Explore every record.</h2>
          </div>
          <p>Open a folder in 3D or continue directly to its research page.</p>
        </div>
        {labStations
          .filter((s) => s.archive && s.archive !== "publications")
          .map((station) => (
            <details
              key={station.id}
              className="lab-archive-directory"
              open={station.id === "projects"}
            >
              <summary>
                {station.label}
                <span>
                  {archiveRecords(content, station.archive!).length} records
                </span>
              </summary>
              <div>
                {archiveRecords(content, station.archive!).map((record) => (
                  <article key={record.id}>
                    <span className="lab-eyebrow">{record.label}</span>
                    <h3>{record.title}</h3>
                    <a href={record.href}>Read full record ↗</a>
                    <button
                      onClick={() => {
                        showArchive({ kind: station.archive!, id: record.id });
                        stage.current?.scrollIntoView({
                          block: "center",
                          behavior: motionEnabled ? "smooth" : "instant",
                        });
                      }}
                    >
                      Open folder in 3D ↗
                    </button>
                  </article>
                ))}
              </div>
            </details>
          ))}
      </section>
      <section className="lab-library" id="lab-publications">
        <div className="lab-section-heading">
          <div>
            <span className="lab-eyebrow">FROM EXPERIMENT TO EVIDENCE</span>
            <h2>The research library.</h2>
          </div>
          <a className="lab-text-link" href="/publications">
            All publications ↗
          </a>
        </div>
        {content.publications.length ? (
          content.publications.map((p, i) => (
            <article key={p.id} className="lab-paper">
              <span className="lab-paper-number">
                {String(i + 1).padStart(2, "0")}
              </span>
              <div>
                <span className="lab-eyebrow">
                  {p.year} · {p.journal}
                </span>
                <h3>{p.title}</h3>
                <p>{p.authors}</p>
              </div>
              <div className="lab-paper-action">
                <span className="lab-status-tag">
                  {p.status.replaceAll("_", " ")}
                </span>
                <button
                  className="lab-text-link"
                  onClick={() => {
                    showPublication(p.id);
                    stage.current?.scrollIntoView({
                      behavior: reduced || paused ? "instant" : "smooth",
                      block: "center",
                    });
                  }}
                >
                  Read record ↗
                </button>
              </div>
            </article>
          ))
        ) : (
          <p>No publication records are available.</p>
        )}
      </section>
    </>
  );
}
