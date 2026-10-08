// Hydration guards for the client engines that write to React-owned DOM.
//
// The motion engines (OffscreenPause, MotionEngine) write `data-*` attributes
// and CSS custom properties straight onto elements React rendered on the
// server. React verifies each host node's server markup against the client
// props exactly once, while hydrating it, and reports every attribute it did
// not render as a mismatch:
//
//   "A tree hydrated but some attributes of the server rendered HTML didn't
//    match the client properties."
//
// Timers cannot tell us when that check is behind us — an idle callback or a
// short timeout can still fire in the middle of hydrating a streamed Suspense
// boundary. The brand React puts on each host node can: it is written in
// `completeWork`, after the node's markup has already been compared, so a
// branded node can no longer produce that error and an unbranded one is still
// raw server HTML.

const BRAND_PREFIXES = [
  "__reactFiber$",
  "__reactInternalInstance$",
  "__reactContainer$",
];

// Only positive answers are cached. An unbranded node may simply not have been
// hydrated yet, so `false` has to stay open until React proves otherwise.
const branded = new WeakMap<Element, true>();

/**
 * True once React owns `node` — it hydrated it, or created it on the client.
 */
export function isHydrated(node: Element): boolean {
  if (branded.has(node)) return true;
  for (const name of Object.getOwnPropertyNames(node)) {
    for (const prefix of BRAND_PREFIXES) {
      if (name.startsWith(prefix)) {
        branded.set(node, true);
        return true;
      }
    }
  }
  return false;
}

/**
 * Resolves once EVERY element under `root` is hydrated — the reliable signal
 * that React has finished its entire initial hydration.
 *
 * Per-node branding is not enough: React diffs a node during render, brands
 * the whole render batch at commit, and streamed Suspense boundaries can
 * re-diff content in later passes. A node can therefore be branded and STILL
 * be compared again afterwards. Only "every element branded" — the state
 * after the final hydration commit — guarantees no further comparisons.
 *
 * `gracePeriod` bounds the wait: markup React does not own (injected via
 * `dangerouslySetInnerHTML`, third-party widgets) never gets branded, and
 * those nodes are safe to write to regardless because React never compares
 * them. The default is deliberately generous (20s) — throttled CPUs and
 * dev-mode compilation can legitimately stretch hydration well past ten
 * seconds, and giving up early re-opens the mismatch window this helper
 * exists to close.
 */
export function whenFullyHydrated(
  gracePeriod = 20000,
  root: ParentNode = document.body,
): Promise<void> {
  return whenHydrated(root, "*", gracePeriod);
}

/**
 * Resolves once every `root.querySelectorAll(selector)` node is hydrated.
 */
export function whenHydrated(
  root: ParentNode,
  selector: string,
  gracePeriod = 20000,
): Promise<void> {
  return new Promise((resolve) => {
    const deadline = performance.now() + gracePeriod;
    const check = () => {
      let waiting = false;
      for (const node of root.querySelectorAll(selector)) {
        if (!isHydrated(node)) {
          waiting = true;
          break;
        }
      }
      if (!waiting || performance.now() >= deadline) resolve();
      else setTimeout(check, 100);
    };
    check();
  });
}
