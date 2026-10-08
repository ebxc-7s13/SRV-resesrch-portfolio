import { existsSync, writeFileSync } from "node:fs";
import { randomBytes } from "node:crypto";

const files = [".env.local", ".env.development.local"];
if (files.some((file) => existsSync(file))) {
  console.error("Local environment files already exist. Nothing was changed. See README.md for manual setup.");
  process.exit(1);
}

writeFileSync(files[0], [
  "# Generated only for personal local evaluation. Never commit this file.",
  `JWT_SECRET=${randomBytes(48).toString("hex")}`,
  `CRON_SECRET=${randomBytes(32).toString("hex")}`,
  "ADMIN_EMAIL=local-admin@example.test",
  `ADMIN_PASSWORD=${randomBytes(24).toString("hex")}`,
  "TRUSTED_PROXY_HOPS=0",
  "NEXT_PUBLIC_SITE_URL=http://localhost:3000",
  "",
].join("\n"), { flag: "wx", mode: 0o600 });
writeFileSync(files[1], [
  "# Loopback database used by npm run dev; never loaded in production.",
  "LOCAL_DATABASE=true",
  "DATABASE_URL=postgresql://postgres:local-password@127.0.0.1:55432/postgres?sslmode=disable",
  "",
].join("\n"), { flag: "wx", mode: 0o600 });
console.log("Local setup created. Run npm run dev, then open http://localhost:3000.");
console.log("Your local administrator credentials are in the ignored .env.local file.");
