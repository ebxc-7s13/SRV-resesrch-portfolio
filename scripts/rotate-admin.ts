import "./env";
import { Pool } from "pg";
import bcrypt from "bcryptjs";
import { databaseConfig } from "../src/lib/database-config";

export async function rotateAdmin(
  email: string,
  password: string,
  newEmail?: string,
) {
  if (!email || password.length < 12 || Buffer.byteLength(password) > 72)
    throw new Error(
      "Provide an existing email and a password of at least 12 characters, at most 72 bytes",
    );
  const pool = new Pool(databaseConfig());
  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const result = await client.query(
      "UPDATE users SET password_hash=$1, email=COALESCE($2,email), updated_at=NOW() WHERE email=$3 AND role='admin' RETURNING id",
      [await bcrypt.hash(password, 12), newEmail || null, email],
    );
    if (result.rowCount !== 1)
      throw new Error("Existing admin not found; no account was created");
    await client.query("UPDATE sessions SET revoked=1 WHERE user_id=$1", [
      result.rows[0].id,
    ]);
    await client.query(
      "INSERT INTO audit_log (user_id, action) VALUES ($1, 'ADMIN_CREDENTIALS_ROTATED')",
      [result.rows[0].id],
    );
    await client.query("COMMIT");
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
    await pool.end();
  }
}

if (/rotate-admin\.[tj]s$/.test(process.argv[1] || "")) {
  rotateAdmin(
    process.env.ROTATE_ADMIN_EMAIL || "",
    process.env.ROTATE_ADMIN_PASSWORD || "",
    process.env.ROTATE_ADMIN_NEW_EMAIL,
  )
    .then(() =>
      console.log("Admin credentials updated; previous sessions revoked."),
    )
    .catch(() => {
      console.error(
        "Rotation failed. Check the existing admin email, password requirements and database configuration.",
      );
      process.exitCode = 1;
    });
}
