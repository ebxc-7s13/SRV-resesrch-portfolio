"use client";
import { useEffect, useId, useRef, useState, type KeyboardEvent } from "react";
import {
  applySoundPreset,
  resetSoundSettings,
  setSceneProfile,
  setSoundSettings,
  useSoundSettings,
  type SoundSettingsPatch,
} from "@/lib/sound-settings";
import {
  isAudioSupported,
  playInterface,
  playSceneTransition,
  previewInterfaceProfile,
  previewSceneProfile,
  unlockAudio,
} from "@/lib/sound-engine";
import {
  SCENE_FAMILIES,
  SCENE_LABELS,
  SCENE_PROFILES,
  SOUND_PRESETS,
  UI_CATALOG,
  type ProfileCategory,
  type SceneFamily,
} from "@/lib/sound-profiles";

const TABS = [
  { id: "nav", label: "Menu" },
  { id: "button", label: "Buttons" },
  { id: "footer", label: "Footer" },
  { id: "scenes", label: "Scenes" },
  { id: "mix", label: "Mix" },
] as const;
type TabId = (typeof TABS)[number]["id"];

const CATEGORY_NOTES: Record<ProfileCategory, string> = {
  nav: "Applies to every main navigation link, the mobile menu and header controls.",
  button: "Applies to buttons, cards, tabs and toggles across every page.",
  footer: "Applies to footer links only. Independent of the other categories.",
};

function SpeakerIcon({ muted }: { muted: boolean }) {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 9.5h3.2L12 5.5v13l-4.8-4H4z" />
      {muted ? (
        <path d="m16 9.5 5 5m0-5-5 5" />
      ) : (
        <>
          <path className="sound-wave-1" d="M15.4 9.2a4 4 0 0 1 0 5.6" />
          <path className="sound-wave-2" d="M18.2 6.6a7.6 7.6 0 0 1 0 10.8" />
        </>
      )}
    </svg>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
      <path d="M3 1.8v8.4L10 6z" fill="currentColor" />
    </svg>
  );
}

function Switch({
  label,
  checked,
  onChange,
  hint,
}: {
  label: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  hint?: string;
}) {
  const hintId = useId();
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      aria-describedby={hint ? hintId : undefined}
      className="sound-switch"
      data-sound="none"
      onClick={() => onChange(!checked)}
    >
      <span className="sound-switch-text">
        <span>{label}</span>
        {hint && <small id={hintId}>{hint}</small>}
      </span>
      <span className="sound-switch-track" aria-hidden="true">
        <span className="sound-switch-thumb" />
      </span>
      <span className="sound-switch-state" aria-hidden="true">{checked ? "On" : "Off"}</span>
    </button>
  );
}

function Level({
  label,
  value,
  disabled,
  onChange,
  onCommit,
}: {
  label: string;
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  onCommit: () => void;
}) {
  const id = useId();
  const percent = Math.round(value * 100);
  return (
    <div className="sound-level">
      <div className="sound-level-head">
        <label htmlFor={id}>{label}</label>
        <output htmlFor={id}>{percent}%</output>
      </div>
      <input
        id={id}
        type="range"
        min={0}
        max={100}
        step={1}
        value={percent}
        disabled={disabled}
        data-sound="none"
        aria-valuetext={`${percent} percent`}
        onChange={(e) => onChange(Number(e.target.value) / 100)}
        onPointerUp={onCommit}
        onKeyUp={(e) => {
          if (e.key.startsWith("Arrow") || e.key === "Home" || e.key === "End" || e.key.startsWith("Page")) onCommit();
        }}
      />
    </div>
  );
}

