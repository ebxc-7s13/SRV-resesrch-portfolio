# Mobile layout and Liquid audit — 2026-10-08

Scope: the requested mobile anatomy removal, navigation contrast, footer spacing, and shared Liquid defaults. Earlier requested hero controls and production lab model fixes are included in the same release. Other routes, CMS behavior, and desktop layout are outside the current repair scope.

## Repair plan

1. Use the existing 900px compact-layout breakpoint to omit the complete anatomy section and defer its component download until desktop. Keep the original desktop section markup and positioning.
2. Limit menu and footer styling to that breakpoint. Increase the menu tint to prevent underlying text competing with labels; remove obsolete footer bottom clearance and shrink its brand spacing while retaining 44px link targets and safe-area clearance.
3. Set Liquid depth to 1, metalness to 0, and roughness to 0. Apply defaults before an explicit Liquid selection, including when previous tuning exists or storage is unavailable. Keep sliders usable after activation.
4. Check production rendering, responsive boundaries, previously repaired lab models, security regressions, and build checks before committing and pushing.

## Confirmed observations

- At 320, 390, 768, and 900px, the mobile anatomy section and renderer are absent, with no `/models/anatomy/` requests. At 901px the viewer renders, unmounts when resized to mobile, and renders again on return to desktop.
- At 390px, hero identity, summary, and header bounds match the previous layout. Removing anatomy brings the laboratory forward by 668.75px without changing its height.
- The 390px footer decreases from 577px to approximately 388px. Empty 80px bottom padding is removed, and every footer link has a 44px target. The logo and all navigation/legal links remain present.
- The 1440px hero, anatomy, header, laboratory positioning, and footer measurements match the previous desktop layout exactly. Desktop footer height remains 247px. Rendered screenshots were inspected.
- The shared tuning source supplies depth 1 / metalness 0 / roughness 0 to the renderer. Functional tests cover initial defaults, resets, saved tuning replacement before activation, and unavailable storage. Brightness remains 1.85, with rain disabled by default.
- The final supervised production browser audit passes with no console errors or uncaught exceptions. Liquid selection and reselection apply the requested values on mobile and desktop. Both supplied laboratory models render on Home, on the standalone lab route, after client navigation from About, and during mobile touch inspection; low, medium, and high model tiers load correctly.
- All 33 regression tests, lint, standalone type checking, and the production build pass. Security regressions include administrator authorization, session expiry/revocation, credential rotation, SQL-backed rate limiting, and database TLS policy.
- The laboratory decoder fix grants WebAssembly compilation in the starting document's production CSP, including client navigation into Home. JavaScript `unsafe-eval` and external script sources remain blocked.

## Limits and remaining work

The current npm production advisory scan reports two underlying Tailwind build-tool advisories, affecting seven dependency-chain entries (five high, two moderate). They concern `braces` pattern recursion and `postcss-selector-parser` complexity. These tools process repository-controlled build input; no public form-to-build-input path was established. npm proposes a major Tailwind upgrade. That migration remains outside this scoped layout repair; this audit does not claim a clean dependency scan or an independent penetration test.

The earlier broader static review also identified rate-limit reset-time inconsistencies and unsupported legacy CMS keys being serialized publicly. Neither was established as an exploitable security vulnerability, and neither is changed in this mobile-focused release. They remain separate reliability/privacy-hardening follow-ups.

Graphify and the requested specialist skills were unavailable in this checkout. Focused source review, functional tests, production compilation, and Chromium screenshots were used. Browser QA runs against an isolated, seeded loopback database; it does not reseed production data or certify the hosted deployment.
