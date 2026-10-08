# Phase 24 browser verification: renders pages in real Chromium, checks for
# console errors, horizontal overflow, and captures theme screenshots.
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"
ROUTES = ["/", "/research", "/publications", "/patents", "/thesis",
          "/timeline", "/about", "/contact"]
THEMES = ["night", "day", "blossom"]

errors = []

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    page.on("console", lambda m: errors.append(f"{page.url} :: {m.text[:160]}")
            if m.type == "error" else None)
    page.on("pageerror", lambda e: errors.append(f"{page.url} :: PAGEERROR {e}"))

    for route in ROUTES:
        page.goto(BASE + route, wait_until="networkidle")
        overflow = page.evaluate(
            "document.documentElement.scrollWidth - document.documentElement.clientWidth")
        print(f"{route} :: overflowX={overflow}px")

    for theme in THEMES:
        for route in ["/", "/timeline"]:
            page.goto(BASE + route, wait_until="networkidle")
            page.evaluate(
                """(t) => { document.documentElement.dataset.theme = t;
                            try { localStorage.setItem('theme', t); } catch (e) {} }""",
                theme)
            page.wait_for_timeout(1200)
            name = f"{'home' if route == '/' else 'timeline'}-{theme}.png"
            page.screenshot(path=f"verify/{name}")
            print(f"shot: {name}")

    # Magnetic CTA: hover and read the pull variable + computed transform.
    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(1500)  # let hydration + reveals settle
    cta = page.locator("a[data-magnet]").first
    box = cta.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2,
                    box["y"] + box["height"] / 2, steps=6)
    page.mouse.move(box["x"] + box["width"] * 0.85,
                    box["y"] + box["height"] * 0.8, steps=10)
    page.wait_for_timeout(500)
    print("magnet --magnet-x:",
          cta.evaluate("el => el.style.getPropertyValue('--magnet-x')"))
    print("magnet computed transform:",
          cta.evaluate("el => getComputedStyle(el).transform"))
    print("magnet computed translate:",
          cta.evaluate("el => getComputedStyle(el).translate"))

    # SplitText reveal: DOM restored after animation.
    page.wait_for_timeout(2500)
    print("hero text intact after reveal:",
          page.evaluate(
              "(() => { const el = document.querySelector('.hero-identity h1');"
              " return el ? el.textContent.includes('SILUVERU') : false; })()"))

    # Timeline beam: ScrollTrigger scrub should drive a scaleY transform.
    page.goto(BASE + "/timeline", wait_until="networkidle")
    page.evaluate("window.scrollTo(0, document.body.scrollHeight / 3)")
    page.wait_for_timeout(800)
    print("beam transform after scroll:",
          page.evaluate(
              "(() => { const b = document.querySelector('.chronology-beam');"
              " return b ? getComputedStyle(b).transform : 'missing'; })()"))

    # Mobile viewport: no overflow, screenshot.
    page.set_viewport_size({"width": 390, "height": 844})
    page.goto(BASE + "/", wait_until="networkidle")
    print("mobile overflowX:",
          page.evaluate(
              "document.documentElement.scrollWidth - document.documentElement.clientWidth"),
          "px")
    page.screenshot(path="verify/home-mobile.png")

    print("console errors:", errors[:10] if errors else "none")
    browser.close()