function ProfileList({
  name,
  legend,
  profiles,
  selected,
  canPreview,
  onSelect,
  onPreview,
}: {
  name: string;
  legend: string;
  profiles: { id: string; name: string; description: string }[];
  selected: string;
  canPreview: boolean;
  onSelect: (id: string) => void;
  onPreview: (id: string) => void;
}) {
  return (
    <fieldset className="sound-profiles">
      <legend className="sr-only">{legend}</legend>
      {profiles.map((profile, index) => {
        const active = profile.id === selected;
        return (
          <div key={profile.id} className={`sound-profile${active ? " is-selected" : ""}`}>
            <label className="sound-profile-pick">
              <input
                type="radio"
                name={name}
                value={profile.id}
                checked={active}
                aria-label={profile.name}
                aria-describedby={`${name}-${profile.id}-desc`}
                data-sound="none"
                onChange={() => onSelect(profile.id)}
              />
              <span className="sound-profile-index" aria-hidden="true">
                {String(index + 1).padStart(2, "0")}
              </span>
              <span className="sound-profile-text">
                <span className="sound-profile-name">
                  {profile.name}
                  {active && <span className="sound-profile-badge">Active</span>}
                </span>
                <span className="sound-profile-desc" id={`${name}-${profile.id}-desc`}>
                  {profile.description}
                </span>
              </span>
            </label>
            <button
              type="button"
              className="sound-preview"
              data-sound="none"
              disabled={!canPreview}
              aria-label={`Preview ${profile.name}`}
              title={`Preview ${profile.name}`}
              onClick={() => onPreview(profile.id)}
            >
              <PlayIcon />
            </button>
          </div>
        );
      })}
    </fieldset>
  );
}

