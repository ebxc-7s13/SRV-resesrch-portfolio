import "./env";
import { Pool } from "pg";
import { databaseConfig } from "../src/lib/database-config";
import corrections from "./figure-corrections.json";

export async function correctFigures() {
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("SELECT pg_advisory_xact_lock(7102026)");
    let count = 0;
    for (const fix of corrections) {
      const result = await client.query(
        "UPDATE project_media SET caption=$1, section=$2 WHERE file_path=$3 AND caption=$4 AND section=$5",
        [fix.nextCaption, fix.nextSection, fix.file, fix.caption, fix.section],
      );
      count += result.rowCount || 0;
    }
    await client.query("COMMIT");
    console.log(
      "Corrected " +
        count +
        " unchanged legacy figure records. CMS edits were preserved.",
    );
    return count;
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}
if (process.argv[1]?.endsWith("correct-figures.ts"))
  correctFigures().catch(() => {
    console.error("Figure correction failed; transaction rolled back.");
    process.exitCode = 1;
  });
