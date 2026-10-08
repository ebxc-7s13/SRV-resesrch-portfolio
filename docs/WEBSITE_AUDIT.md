# Website and publication audit — 2026-10-08

Scope: current application routes, API security boundaries, dependency lockfile, production build, public assets, Git upload contents, local setup, Neon connectivity and Vercel publication. This is a release audit, not a penetration test or independent validation of research claims.

## Confirmed checks

- Next.js updated to 15.5.27; its reported cache-poisoning advisories are resolved.
- Sharp updated to 0.35.5; the reported image-processing advisory is resolved.
- Existing 19 database/security/background regression tests pass using an isolated database. Coverage includes every admin handler rejecting absent, downgraded and revoked credentials, TLS policy, contact validation, atomic rate limiting, seed transactions and credential rotation.
- Production compilation and type validation pass. Source lint and standalone type checks are rechecked before upload.
- Production configuration already points to pooled Neon PostgreSQL. A read-only query verified certificate-validated TLS and all required tables. Existing public records: 6 projects, 2 publications, 3 notes, 2 theses, 2 patents, 15 milestones and 52 media records. No database reset or reseed was performed.
- Original code has no open-source license declaration. Existing third-party anatomy and decoder notices are retained.
- `.gitignore` excludes secrets, databases, private documents, local tooling, source archives and QA output. Previously staged ignored files are removed from the index while retained on disk. Public PDFs and all runtime assets remain eligible for upload.
- No credential candidates were found by the targeted token/private-key/database-URL pattern scan of website source, scripts, tests, docs and public text assets. This pattern scan is not a guarantee that every possible secret format is absent.
- The local setup command creates random local secrets and refuses to overwrite existing environment files. Forks use their own loopback database; production credentials are not published.

## Remaining findings

The npm advisory scan still reports two underlying build-tool issues, with dependency-chain counts of 7 high and 2 moderate across the full install. `braces` affects Tailwind/glob/watch tooling; `postcss-selector-parser` affects CSS processing. Public form inputs do not feed these tools: this application's production server uses prebuilt CSS. Fixing the full chains through the package manager currently proposes a breaking Tailwind 4 migration and an incompatible ESLint/Next downgrade. Those migrations are deferred rather than forced during publication. Review again by 2026-10-22; do not build untrusted submitted styles, glob patterns or source trees in this deployment.

The existing Neon database contains no administrator user. Public pages can run without one. To manage the CMS, explicitly bootstrap a private administrator using the documented seed procedure against the intended database. No credentials are embedded in the upload and the public seed endpoint remains disabled.

The contact policy should be reviewed by the owner: the form stores names, addresses, subjects, messages and client IPs; message retention/deletion is an operational decision. The audit does not assert legal compliance. Research discrepancies remain documented in `CONTENT_CONFIRMATION.md`.

Manual screen-reader testing and independently sourced multi-client proxy tests are not covered by the automated route smoke checks. Third-party asset terms remain separate from ownership of the original website.

The installed `r3f-qa-release` skill is a stub with no authored release runbook. This audit reports observed model loading, rendered screenshots and browser errors; it does not assert formal 3D release certification from that skill.

## Publication verification

- Live website: https://srv-resesrch-portfolio.vercel.app — anonymously accessible over HTTPS, with no Vercel login needed on the production domain.
- Public source: https://github.com/ebxc-7s13/SRV-resesrch-portfolio, default branch `main`, no root software license detected by GitHub.
- Deployed source commit: `bd270f7fd110e0394610b4d7a2edbee621e57ad5`; deployment `dpl_68Zsc6EPb55dABf9QAhTYxWhJE8G`, Vercel status READY. Vercel's Linux build, lint/type validation and Next.js compilation passed on Node 22.
- GitHub Actions lint, type checks, 19 regression tests and production build passed for the initial source and hosting-exclusion commits.
- Anonymous live browser checks: 28 page/viewport checks passed with substantive content and no horizontal overflow, including all public route families and all research/note detail pages. Protected admin/cron calls returned 401; the development viewer returned 404. Robots, sitemap and anatomy model files returned 200. An invalid contact body returned 400, confirming production proxy identification, rate-limit storage and validation are available without creating a message. No uncaught JavaScript exceptions were observed. The admin page's expected `/api/auth/me` 401 is classified separately from unexpected console errors.
- A fresh clone of the public GitHub source successfully ran `npm ci`, `npm run setup:local` and `npm run dev`, using its own local database and generated credentials.
- The initial publication used the authenticated CLI. The Vercel GitHub App now has access to the new repository, and `ebxc/srv-resesrch-portfolio` is connected to GitHub repository ID `1409699982`, with `main` as its production branch. Pushes to `main` trigger production deployments to the existing public URL; other branches use preview deployments.

Local evidence and screenshots are retained under ignored `.qa/github-readiness/`. Later documentation-only commits do not change the deployed application code.

Local browser results: 28 page/viewport checks passed, including all 6 research and 3 note detail pages. All tested pages returned 200, had substantive content and no horizontal overflow. The homepage was inspected at 1440px and 390px. Protected API and cron requests returned 401; the production development viewer returned 404; robots, sitemap and model files returned 200. No uncaught JavaScript errors were observed. Chromium's one resource error on the anonymous administration page is the expected `/api/auth/me` 401, not an application exception.

Mobile visual observation: the anatomy scene sits behind parts of the hero text and its role ticker clips as it animates. The page does not horizontally overflow and controls remain visible. A separate responsive design refinement could improve this; no broader redesign was included in this publication task.

Local browser results: 28 page/viewport checks passed, including all 6 research and 3 note detail pages. All tested pages returned 200, had substantive content and no horizontal overflow. The homepage was inspected at 1440px and 390px. Protected API and cron requests returned 401; the production development viewer returned 404; robots, sitemap and model files returned 200. No uncaught JavaScript errors were observed. Chromium's one resource error on the anonymous administration page is the expected `/api/auth/me` 401, not an application exception.

Mobile visual observation: the anatomy scene sits behind parts of the hero text and its role ticker clips as it animates. The page does not horizontally overflow and controls remain visible. A separate responsive design refinement could improve this; no broader redesign was included in this publication task.
