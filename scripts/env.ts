import { loadEnvConfig } from "@next/env";

// loadEnvConfig picks the env-file set from its second argument, not from
// NODE_ENV: without it, scripts default to the production set and would never
// see .env.development.local (the development database URL). "next dev" passes
// dev=true, so mirror that here; scripts running under a production
// environment (e.g. migrations during a Render build) load .env.production*
// and read DATABASE_URL from the hosting environment instead.
loadEnvConfig(process.cwd(), process.env.NODE_ENV !== "production");
