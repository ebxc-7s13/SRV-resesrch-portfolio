import { Pool, type PoolClient } from "pg";
import { databaseConfig } from "./database-config";

// PostgreSQL connection for Neon or another PostgreSQL provider.
// The connection string is read from DATABASE_URL and is never hard-coded.
// A single pool is shared across invocations of the same serverless instance.

declare global {
  // eslint-disable-next-line no-var
  var __portfolioPgPool: Pool | undefined;
}

function getPool(): Pool {
  if (!globalThis.__portfolioPgPool) {
    globalThis.__portfolioPgPool = new Pool(databaseConfig());
    globalThis.__portfolioPgPool.on("error", (err) => {
      console.error("[db] Unexpected pool error:", err);
    });
  }
  return globalThis.__portfolioPgPool;
}

export interface RunResult {
  lastInsertRowid: number;
  changes: number;
}

// Minimal async query wrapper. Placeholders use PostgreSQL $1, $2, ... style.
class PgDb {
  async transaction<T>(action: (client: PoolClient) => Promise<T>): Promise<T> {
    const client = await getPool().connect();
    try {
      await client.query("BEGIN");
      const result = await action(client);
      await client.query("COMMIT");
      return result;
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
  }
  async query(text: string, params: unknown[] = []) {
    return getPool().query(text, params);
  }

  async all<T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<T[]> {
    const result = await getPool().query(text, params);
    return result.rows as T[];
  }

  async get<T = Record<string, unknown>>(
    text: string,
    params: unknown[] = [],
  ): Promise<T | undefined> {
    const result = await getPool().query(text, params);
    return result.rows[0] as T | undefined;
  }

  async run(text: string, params: unknown[] = []): Promise<RunResult> {
    const isInsert = /^\s*insert\b/i.test(text);
    const hasReturning = /returning\b/i.test(text);
    const sql = isInsert && !hasReturning ? `${text} RETURNING id` : text;
    const result = await getPool().query(sql, params);
    const lastInsertRowid =
      isInsert && result.rows[0] ? Number(result.rows[0].id) : 0;
    return { lastInsertRowid, changes: result.rowCount ?? 0 };
  }
}

let _db: PgDb | null = null;

export function getDb(): PgDb {
  if (!_db) {
    _db = new PgDb();
  }
  return _db;
}
