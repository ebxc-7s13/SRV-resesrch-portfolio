# SRV research portfolio

Raja Viveka Vardhan Siluveru's research portfolio. Built with Next.js 15, React 19, TypeScript, Tailwind CSS and PostgreSQL, with interactive anatomy and laboratory scenes.

**Live website:** [srv-resesrch-portfolio.vercel.app](https://srv-resesrch-portfolio.vercel.app)

**Public source:** [ebxc-7s13/SRV-resesrch-portfolio](https://github.com/ebxc-7s13/SRV-resesrch-portfolio)

Production uses **Vercel for the website** and **Neon for PostgreSQL**. Neon does not host the frontend. Database credentials and administrator secrets are never included in the public repository.

## Run a fork locally

Install Node.js 22, clone or fork this repository, then run:

```sh
npm ci
npm run setup:local
npm run dev
```

Open http://localhost:3000. The setup command generates random local credentials in ignored environment files and refuses to overwrite existing files. Administrator credentials are in `.env.local`; open `/admin` to sign in. These are local evaluation credentials, separate from the published website.

The development server starts an isolated PostgreSQL-compatible PGlite database on loopback port 55432, migrates it, and seeds it on first initialization. Records persist in `.qa/development-database`. Run only one development database process at a time.

For manual setup, copy `.env.example` to `.env.local` and `.env.development.example` to `.env.development.local`. Generate a random `JWT_SECRET` of at least 32 characters, supply your own `CRON_SECRET`, `ADMIN_EMAIL` and a strong `ADMIN_PASSWORD` (12–72 UTF-8 bytes). Do not use production credentials for a fork.

## Verify

```sh
npm run lint
npm run typecheck
npm test
npm run build
```

The regression suite uses a disposable database on port 55434 and does not access Neon. `npm run build` creates a production build; production requires its own database and secrets. `npm start` never loads `.env.development.local` and does not start the local database.

## Publish

See [DEPLOYMENT.md](DEPLOYMENT.md) for Vercel + Neon configuration, initialization and verification. The public upload intentionally excludes local environments, private documents, source archives, databases, screenshots, installed agent skills and generated graphs. Runtime research images, videos, models, provenance and third-party notices remain included.

## Ownership and evaluation

Copyright Raja Viveka Vardhan Siluveru. No open-source license is provided for the original website code and content. You may view, fork and run this portfolio locally for personal evaluation. Republishing it as your own website, commercial reuse or redistribution of the original code and content requires permission.

Third-party dependencies and assets retain their own terms. In particular, the anatomy derivatives, preview and associated processing scripts retain CC BY-SA 4.0 terms and attribution; the mesh decoder retains its existing notice. See [anatomy attribution](public/models/anatomy/ATTRIBUTION.md) and [asset provenance](docs/z-anatomy-license-audit.md). These third-party terms do not apply a blanket software license to the website.

See [website audit](docs/WEBSITE_AUDIT.md) for verified release checks and remaining limitations. Research source discrepancies remain recorded in [CONTENT_CONFIRMATION.md](CONTENT_CONFIRMATION.md).
