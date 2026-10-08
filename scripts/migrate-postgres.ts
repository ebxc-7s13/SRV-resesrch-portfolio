import "./env";
import { databaseConfig } from "../src/lib/database-config";
/**
 * PostgreSQL schema migration for the research portfolio.
 *
 * Creates all application tables if they do not exist yet.
 * Safe to run multiple times (uses CREATE TABLE / CREATE INDEX IF NOT EXISTS).
 *
 * Usage:
 *   DATABASE_URL=postgresql://... npx tsx scripts/migrate-postgres.ts
 *
 * The connection string is read from the DATABASE_URL environment variable
 * and is never hard-coded here.
 */
import { Pool } from "pg";

export const SCHEMA_SQL = `
  -- Users table for admin authentication
  CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    email TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    name TEXT NOT NULL DEFAULT 'Admin',
    role TEXT NOT NULL DEFAULT 'admin' CHECK(role IN ('admin', 'editor')),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Research themes / domains
  CREATE TABLE IF NOT EXISTS research_themes (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Research projects (full case-study format)
  CREATE TABLE IF NOT EXISTS projects (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    research_problem TEXT NOT NULL,
    motivation TEXT NOT NULL,
    approach TEXT NOT NULL,
    methodology TEXT,
    experimental_setup TEXT,
    hardware TEXT,
    data_acquisition TEXT,
    computational_method TEXT,
    results TEXT NOT NULL,
    key_contribution TEXT NOT NULL,
    status TEXT DEFAULT 'completed' CHECK(status IN ('completed', 'ongoing', 'under_review', 'filed')),
    featured INTEGER DEFAULT 0,
    sort_order INTEGER DEFAULT 0,
    cover_image TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Publications
  CREATE TABLE IF NOT EXISTS publications (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    authors TEXT NOT NULL,
    journal TEXT NOT NULL,
    year INTEGER NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('published', 'accepted', 'under_review', 'manuscript', 'preprint')),
    doi TEXT,
    abstract TEXT,
    research_area TEXT,
    pdf_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Patents
  CREATE TABLE IF NOT EXISTS patents (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    inventors TEXT NOT NULL,
    applicant TEXT NOT NULL,
    status TEXT NOT NULL CHECK(status IN ('granted', 'filed', 'pending', 'search_report')),
    description TEXT NOT NULL,
    innovation TEXT NOT NULL,
    research_area TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Thesis entries
  CREATE TABLE IF NOT EXISTS theses (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    degree TEXT NOT NULL,
    institution TEXT NOT NULL,
    supervisor TEXT NOT NULL,
    year TEXT NOT NULL,
    research_problem TEXT NOT NULL,
    objective TEXT NOT NULL,
    methodology TEXT NOT NULL,
    key_contributions TEXT NOT NULL,
    results TEXT NOT NULL,
    conclusions TEXT,
    future_work TEXT,
    pdf_url TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Research timeline milestones
  CREATE TABLE IF NOT EXISTS timeline (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    date TEXT NOT NULL,
    category TEXT NOT NULL CHECK(category IN ('education', 'research', 'publication', 'patent', 'project', 'startup', 'award')),
    icon TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Research notes / blog posts
  CREATE TABLE IF NOT EXISTS posts (
    id SERIAL PRIMARY KEY,
    title TEXT NOT NULL,
    slug TEXT UNIQUE NOT NULL,
    content TEXT NOT NULL,
    excerpt TEXT NOT NULL,
    cover_image TEXT,
    published INTEGER DEFAULT 0,
    author_id INTEGER REFERENCES users(id),
    category TEXT DEFAULT 'research_notes',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    published_at TIMESTAMPTZ
  );

  -- Contact form submissions
  CREATE TABLE IF NOT EXISTS messages (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    subject TEXT NOT NULL,
    message TEXT NOT NULL,
    read INTEGER DEFAULT 0,
    ip_address TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Audit log for security tracking
  CREATE TABLE IF NOT EXISTS audit_log (
    id SERIAL PRIMARY KEY,
    user_id INTEGER,
    action TEXT NOT NULL,
    resource TEXT,
    ip_address TEXT,
    user_agent TEXT,
    details TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Rate limit tracking (used by the Postgres-backed limiter in src/lib/rate-limit.ts)
  CREATE TABLE IF NOT EXISTS rate_limits (
    id SERIAL PRIMARY KEY,
    key TEXT NOT NULL,
    count INTEGER DEFAULT 1,
    window_start TIMESTAMPTZ DEFAULT NOW()
  );

  -- Sessions
  CREATE TABLE IF NOT EXISTS sessions (
    id SERIAL PRIMARY KEY,
    user_id INTEGER REFERENCES users(id),
    token_hash TEXT UNIQUE NOT NULL,
    expires_at TIMESTAMPTZ NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    revoked INTEGER DEFAULT 0
  );

  -- Project media (images, videos, figures)
  CREATE TABLE IF NOT EXISTS project_media (
    id SERIAL PRIMARY KEY,
    project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
    file_path TEXT NOT NULL,
    media_type TEXT NOT NULL CHECK(media_type IN ('image', 'video', 'document')),
    caption TEXT,
    caption_title TEXT,
    section TEXT,
    sort_order INTEGER DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- Site content management (editable text)
  CREATE TABLE IF NOT EXISTS site_content (
    id SERIAL PRIMARY KEY,
    page TEXT NOT NULL,
    key TEXT NOT NULL,
    value TEXT NOT NULL DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE(page, key)
  );

  CREATE INDEX IF NOT EXISTS idx_project_media_project ON project_media(project_id);
  CREATE INDEX IF NOT EXISTS idx_posts_slug ON posts(slug);
  CREATE INDEX IF NOT EXISTS idx_posts_published ON posts(published);
  CREATE INDEX IF NOT EXISTS idx_messages_read ON messages(read);
  CREATE INDEX IF NOT EXISTS idx_audit_log_user ON audit_log(user_id);
  CREATE INDEX IF NOT EXISTS idx_audit_log_created ON audit_log(created_at);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
  CREATE INDEX IF NOT EXISTS idx_projects_slug ON projects(slug);
  CREATE INDEX IF NOT EXISTS idx_publications_status ON publications(status);
  CREATE INDEX IF NOT EXISTS idx_timeline_category ON timeline(category);
  CREATE INDEX IF NOT EXISTS idx_site_content_page ON site_content(page);
  -- The limiter UPSERTs on key, so uniqueness must be enforced per key.
  CREATE UNIQUE INDEX IF NOT EXISTS idx_rate_limits_key ON rate_limits(key);
`;

export function getMigrationDatabaseUrl(): string {
  const url = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL environment variable is required but not set",
    );
  }
  return url;
}

export async function runMigrations(databaseUrl?: string): Promise<void> {
  const connectionString = databaseUrl || getMigrationDatabaseUrl();
  const pool = new Pool(databaseConfig(connectionString));
  try {
    const client = await pool.connect();
    try {
      await client.query("BEGIN");
      await client.query("SELECT pg_advisory_xact_lock(7102026)");
      await client.query(SCHEMA_SQL);
      await client.query("COMMIT");
    } catch (error) {
      await client.query("ROLLBACK");
      throw error;
    } finally {
      client.release();
    }
    console.log("[migrate] PostgreSQL schema is up to date.");
  } finally {
    await pool.end();
  }
}

const isMain =
  process.argv[1] &&
  (process.argv[1].endsWith("migrate-postgres.ts") ||
    process.argv[1].endsWith("migrate-postgres.js"));

if (isMain) {
  runMigrations().catch((err) => {
    console.error("[migrate] Migration failed:", err);
    process.exit(1);
  });
}
