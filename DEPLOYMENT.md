# Vercel + Neon deployment

This Next.js application runs on Vercel; its database runs on Neon through the existing `pg` driver. The production database must be separate from the disposable local PGlite database.

Current live origin: https://srv-resesrch-portfolio.vercel.app. The Vercel project `ebxc/srv-resesrch-portfolio` is connected to `ebxc-7s13/SRV-resesrch-portfolio`, with `main` as its production branch, and uses the existing Neon project.

## Automatic website updates

Commit changes to `main` on GitHub, or push local commits with `git push origin main`. Vercel automatically builds the new commit and updates the same production URL after a successful deployment. Changes on other branches produce preview deployments; merge them into `main` to publish them. Local edits must be committed and pushed before they can appear online.

The production URL stays the same and can be shared with visitors. Deployments take a few minutes; if a build fails, inspect the Vercel deployment logs and fix the failed commit. GitHub Actions separately runs lint, type checks, regression tests and a production build on pushes. Database schema changes require the explicit migration procedure below; normal deployments do not reseed Neon.

## Hosting configuration

Import the public GitHub repository into Vercel, select Next.js and Node.js 22, and use `npm ci`, `npm run build`, and the default Next.js output directory. GitHub Pages cannot run this application’s database-backed server routes.

Set these Vercel **Production** variables before deploying:

| Variable | Value |
| --- | --- |
| `DATABASE_URL` | Existing pooled Neon PostgreSQL URL with TLS |
| `DATABASE_URL_UNPOOLED` | Direct Neon URL for explicit migration commands |
| `JWT_SECRET` | Independent random secret, at least 32 characters |
| `CRON_SECRET` | Independent random secret for the cleanup scheduler |
| `NEXT_PUBLIC_SITE_URL` | The actual public HTTPS origin, without a trailing slash |
| `TRUSTED_PROXY_HOPS` | Trusted proxy count verified for the deployed ingress |

All database URLs and secrets are server-only variables. Do not prefix them with `NEXT_PUBLIC_`. Do not share production credentials with forks or commit `.env` files. Remote database TLS certificates are verified. `neon.ts` preserves the existing Neon policy; linking a repository to Vercel does not create another Neon database.

Vercel sets `x-forwarded-for` for incoming requests. Verify the deployed forwarding behavior before setting `TRUSTED_PROXY_HOPS=1`; the rate limiter selects the configured address from the right of the chain. Login and contact fail closed if the configured client IP is unavailable. Confirm independent clients do not share one budget. See the [Vercel request header documentation](https://vercel.com/docs/headers/request-headers).

## Database initialization

For a new empty Neon database, supply its URLs in an isolated production environment and run:

```sh
npm run db:migrate
npm run db:seed
```

Initial seeding additionally requires `ADMIN_EMAIL` and `ADMIN_PASSWORD`; keep those credentials private. Seed only for explicit initialization and missing-record recovery. Migrations use `DATABASE_URL_UNPOOLED` when supplied. Do not run these commands with local development environment variables still active, and do not seed on every deployment. The current existing Neon database must be inspected before any initialization.

To rotate an existing administrator, use the explicit `ROTATE_ADMIN_*` variables and `npm run db:rotate-admin`. Merely changing `ADMIN_PASSWORD` does not change an existing account.

## Scheduled cleanup

`vercel.json` schedules `/api/cron/cleanup` daily. Configure `CRON_SECRET`; the handler requires `Authorization: Bearer <CRON_SECRET>` and rejects an administrator cookie alone.

## Release verification

Run lint, type checking, the isolated regression suite and a production build. Verify the live homepage, all public route families, dynamic research/blog records, sitemap, research media and 3D model loading. Verify unauthenticated `/api/admin/*` and cleanup calls are rejected. Confirm the production `/lab/models` development viewer returns 404. Check the live website on desktop and mobile and inspect console errors.

Render is an alternative app host described by `render.yaml`. It is not used for the Vercel deployment. The blueprint runs additive migrations during its build; review backups and initialize explicitly before using it.
