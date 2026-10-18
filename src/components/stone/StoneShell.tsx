"use client";
import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { toOriginalPath, toStoneHref } from "@/lib/stone-mode";
import { isHydrated, whenFullyHydrated } from "@/lib/hydration";

const REWRITTEN = "data-stone-href";

/** Point every internal link that has a stone counterpart at it. */
function rewriteLinks(root: ParentNode) {
  root.querySelectorAll<HTMLAnchorElement>("a[href]").forEach((anchor) => {
    if (anchor.hasAttribute("data-stone-exit") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
    // Server markup is still being compared by React until it is hydrated.
    if (!isHydrated(anchor)) return;
    const stone = toStoneHref(anchor.getAttribute("href") ?? "");
    if (stone) {
      anchor.setAttribute(REWRITTEN, anchor.getAttribute("href") ?? "");
      anchor.setAttribute("href", stone);
    }
  });
}

/**
 * Stone Mode chrome, mounted by PortfolioFrame on /stone routes only:
 * keeps navigation inside the stone experience, offers the way back, and
 * settles the entry veil left by the SRV activation.
 */
export default function StoneShell() {
  const router = useRouter();
  const path = usePathname();

  useEffect(() => {
    // DOM hrefs: correct hover status, copy-link and middle-click targets.
    // Idempotent; re-run when React re-renders a link back to its prop value.
    let frame = 0, cancelled = false;
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(() => { frame = 0; rewriteLinks(document); });
    };
    const observer = new MutationObserver(schedule);
    void whenFullyHydrated().then(() => {
      if (cancelled) return;
      rewriteLinks(document);
      observer.observe(document.body, { childList: true, subtree: true, attributes: true, attributeFilter: ["href"] });
    });
    // Next <Link> navigates with its own href prop, so plain left clicks on
    // internal links are routed here first (capture phase, before React).
    const onClick = (event: MouseEvent) => {
      if (event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      const anchor = (event.target as Element | null)?.closest?.("a[href]") as HTMLAnchorElement | null;
      if (!anchor || anchor.hasAttribute("data-stone-exit") || anchor.target === "_blank" || anchor.hasAttribute("download")) return;
      const href = anchor.getAttribute("href") ?? "";
      const original = anchor.getAttribute(REWRITTEN) ?? href;
      const stone = toStoneHref(original);
      const destination = stone ?? (href.startsWith("/stone") ? href : null);
      if (!destination) return;
      // Same-page hash links keep native scrolling.
      if (destination.startsWith(`${window.location.pathname}#`)) return;
      event.preventDefault();
      event.stopPropagation();
      router.push(destination);
    };
    document.addEventListener("click", onClick, true);
    return () => {
      cancelled = true;
      observer.disconnect();
      cancelAnimationFrame(frame);
      document.removeEventListener("click", onClick, true);
    };
  }, [router]);

  useEffect(() => {
    // Finish the carving transition started by the SRV mark, if any.
    const veil = document.getElementById("stone-veil");
    if (!veil) return;
    veil.dataset.state = "settle";
    const done = window.setTimeout(() => veil.remove(), 700);
    return () => { window.clearTimeout(done); veil.remove(); };
  }, []);

  return (
    <a className="stone-return" href={toOriginalPath(path)} data-stone-exit
      aria-label="Return to the original portfolio" title="Return to the original portfolio">
      <svg viewBox="0 0 24 24" aria-hidden="true" focusable="false">
        <path d="M10 6 4 12l6 6M4.5 12H20" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      <span>Original portfolio</span>
    </a>
  );
}
