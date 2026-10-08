import { PGlite } from "@electric-sql/pglite";
import { PGLiteSocketServer } from "@electric-sql/pglite-socket";
import {mkdirSync} from "node:fs";
async function main() {
  const persistent = process.argv.includes("--development-data");
  if(persistent)mkdirSync(".qa",{recursive:true});
  const db = await PGlite.create(persistent ? ".qa/development-database" : undefined);
  const server = new PGLiteSocketServer({
    db,
    host: "127.0.0.1",
    port: 55432,
    maxConnections: 20,
  });
  await server.start();
  console.log(`${persistent ? "Persistent local development" : "Disposable in-memory QA"} database listening on 127.0.0.1:55432`);
  const stop = async () => {
    await server.stop();
    await db.close();
    process.exit(0);
  };
  process.on("SIGINT", stop);
  process.on("SIGTERM", stop);
}
main().catch(() => {
  console.error("QA database failed to start");
  process.exitCode = 1;
});
