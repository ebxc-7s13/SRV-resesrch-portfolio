// Delegated, document-level interaction listeners — the only place pointer,
// touch and keyboard input turns into interface sounds. Installed once by
// the SoundSystem component (ref-counted, so Strict Mode's double mount
// never registers twice).
//
// - Activation uses the `click` event only: mouse, touch, pen, Enter and
//   Space all produce exactly one click, so nothing double-plays.
// - Hover uses `pointerover` for mouse pointers only and fires once per
//   control entered, not per child element crossed.
// - Synthetic clicks (element.click() from code) are ignored.
"use client";

import { describeControl, findControl, resolveClick, resolveHover } from "./sound-dispatch";
import { playInterface, unlockAudio } from "./sound-engine";

let installs = 0;
let teardown: (() => void) | null = null;

function install() {
  let hovered: Element | null = null;
  const recentClicks = new WeakMap<Element, number>();

  const unlock = (event: Event) => {
    if (event.isTrusted) unlockAudio();
  };

  const onClick = (event: MouseEvent) => {
    if (!event.isTrusted) return;
    const control = findControl(event.target);
    if (!control) return;
    const now = performance.now();
    if (now - (recentClicks.get(control) ?? -Infinity) < 90) return;
    recentClicks.set(control, now);
    const resolved = resolveClick(describeControl(control));
    if (!resolved) return;
    unlockAudio();
    playInterface(resolved.category, resolved.event);
  };

  const onPointerOver = (event: PointerEvent) => {
    if (event.pointerType !== "mouse" || !event.isTrusted) return;
    const control = findControl(event.target);
    if (control === hovered) return;
    hovered = control;
    if (!control) return;
    const resolved = resolveHover(describeControl(control));
    if (resolved) playInterface(resolved.category, resolved.event);
  };

  const onPointerOut = (event: PointerEvent) => {
    // Leaving the window resets so re-entering the same control sounds again.
    if (!event.relatedTarget) hovered = null;
  };

  document.addEventListener("pointerdown", unlock, true);
  document.addEventListener("keydown", unlock, true);
  document.addEventListener("click", onClick, true);
  document.addEventListener("pointerover", onPointerOver, { passive: true });
  document.addEventListener("pointerout", onPointerOut, { passive: true });
  return () => {
    document.removeEventListener("pointerdown", unlock, true);
    document.removeEventListener("keydown", unlock, true);
    document.removeEventListener("click", onClick, true);
    document.removeEventListener("pointerover", onPointerOver);
    document.removeEventListener("pointerout", onPointerOut);
  };
}

export function installSoundInteractions() {
  installs++;
  if (installs === 1) teardown = install();
  return () => {
    installs--;
    if (installs === 0) {
      teardown?.();
      teardown = null;
    }
  };
}
