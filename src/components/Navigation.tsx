"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useEffect, useRef } from "react";
import { motion, AnimatePresence } from "motion/react";
import CellsControl from "./CellsControl";
import NavIcon from "./NavIcons";
const navItems = [
  { href: "/", label: "HOME", icon: "home" },
  { href: "/research", label: "RESEARCH", icon: "science" },
  { href: "/publications", label: "PAPERS", icon: "article" },
  { href: "/thesis", label: "THESES", icon: "school" },
  { href: "/patents", label: "PATENTS", icon: "verified" },
  { href: "/timeline", label: "TIMELINE", icon: "timeline" },
  { href: "/blog", label: "NOTES", icon: "edit_note" },
  { href: "/about", label: "ABOUT", icon: "person" },
  { href: "/contact", label: "CONTACT", icon: "mail" },
  { href: "/search", label: "SEARCH", icon: "search" },
];
export default function Navigation() {
  const pathname = usePathname();
  const router = useRouter();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [pending, setPending] = useState("");
  const [scrolled, setScrolled] = useState(false);
  const menuButton = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    setMobileOpen(false);
    setPending("");
  }, [pathname]);
  // Condense the bar once the page scrolls; the CSS transition does the rest.
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > 8);
    update();
    window.addEventListener("scroll", update, { passive: true });
    return () => window.removeEventListener("scroll", update);
  }, []);
  useEffect(() => {
    if (!pending) return;
    const timer = setTimeout(() => setPending(""), 8000);
    return () => clearTimeout(timer);
  }, [pending]);
  useEffect(() => {
    if (!mobileOpen) return;
    menu.current
      ?.querySelector<HTMLAnchorElement>('a[aria-current="page"],a')
      ?.focus();
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [mobileOpen]);
  function close() {
    setMobileOpen(false);
    menuButton.current?.focus();
  }
  function links(mobile = false) {
    return navItems.map((item, index) => {
      // Dynamic routes only prefetch their loading shell by default. Warm the
      // intended destination before the click, without fetching every page.
      const prefetch = () => {
        if (pathname !== item.href) router.prefetch(item.href);
      };
      const active =
        pathname === item.href ||
        (item.href !== "/" && pathname.startsWith(item.href + "/"));
      // Desktop destinations render as large Material Symbol icons with
      // the name popping up below on hover/focus; the mobile panel keeps
      // the numbered text rows.
      // All main-nav destinations use client navigation; the laboratory
      // lives inside Home (/#lab) so no full-document nav item remains.
      const Item = Link;
      if (!mobile) {
        return (
          <Item
            key={item.href}
            href={item.href}
            onPointerEnter={prefetch}
            onFocus={prefetch}
            onTouchStart={prefetch}
            aria-current={active ? "page" : undefined}
            aria-label={item.label}
            data-pointer
            className={`nav-item nav-icon-item ${active ? "is-active" : ""}`}
            onClick={() => {
              if (pathname !== item.href) setPending(item.label);
              setMobileOpen(false);
            }}
          >
            <NavIcon name={item.icon} />
            <span className="nav-tip" aria-hidden="true">
              {item.label}
            </span>
          </Item>
        );
      }
      return (
        <Item
          key={item.href}
          href={item.href}
          onPointerEnter={prefetch}
          onFocus={prefetch}
          onTouchStart={prefetch}
          aria-current={active ? "page" : undefined}
          data-pointer
          className={`nav-item ${active ? "is-active" : ""}`}
          onClick={() => {
            if (pathname !== item.href) setPending(item.label);
            setMobileOpen(false);
          }}
        >
          {mobile && (
            <span className="nav-index" aria-hidden="true">
              {String(index).padStart(2, "0")}
            </span>
          )}
          <span className="nav-label">{item.label}</span>
          {mobile && <span aria-hidden="true">↗</span>}
        </Item>
      );
    });
  }
  return (
    <nav
      aria-label="Main navigation"
      className="site-navigation"
      data-scrolled={scrolled ? "true" : undefined}
      onBlur={(e) => {
        if (mobileOpen && !e.currentTarget.contains(e.relatedTarget as Node))
          setMobileOpen(false);
      }}
      onKeyDown={(e) => {
        if (e.key === "Escape" && mobileOpen) {
          e.preventDefault();
          close();
        }
      }}
    >
      <div className="navigation-bar shell">
        <div className="desktop-navigation">{links()}</div>
        <CellsControl />
        <button
          ref={menuButton}
          data-pointer
          className="mobile-menu-toggle"
          aria-label={mobileOpen ? "Close navigation" : "Open navigation"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-navigation"
          onClick={() => setMobileOpen(!mobileOpen)}
        >
          <span>{mobileOpen ? "Close" : "Menu"}</span>
          <span aria-hidden="true">{mobileOpen ? "×" : "☰"}</span>
        </button>
      </div>
      {pending && (
        <div className="navigation-pending" role="status">
          Opening {pending.toLowerCase()}…
        </div>
      )}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.button
              className="nav-backdrop"
              aria-label="Dismiss navigation"
              tabIndex={-1}
              onClick={close}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            />
            <motion.div
              ref={menu}
              id="mobile-navigation"
              className="mobile-navigation-panel"
              initial={{ opacity: 0, transform: "translateY(-8px)" }}
              animate={{ opacity: 1, transform: "translateY(0px)" }}
              exit={{ opacity: 0, transform: "translateY(-8px)" }}
              transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
            onKeyDown={(e) => {
              if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(e.key))
                return;
              const items = Array.from(
                menu.current?.querySelectorAll<HTMLAnchorElement>("a") || [],
              );
              const current = items.indexOf(
                document.activeElement as HTMLAnchorElement,
              );
              e.preventDefault();
              const next =
                e.key === "Home"
                  ? 0
                  : e.key === "End"
                    ? items.length - 1
                    : (current +
                        (e.key === "ArrowDown" ? 1 : -1) +
                        items.length) %
                      items.length;
              items[next]?.focus();
            }}
          >
            <p className="eyebrow">Explore the research</p>
            {links(true)}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </nav>
  );
}
