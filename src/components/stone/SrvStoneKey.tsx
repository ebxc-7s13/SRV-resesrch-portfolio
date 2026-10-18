"use client";
import { useEffect, useId, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { STONE_PREFIX, isStonePath, toOriginalPath } from "@/lib/stone-mode";
import {
  STONE_PRESS_COUNT,
  STONE_PRESS_WINDOW_MS,
  initialPressState,
  registerPress,
} from "@/lib/triple-press";

/**
 * The About page's SRV mark, as a control: three presses within
 * STONE_PRESS_WINDOW_MS of each other enter Stone Mode (or, on the stone
 * About page, return to the original portfolio). `click` is the only input,
 * so mouse, touch, keyboard and assistive technology all count once.
 */
export default function SrvStoneKey() {
  const router = useRouter();
  const path = usePathname();
  const stone = isStonePath(path);
  const press = useRef(initialPressState);
  const timer = useRef<number | undefined>(undefined);
  const leaving = useRef(false);
  const [count, setCount] = useState(0);
  const hintId = useId();

  useEffect(() => () => window.clearTimeout(timer.current), []);

  const enter = () => {
    leaving.current = true;
    if (stone) {
      // Leaving stone: a full load drops the stone stylesheet and fonts.
      window.location.assign(toOriginalPath(path));
      return;
    }
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (!reduced && !document.getElementById("stone-veil")) {
      // A limestone veil closes over the page; StoneShell settles it once
      // the stone route has rendered. It never blocks navigation.
      const veil = document.createElement("div");
      veil.id = "stone-veil";
      veil.setAttribute("aria-hidden", "true");
      document.body.appendChild(veil);
      window.setTimeout(() => veil.remove(), 4000);
    }
    router.push(STONE_PREFIX);
  };

  const onClick = () => {
    if (leaving.current) return;
    const result = registerPress(press.current, performance.now());
    if (!result.accepted) return;
    window.clearTimeout(timer.current);
    if (result.complete) {
      press.current = initialPressState;
      setCount(STONE_PRESS_COUNT);
      enter();
      return;
    }
    press.current = result;
    setCount(result.count);
    // The sequence lapses if the next press does not arrive in time.
    timer.current = window.setTimeout(() => {
      press.current = initialPressState;
      setCount(0);
    }, STONE_PRESS_WINDOW_MS);
  };

  const action = stone ? "return to the original portfolio" : "enter the stone portfolio";
  return (
    <button
      type="button"
      className="identity-object srv-stone-key"
      data-presses={count}
      aria-label={`SRV monogram — press three times to ${action}`}
      aria-describedby={hintId}
      onClick={onClick}
    >
      <span className="identity-orbit orbit-one" aria-hidden="true" />
      <span className="identity-orbit orbit-two" aria-hidden="true" />
      <span className="identity-orbit orbit-three" aria-hidden="true" />
      <strong aria-hidden="true">SRV</strong>
      <span aria-hidden="true">IMAGING / COMPUTATION / ENGINEERING</span>
      <span id={hintId} className="sr-only" aria-live="polite">
        {count > 0 && count < STONE_PRESS_COUNT ? `${count} of ${STONE_PRESS_COUNT} presses` : ""}
      </span>
    </button>
  );
}