export default function SoundControl({ activeScene }: { activeScene: SceneFamily | null }) {
  const settings = useSoundSettings();
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<TabId>("nav");
  const [family, setFamily] = useState<SceneFamily>(activeScene ?? "flux");
  const [supported, setSupported] = useState(true);
  const dockRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const tabRefs = useRef<Partial<Record<TabId, HTMLButtonElement | null>>>({});
  const panelId = useId();
  const tabsId = useId();

  useEffect(() => {
    setSupported(isAudioSupported());
  }, []);

  // Opening the panel shows the scene that is actually on screen.
  useEffect(() => {
    if (open && activeScene) setFamily(activeScene);
  }, [open, activeScene]);

  useEffect(() => {
    if (!open) return;
    const onPointerDown = (e: PointerEvent) => {
      if (!dockRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKeyDown = (e: globalThis.KeyboardEvent) => {
      if (e.key === "Escape") {
        setOpen(false);
        playInterface("ui", "close");
        buttonRef.current?.focus();
      }
    };
    document.addEventListener("pointerdown", onPointerDown);
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.removeEventListener("pointerdown", onPointerDown);
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [open]);

  // Float above the footer instead of covering its links: once the footer
  // scrolls into view, lift the dock by the overlap. No React renders.
  useEffect(() => {
    const dock = dockRef.current;
    if (!dock) return;
    let frame = 0;
    const update = () => {
      frame = 0;
      const footer = document.querySelector(".site-footer");
      const overlap = footer ? Math.max(0, window.innerHeight - footer.getBoundingClientRect().top) : 0;
      dock.style.setProperty("--sound-dock-lift", `${Math.round(overlap)}px`);
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", schedule, { passive: true });
    window.addEventListener("resize", schedule, { passive: true });
    // Route changes resize the document without scrolling.
    const observer = new ResizeObserver(schedule);
    observer.observe(document.body);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", schedule);
      window.removeEventListener("resize", schedule);
      observer.disconnect();
    };
  }, []);

  const set = (patch: SoundSettingsPatch, cue: "toggleOn" | "toggleOff" | "click" | "select" = "click") => {
    setSoundSettings(patch);
    playInterface("ui", cue);
  };

  const toggleMaster = () => {
    if (settings.enabled) {
      // Cue first, while the master bus is still open.
      playInterface("ui", "toggleOff");
      setSoundSettings({ enabled: false });
    } else {
      setSoundSettings({ enabled: true });
      unlockAudio();
      playInterface("ui", "toggleOn", { delay: 0.06 });
    }
  };

  const onTabKey = (e: KeyboardEvent<HTMLButtonElement>) => {
    const index = TABS.findIndex((t) => t.id === tab);
    let next = index;
    if (e.key === "ArrowRight") next = (index + 1) % TABS.length;
    else if (e.key === "ArrowLeft") next = (index - 1 + TABS.length) % TABS.length;
    else if (e.key === "Home") next = 0;
    else if (e.key === "End") next = TABS.length - 1;
    else return;
    e.preventDefault();
    setTab(TABS[next].id);
    tabRefs.current[TABS[next].id]?.focus();
    playInterface("ui", "select");
  };

  const canPreview = settings.enabled && supported;
  const status = !supported ? "Unavailable" : settings.enabled ? "On" : "Muted";
  const muted = !settings.enabled || !supported;

  return (
    <div
      ref={dockRef}
      className={`sound-dock${open ? " is-open" : ""}`}
      data-sound-panel
      data-state={muted ? "muted" : "on"}
    >
      {open && (
        <div id={panelId} className="sound-panel" role="dialog" aria-label="Sound settings">
          <div className="sound-panel-head">
            <div>
              <p className="sound-panel-kicker">Lab audio</p>
              <h2 className="sound-panel-title">Sound settings</h2>
            </div>
            <span className={`sound-status${muted ? " is-muted" : ""}`} role="status">
              <span className="sound-status-dot" aria-hidden="true" />
              {status}
            </span>
            <button
              type="button"
              className="sound-close"
              aria-label="Close sound settings"
              onClick={() => {
                setOpen(false);
                buttonRef.current?.focus();
              }}
              data-sound-event="close"
            >
              ×
            </button>
          </div>

          <div className="sound-master">
            <Switch label="Sound effects" checked={settings.enabled} onChange={toggleMaster} />
            <Level
              label="Master volume"
              value={settings.volume}
              disabled={!settings.enabled}
              onChange={(volume) => setSoundSettings({ volume })}
              onCommit={() => playInterface("ui", "click")}
            />
            {!supported && (
              <p className="sound-note">This browser does not support Web Audio. The site works normally without sound.</p>
            )}
            {supported && !settings.enabled && (
              <p className="sound-note">Effects are muted. Turn them on to audition profiles.</p>
            )}
          </div>

          <div className="sound-tabs" role="tablist" aria-label="Sound categories" id={tabsId}>
            {TABS.map((t) => (
              <button
                key={t.id}
                ref={(el) => {
                  tabRefs.current[t.id] = el;
                }}
                type="button"
                role="tab"
                id={`${tabsId}-${t.id}`}
                aria-selected={tab === t.id}
                aria-controls={`${tabsId}-${t.id}-panel`}
                tabIndex={tab === t.id ? 0 : -1}
                className="sound-tab"
                onClick={() => setTab(t.id)}
                onKeyDown={onTabKey}
              >
                {t.label}
              </button>
            ))}
          </div>

          <div
            className="sound-tabpanel"
            role="tabpanel"
            id={`${tabsId}-${tab}-panel`}
            aria-labelledby={`${tabsId}-${tab}`}
          >
            {(tab === "nav" || tab === "button" || tab === "footer") && (
              <>
                <p className="sound-scope">{CATEGORY_NOTES[tab]}</p>
                <ProfileList
                  name={`sound-${tab}`}
                  legend={`${TABS.find((t) => t.id === tab)?.label} sound profile`}
                  profiles={UI_CATALOG[tab]}
                  selected={settings[tab]}
                  canPreview={canPreview}
                  onSelect={(id) => {
                    setSoundSettings({ [tab]: id });
                    // Audition the newly chosen profile, not the old one.
                    playInterface(tab, "click", { profile: id });
                  }}
                  onPreview={(id) => previewInterfaceProfile(tab, id)}
                />
              </>
            )}

            {tab === "scenes" && (
              <>
                <p className="sound-scope">Each background environment keeps its own profile for transitions and ambience.</p>
                <div className="sound-families" role="group" aria-label="Background environment">
                  {SCENE_FAMILIES.map((f) => (
                    <button
                      key={f}
                      type="button"
                      className="sound-family"
                      aria-pressed={family === f}
                      data-sound-event="select"
                      onClick={() => setFamily(f)}
                    >
                      {SCENE_LABELS[f]}
                      {activeScene === f && <span className="sound-live">Live</span>}
                    </button>
                  ))}
                </div>
                <ProfileList
                  name={`sound-scene-${family}`}
                  legend={`${SCENE_LABELS[family]} scene sound profile`}
                  profiles={SCENE_PROFILES[family]}
                  selected={settings.scenes[family]}
                  canPreview={canPreview}
                  onSelect={(id) => {
                    setSceneProfile(family, id);
                    playSceneTransition(family, { profile: id, preview: true });
                  }}
                  onPreview={(id) => previewSceneProfile(family, id)}
                />
              </>
            )}

            {tab === "mix" && (
              <div className="sound-mix">
                <Switch label="Hover sounds" hint="Short cues when the pointer enters a control" checked={settings.hover}
                  onChange={(hover) => set({ hover }, hover ? "toggleOn" : "toggleOff")} />
                <Switch label="Scene transitions" hint="Plays when the background environment changes" checked={settings.transitions}
                  onChange={(transitions) => set({ transitions }, transitions ? "toggleOn" : "toggleOff")} />
                <Switch label="Ambient texture" hint="Quiet background bed for the live scene" checked={settings.ambient}
                  onChange={(ambient) => {
                    set({ ambient }, ambient ? "toggleOn" : "toggleOff");
                    if (ambient) unlockAudio();
                  }} />
                <Level
                  label="Ambient volume"
                  value={settings.ambientVolume}
                  disabled={!settings.ambient || !settings.enabled}
                  onChange={(ambientVolume) => setSoundSettings({ ambientVolume })}
                  onCommit={() => {}}
                />
                <Switch label="Panel sounds" hint="Cues for this settings panel" checked={settings.panelSounds}
                  onChange={(panelSounds) => {
                    setSoundSettings({ panelSounds });
                    if (panelSounds) playInterface("ui", "toggleOn");
                  }} />
                <div className="sound-presets">
                  <p className="sound-subhead">Presets</p>
                  <p className="sound-scope">Sets menu, button, footer and scene profiles together. Fine-tune each tab afterwards.</p>
                  <div className="sound-preset-grid">
                    {SOUND_PRESETS.map((preset) => {
                      const active =
                        settings.nav === preset.nav &&
                        settings.button === preset.button &&
                        settings.footer === preset.footer &&
                        SCENE_FAMILIES.every((f) => settings.scenes[f] === preset.scenes[f]);
                      return (
                        <button
                          key={preset.id}
                          type="button"
                          className="sound-preset"
                          aria-pressed={active}
                          data-sound="none"
                          onClick={() => {
                            applySoundPreset(preset.id);
                            playInterface("button", "click", { profile: preset.button });
                          }}
                        >
                          {preset.name}
                        </button>
                      );
                    })}
                  </div>
                </div>
                <button
                  type="button"
                  className="sound-reset"
                  data-sound="none"
                  onClick={() => {
                    resetSoundSettings();
                    playInterface("ui", "click");
                  }}
                >
                  Reset to defaults
                </button>
              </div>
            )}
          </div>
          <p className="sound-footnote">Saved in this browser. Ambient sound stays off unless you turn it on.</p>
        </div>
      )}

      <button
        ref={buttonRef}
        type="button"
        className="sound-dock-button"
        aria-expanded={open}
        aria-controls={open ? panelId : undefined}
        aria-label={`Sound settings — ${muted ? "sound off" : "sound on"}`}
        title="Sound settings"
        data-pointer
        onClick={() => setOpen((value) => !value)}
      >
        <SpeakerIcon muted={muted} />
        <span className="sound-dock-dot" aria-hidden="true" />
      </button>
    </div>
  );
}
