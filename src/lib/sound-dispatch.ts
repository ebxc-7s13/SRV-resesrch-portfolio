// Interaction → sound mapping. One delegated listener set (installed by the
// SoundSystem component) classifies the control a visitor actually hovered or
// activated, so no component needs its own sound calls:
//
//   region        .site-navigation → nav · .site-footer → footer ·
//                 [data-sound-panel] → ui · everything else → button
//   opt out       data-sound="none" on the control or any ancestor
//   override      data-sound="nav|button|footer|ui" picks the category,
//                 data-sound-event="click|select|open|close|toggleOn|
//                 toggleOff|confirm" picks the event
//   state         aria-expanded → open/close, aria-pressed / aria-checked /
//                 checkbox → toggleOn/toggleOff, tabs / options → select
//
// resolveClick / resolveHover are pure so the mapping is unit-testable.
"use client";

import { UI_EVENTS, type InterfaceCategory, type SoundEvent } from "./sound-profiles";

export type SoundRegion = "nav" | "footer" | "panel" | "page";

export type ControlInfo = {
  tag: string;
  role: string | null;
  type: string | null;
  href: boolean;
  expanded: string | null;
  pressed: string | null;
  checked: string | null;
  /** Checkbox / radio state after the click already toggled it. */
  inputChecked: boolean | null;
  /** <details> open state before a summary click. */
  detailsOpen: boolean | null;
  disabled: boolean;
  sound: string | null;
  soundEvent: string | null;
  region: SoundRegion;
};

export type ResolvedSound = { category: InterfaceCategory; event: SoundEvent };

const CATEGORIES: InterfaceCategory[] = ["nav", "button", "footer", "ui"];
const EVENTS: SoundEvent[] = ["hover", "click", "select", "open", "close", "toggleOn", "toggleOff", "confirm"];
const REGION_CATEGORY: Record<SoundRegion, InterfaceCategory> = {
  nav: "nav",
  footer: "footer",
  panel: "ui",
  page: "button",
};

function categoryOf(info: ControlInfo): InterfaceCategory {
  return CATEGORIES.includes(info.sound as InterfaceCategory)
    ? (info.sound as InterfaceCategory)
    : REGION_CATEGORY[info.region];
}

/** Fold a generic event into one the category's profiles define. */
export function fitEvent(category: InterfaceCategory, event: SoundEvent): SoundEvent {
  const allowed = UI_EVENTS[category] as readonly SoundEvent[];
  if (allowed.includes(event)) return event;
  if (category === "footer") return event === "hover" ? "hover" : "click";
  if (category === "button") {
    if (event === "open") return "toggleOn";
    if (event === "close") return "toggleOff";
    return "click";
  }
  // nav
  if (event === "toggleOn") return "select";
  if (event === "toggleOff") return "select";
  return "click";
}

export function resolveClick(info: ControlInfo): ResolvedSound | null {
  if (info.disabled || info.sound === "none") return null;
  const category = categoryOf(info);
  let event: SoundEvent;
  if (EVENTS.includes(info.soundEvent as SoundEvent)) event = info.soundEvent as SoundEvent;
  else if (info.expanded !== null) event = info.expanded === "true" ? "close" : "open";
  else if (info.detailsOpen !== null) event = info.detailsOpen ? "close" : "open";
  else if (info.inputChecked !== null)
    event = info.type === "radio" ? "select" : info.inputChecked ? "toggleOn" : "toggleOff";
  else if (info.pressed !== null) event = info.pressed === "true" ? "toggleOff" : "toggleOn";
  else if (info.checked !== null && (info.role === "switch" || info.role === "checkbox"))
    event = info.checked === "true" ? "toggleOff" : "toggleOn";
  else if (info.role === "tab" || info.role === "option" || info.role === "radio" || info.role === "menuitem")
    event = "select";
  else if (category === "nav" && !info.href) event = "select";
  else event = "click";
  return { category, event: fitEvent(category, event) };
}

export function resolveHover(info: ControlInfo): ResolvedSound | null {
  if (info.disabled || info.sound === "none") return null;
  const category = categoryOf(info);
  // The sound panel stays quiet on hover: it is a dense list of auditions.
  if (category === "ui") return null;
  if (info.tag === "input" || info.tag === "select") return null;
  return { category, event: "hover" };
}

// ---------------------------------------------------------------------------
// DOM side
// ---------------------------------------------------------------------------

export const INTERACTIVE_SELECTOR = [
  "a[href]",
  "button",
  "summary",
  "select",
  'input[type="checkbox"]',
  'input[type="radio"]',
  'input[type="submit"]',
  'input[type="button"]',
  '[role="button"]',
  '[role="tab"]',
  '[role="switch"]',
  '[role="checkbox"]',
  '[role="radio"]',
  '[role="menuitem"]',
  '[role="option"]',
].join(",");

export function findControl(target: EventTarget | null): Element | null {
  const element =
    target && typeof (target as Element).closest === "function" ? (target as Element) : null;
  return element?.closest(INTERACTIVE_SELECTOR) ?? null;
}

export function describeControl(el: Element): ControlInfo {
  const tag = el.tagName.toLowerCase();
  const input = tag === "input" ? (el as HTMLInputElement) : null;
  const optOut = el.closest('[data-sound="none"]');
  const details = tag === "summary" ? el.parentElement : null;
  return {
    tag,
    role: el.getAttribute("role"),
    type: input?.type ?? null,
    href: tag === "a",
    expanded: el.getAttribute("aria-expanded"),
    pressed: el.getAttribute("aria-pressed"),
    checked: el.getAttribute("aria-checked"),
    inputChecked: input && (input.type === "checkbox" || input.type === "radio") ? input.checked : null,
    detailsOpen: details && details.tagName.toLowerCase() === "details" ? (details as HTMLDetailsElement).open : null,
    disabled:
      (el as HTMLButtonElement).disabled === true || el.getAttribute("aria-disabled") === "true",
    sound: optOut ? "none" : el.closest("[data-sound]")?.getAttribute("data-sound") ?? null,
    soundEvent: el.getAttribute("data-sound-event"),
    region: el.closest("[data-sound-panel]")
      ? "panel"
      : el.closest(".site-footer, [data-sound-region='footer']")
        ? "footer"
        : el.closest(".site-navigation, [data-sound-region='nav']")
          ? "nav"
          : "page",
  };
}
