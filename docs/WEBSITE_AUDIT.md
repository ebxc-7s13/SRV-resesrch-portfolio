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

## Publication verification

The final live URL, GitHub commit and fresh browser smoke-test results are added after deployment. Local evidence and screenshots are retained under ignored `.qa/github-readiness/`.

Local browser results: 28 page/viewport checks passed, including all 6 research and 3 note detail pages. All tested pages returned 200, had substantive content and no horizontal overflow. The homepage was inspected at 1440px and 390px. Protected API and cron requests returned 401; the production development viewer returned 404; robots, sitemap and model files returned 200. No uncaught JavaScript errors were observed. Chromium's one resource error on the anonymous administration page is the expected `/api/auth/me` 401, not an application exception.

Mobile visual observation: the anatomy scene sits behind parts of the hero text and its role ticker clips as it animates. The page does not horizontally overflow and controls remain visible. A separate responsive design refinement could improve this; no broader redesign was included in this publication task.

Local browser results: 28 page/viewport checks passed, including all 6 research and 3 note detail pages. All tested pages returned 200, had substantive content and no horizontal overflow. The homepage was inspected at 1440px and 390px. Protected API and cron requests returned 401; the production development viewer returned 404; robots, sitemap and model files returned 200. No uncaught JavaScript errors were observed. Chromium's one resource error on the anonymous administration page is the expected `/api/auth/me` 401, not an application exception.

Mobile visual observation: the anatomy scene sits behind parts of the hero text and its role ticker clips as it animates. The page does not horizontally overflow and controls remain visible. A separate responsive design refinement could improve this; no broader redesign was included in this publication task.
