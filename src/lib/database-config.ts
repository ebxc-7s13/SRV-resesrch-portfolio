import type { PoolConfig } from "pg";

/**
 * Dedicated loopback port of the local PGlite development database, served by
 * scripts/dev.ts (LOCAL_DATABASE=true) and scripts/qa-database.ts only. The
 * development URL lives in .env.development.local, which Next.js never loads
 * in production; this guard keeps a misconfigured production runtime from
 * silently targeting it and failing with a confusing ECONNREFUSED.
 */
const DEVELOPMENT_DB_PORT = "55432";

/** One TLS policy for the application, migration and maintenance commands. */
export function databaseConfig(
  connectionString = process.env.DATABASE_URL,
): PoolConfig {
  if (!connectionString) throw new Error("DATABASE_URL is required");
  const url = new URL(connectionString);
  if (!["postgres:", "postgresql:"].includes(url.protocol))
    throw new Error("DATABASE_URL must be PostgreSQL");
  const local = ["localhost", "127.0.0.1", "[::1]"].includes(url.hostname);
  if (
    process.env.NODE_ENV === "production" &&
    local &&
    url.port === DEVELOPMENT_DB_PORT
  )
    throw new Error(
      "Production must not connect to the local development database on port 55432. " +
        "Supply the production DATABASE_URL (e.g. a pooled Neon URL) through " +
        "the hosting environment; the development URL exists only in .env.development.local.",
    );
  const mode = url.searchParams.get("sslmode");
  if (mode === "disable" && !local)
    throw new Error(
      "Unencrypted remote database connections are not supported",
    );
  // pg connection-string SSL options otherwise override the verified SSL object.
  for (const key of ["sslmode", "ssl", "sslcert", "sslkey", "sslrootcert"])
    url.searchParams.delete(key);
  return {
    connectionString: url.toString(),
    ssl:
      local && mode === "disable"
        ? false
        : {
            rejectUnauthorized: true,
            ...(process.env.DATABASE_CA_CERT
              ? { ca: process.env.DATABASE_CA_CERT.replace(/\\n/g, "\n") }
              : {}),
          },
    max: 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
  };
}
