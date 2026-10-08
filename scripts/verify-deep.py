# Deep diagnostics: hydration warning source, word reveal, nav condensation,
# card glare, patent sweep, publication scan, skills stagger, timeline beams.
from playwright.sync_api import sync_playwright

BASE = "http://localhost:3000"

with sync_playwright() as p:
    browser = p.chromium.launch()
    page = browser.new_page(viewport={"width": 1440, "height": 900})
    warnings = []

    def on_console(m):
        if m.type == "error" and "hydrat" in m.text.lower():
            warnings.append(m.text[:3000])

    page.on("console", on_console)

    # 1. Full hydration warning text on home.
    page.goto(BASE + "/", wait_until="networkidle")
    page.wait_for_timeout(2000)
    print("=== HYDRATION WARNING (home) ===")
    print(warnings[0] if warnings else "none")

    # Does it also happen on a route that uses none of my components?
    warnings.clear()
    page.goto(BASE + "/search", wait_until="networkidle")
    page.wait_for_timeout(1500)
    print("=== HYDRATION WARNING (/search, untouched route) ===")
    print(warnings[0][:1200] if warnings else "none")

    # 2. Word reveal: opacity mid-animation and settled.
    page.goto(BASE + "/", wait_until="networkidle")
    time.sleep if False else None
    page.wait_for_timeout(350)
    mid = page.evaluate(
        "(() => { const w = document.querySelector('.reveal-word');"
        " return w ? getComputedStyle(w).opacity : 'none'; })()")
    page.wait_for_timeout(3000)
    settled = page.evaluate(
        "(() => { const w = document.querySelector('.reveal-word');"
        " return w ? getComputedStyle(w).opacity : 'none'; })()")
    word_count = page.evaluate("document.querySelectorAll('.reveal-word').length")
    print(f"reveal-word count={word_count} mid-opacity={mid} settled-opacity={settled}")

    # 3. Navigation condensation.
    h_top = page.evaluate(
        "(() => { const b = document.querySelector('.navigation-bar.shell');"
        " return b.getBoundingClientRect().height; })()")
    page.evaluate("window.scrollTo(0, 500)")
    page.wait_for_timeout(600)
    scrolled_attr = page.evaluate(
        "(() => document.querySelector('.site-navigation').hasAttribute('data-scrolled'))()")
    h_scrolled = page.evaluate(
        "(() => { const b = document.querySelector('.navigation-bar.shell');"
        " return b.getBoundingClientRect().height; })()")
    print(f"nav height top={h_top} scrolled={h_scrolled} data-scrolled={scrolled_attr}")

    # 4. Research card glare (CSS ::after opacity on hover).
    page.goto(BASE + "/research", wait_until="networkidle")
    page.wait_for_timeout(1200)
    card = page.locator(".research-card-link").first
    card.scroll_into_view_if_needed()
    page.wait_for_timeout(600)
    box = card.bounding_box()
    page.mouse.move(box["x"] + box["width"] / 2, box["y"] + box["height"] / 2, steps=6)
    page.wait_for_timeout(500)
    glare = card.evaluate(
        "el => getComputedStyle(el, '::after') ? getComputedStyle(el.querySelector('.research-card-media') || el, '::after').opacity : 'n/a'")
    glare = page.evaluate(
        "(() => { const m = document.querySelector('.research-card-media');"
        " return m ? getComputedStyle(m, '::after').opacity : 'no-media'; })()")
    print(f"research media glare opacity on hover: {glare}")

    # 5. Patent sweep animation (needs data-motion-running=true).
    page.goto(BASE + "/patents", wait_until="networkidle")
    page.wait_for_timeout(1200)
    motion_running = page.evaluate(
        "document.documentElement.dataset.motionRunning")
    patent_anim = page.evaluate(
        "(() => { const c = document.querySelector('.card-patent');"
        " return c ? getComputedStyle(c, '::before').animationName : 'no-card'; })()")
    print(f"patent ::before animation: {patent_anim} (motionRunning={motion_running})")

    # 6. Publication title scan.
    page.goto(BASE + "/publications", wait_until="networkidle")
    page.wait_for_timeout(1200)
    rec = page.locator(".publication-record").first
    if rec.count():
        rec.scroll_into_view_if_needed()
        page.wait_for_timeout(400)
        box = rec.bounding_box()
        page.mouse.move(box["x"] + box["width"] / 2, box["y"] + 40, steps=4)
        page.wait_for_timeout(700)
        pos = rec.evaluate(
            "el => { const h = el.querySelector('.document-body h3');"
            " return h ? getComputedStyle(h).backgroundPosition : 'no-h3'; }")
        print(f"publication h3 background-position on hover: {pos}")
    else:
        print("no publication records in db")

    # 7. Skills stagger.
    page.goto(BASE + "/about", wait_until="networkidle")
    page.wait_for_timeout(1200)
    delays = page.evaluate(
        "Array.from(document.querySelectorAll('.capability-map .depth-card li'))"
        ".slice(0, 4).map(li => getComputedStyle(li).animationDelay)")
    print(f"capability li animation delays: {delays}")

    # 8. Timeline beams at multiple scroll depths.
    page.goto(BASE + "/timeline", wait_until="networkidle")
    page.wait_for_timeout(2000)
    for frac, label in [(0, "top"), (0.33, "third"), (0.66, "two-thirds"), (0.95, "bottom")]:
        page.evaluate(
            "f => window.scrollTo({ top: (document.body.scrollHeight - innerHeight) * f, behavior: 'instant' })",
            frac)
        page.wait_for_timeout(1400)
        beams = page.evaluate(
            "(() => { const b = document.querySelectorAll('.chronology-beam');"
            " if (!b.length) return 'none';"
            " const f = getComputedStyle(b[0]).transform;"
            " const l = getComputedStyle(b[b.length - 1]).transform;"
            " return `first=${f} last=${l}`; })()")
        print(f"beams @{label}: {beams}")

    browser.close()
