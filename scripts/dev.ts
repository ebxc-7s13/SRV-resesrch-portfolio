import "./env";
import { spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import { runMigrations } from "./migrate-postgres";
import { seedDatabase } from "./seed";

async function main() {
  let database: PGlite | undefined, server: PGLiteSocketServer | undefined;
  if (process.env.LOCAL_DATABASE === "true") {
    const url = new URL(process.env.DATABASE_URL || "");
    if (url.hostname !== "127.0.0.1" || url.port !== "55432")
      throw new Error(
        "LOCAL_DATABASE requires the dedicated loopback port 55432.",
      );
    mkdirSync(".qa", { recursive: true });
    database = await PGlite.create(".qa/development-database");
    server = new PGLiteSocketServer({
      db: database,
      host: "127.0.0.1",
      port: 55432,
      maxConnections: 20,
    });
    await server.start();
    const result = await database.query<{ present: string | null }>(
      "SELECT to_regclass('public.users')::text AS present",
    );
    const initialize = !result.rows[0]?.present;
    await runMigrations();
    if (initialize) await seedDatabase();
    console.log(
      "Local development database is ready; records persist in .qa/development-database.",
    );
  }
  if (!process.env.DATABASE_URL)
    throw new Error(
      "Set DATABASE_URL in .env.local. See README.md for local setup.",
    );
  const child = spawn(
    process.execPath,
    [require.resolve("next/dist/bin/next"), "dev", ...process.argv.slice(2)],
    { stdio: "inherit", env: process.env },
  );
  let closing = false;
  async function stop(code = 0) {
    if (closing) return;
    closing = true;
    child.kill();
    await server?.stop();
    await database?.close();
    process.exit(code);
  }
  process.once("SIGINT", () => void stop());
  process.once("SIGTERM", () => void stop());
  child.once("exit", (code) => void stop(code || 0));
}
main().catch((error) => {
  console.error(
    error instanceof Error ? error.message : "Development startup failed",
  );
  process.exit(1);
});
