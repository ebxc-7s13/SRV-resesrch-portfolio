// Press-sequence detector for the About-page SRV mark: N activations, each
// within `windowMs` of the previous one, complete the sequence. Pure and
// time-injected so it is unit-testable; the component owns the timer.

export const STONE_PRESS_COUNT = 3;
export const STONE_PRESS_WINDOW_MS = 1400;
/** Ignore a second event this soon after the last (double-dispatched input). */
export const STONE_PRESS_DEBOUNCE_MS = 60;

export type PressState = { count: number; last: number };
export type PressResult = PressState & { complete: boolean; accepted: boolean };

export const initialPressState: PressState = { count: 0, last: -Infinity };

export function registerPress(
  state: PressState,
  now: number,
  required = STONE_PRESS_COUNT,
  windowMs = STONE_PRESS_WINDOW_MS,
): PressResult {
  const gap = now - state.last;
  if (gap >= 0 && gap < STONE_PRESS_DEBOUNCE_MS) return { ...state, complete: false, accepted: false };
  const count = gap <= windowMs ? state.count + 1 : 1;
  if (count >= required) return { count: 0, last: -Infinity, complete: true, accepted: true };
  return { count, last: now, complete: false, accepted: true };
}
