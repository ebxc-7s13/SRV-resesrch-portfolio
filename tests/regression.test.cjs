require("tsx/cjs");
const { test } = require("node:test");
const assert = require("node:assert/strict");
const crypto = require("node:crypto");
const { PGlite } = require("@electric-sql/pglite");
const { PGLiteSocketServer } = require("@electric-sql/pglite-socket");
const { NextRequest } = require("next/server");
process.env.DATABASE_URL =
  "postgresql://postgres:qa@127.0.0.1:55434/postgres?sslmode=disable";
process.env.JWT_SECRET = crypto.randomBytes(48).toString("hex");
process.env.ADMIN_EMAIL = "regression@example.test";
process.env.ADMIN_PASSWORD = "Regression-only-2026!";
process.env.TRUSTED_PROXY_HOPS = "1";
process.env.CRON_SECRET = "regression-cron";
const req = (path, cookie, body, method = "GET") =>
  new NextRequest("http://localhost" + path, {
    method,
    headers: {
      ...(cookie ? { cookie: "auth-token=" + cookie } : {}),
      "x-forwarded-for": "192.0.2.9",
      ...(body ? { "content-type": "application/json" } : {}),
    },
    ...(body
      ? { body: typeof body === "string" ? body : JSON.stringify(body) }
      : {}),
  });
test("database-backed security, seed and CMS regressions", async (t) => {
  const pg = await PGlite.create();
  const server = new PGLiteSocketServer({
    db: pg,
    host: "127.0.0.1",
    port: 55434,
    maxConnections: 20,
  });
  await server.start();
  const { getDb } = require("../src/lib/db.ts");
  const db = getDb();
  const { seedDatabase } = require("../scripts/seed.ts");
  const {
    createToken,
    verifyToken,
    requireAdmin,
  } = require("../src/lib/auth.ts");
  try {
    await t.test(
      "seed repeat, legacy partial recovery and CMS edit preservation",
      async () => {
        await seedDatabase();
        const before = await db.get(
          "SELECT COUNT(*)::int AS count FROM project_media",
        );
        await db.run("UPDATE patents SET description=$1, title=$2 WHERE id=1", [
          "CMS edit ".repeat(80),
          "An edited patent title",
        ]);
        await db.run(
          "UPDATE projects SET slug='edited-oral-project' WHERE slug='oral-cancer-afi'",
        );
        await db.run(
          "DELETE FROM project_media WHERE id=(SELECT MAX(id) FROM project_media)",
        );
        await seedDatabase();
        assert.equal(
          (await db.get("SELECT COUNT(*)::int AS count FROM project_media"))
            .count,
          before.count,
        );
        assert.equal(
          (await db.get("SELECT description FROM patents WHERE id=1"))
            .description,
          "CMS edit ".repeat(80),
        );
        assert.equal(
          (await db.get("SELECT COUNT(*)::int AS count FROM projects")).count,
          6,
        );
        assert.equal(
          (await db.get("SELECT COUNT(*)::int AS count FROM patents")).count,
          2,
        );
      },
    );
    await t.test(
      "lab devices follow CMS edits through stable seed identities",
      async () => {
        const { getLabContent } = require("../src/lib/lab-content.ts");
        const before = await getLabContent();
        assert.equal(before.unavailable, false);
        assert.equal(before.devices.length, 2);
        assert.equal(before.computationalProjects.length, 2);
        assert.equal(before.projects.length, 6);
        assert.equal(before.patents.length, 2);
        assert.equal(before.theses.length, 2);
        assert.ok(before.projects.every((p) => !("private_notes" in p)));
        assert.equal(before.notes.length, (await db.get("SELECT COUNT(*)::int AS count FROM posts WHERE published=1")).count);
        assert.equal(before.media.length, (await db.get("SELECT COUNT(*)::int AS count FROM project_media WHERE media_type IN ('image','video')")).count);
        assert.ok(before.media.every(m => before.projects.some(p => p.id===m.project_id && p.slug===m.slug)));
        assert.ok(
          before.computationalProjects.some(
            (p) => p.slug === "edited-oral-project",
          ),
        );
        assert.ok(
          before.computationalProjects.every((p) => !("private_notes" in p)),
        );
        const simulator = before.devices.find((d) => d.id === "mmsa");
        const microscope = before.devices.find((d) => d.id === "microscope");
        assert.equal(simulator.project.slug, "microgravity-platform");
        assert.equal(microscope.project.slug, "oncospectrix-microscope");
        assert.equal(simulator.patents.length, 1);
        assert.equal(microscope.patents.length, 1);
        assert.ok(!("private_notes" in simulator.project));
        assert.ok(!("application_number" in simulator.patents[0]));
        const project = simulator.project,
          patent = simulator.patents[0];
        try {
          await db.run(
            "UPDATE projects SET slug=$1, research_problem=$2 WHERE id=$3",
            ["cms-edited-simulator", "Synthetic CMS verification", project.id],
          );
          await db.run("UPDATE patents SET title=$1 WHERE id=$2", [
            "Synthetic renamed patent",
            patent.id,
          ]);
          const edited = (await getLabContent()).devices.find(
            (d) => d.id === "mmsa",
          );
          assert.equal(edited.project.id, project.id);
          assert.equal(edited.project.slug, "cms-edited-simulator");
          assert.equal(
            edited.project.research_problem,
            "Synthetic CMS verification",
          );
          assert.equal(edited.patents[0].id, patent.id);
          assert.equal(edited.patents[0].title, "Synthetic renamed patent");
        } finally {
          await db.run(
            "UPDATE projects SET slug=$1, research_problem=$2 WHERE id=$3",
            [project.slug, project.research_problem, project.id],
          );
          await db.run("UPDATE patents SET title=$1 WHERE id=$2", [
            patent.title,
            patent.id,
          ]);
        }
      },
    );
    await t.test(
      "model inspector is rejected before production streaming",
      async () => {
        const { middleware } = require("../src/middleware.ts");
        const previous = process.env.NODE_ENV;
        try {
          process.env.NODE_ENV = "production";
          for (const path of ["/lab/models", "/lab/models/example"]) {
            assert.equal((await middleware(req(path))).status, 404);
          }
          assert.equal((await middleware(req("/lab"))).status, 200);
          process.env.NODE_ENV = "development";
          assert.equal((await middleware(req("/lab/models"))).status, 200);
        } finally {
          if (previous === undefined) delete process.env.NODE_ENV;
          else process.env.NODE_ENV = previous;
        }
      },
    );
    await t.test("seed transaction rolls back on partial failure", async () => {
      await db.query(
        "CREATE FUNCTION qa_fail_seed() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'synthetic failure'; END $$",
      );
      await db.query(
        "CREATE TRIGGER qa_seed_failure BEFORE INSERT ON project_media FOR EACH ROW EXECUTE FUNCTION qa_fail_seed()",
      );
      await db.run(
        "DELETE FROM project_media WHERE id=(SELECT MAX(id) FROM project_media)",
      );
      await db.run(
        "DELETE FROM research_themes WHERE title='Robotics & Embedded Systems'",
      );
      await assert.rejects(seedDatabase);
      assert.equal(
        (await db.get("SELECT COUNT(*)::int AS count FROM research_themes"))
          .count,
        5,
      );
      await db.query("DROP TRIGGER qa_seed_failure ON project_media");
      await seedDatabase();
    });
    const user = await db.get("SELECT id,email,name,role FROM users LIMIT 1");
    let token = await createToken(user);
    await t.test(
      "guarded figure correction preserves edited captions and is repeatable",
      async () => {
        const fixes = require("../scripts/figure-corrections.json");
        const fix = fixes.find((f) => f.file.endsWith("/corer.png"));
        await db.run(
          "UPDATE project_media SET caption=$1,section=$2 WHERE file_path=$3",
          [fix.caption, fix.section, fix.file],
        );
        const preserved = fixes.find((f) => f.file.endsWith("/download.png"));
        await db.run("UPDATE project_media SET caption=$1 WHERE file_path=$2", [
          "Custom caption from CMS",
          preserved.file,
        ]);
        const { correctFigures } = require("../scripts/correct-figures.ts");
        assert.equal(await correctFigures(), 1);
        assert.equal(await correctFigures(), 0);
        assert.equal(
          (
            await db.get(
              "SELECT caption FROM project_media WHERE file_path=$1",
              [fix.file],
            )
          ).caption,
          fix.nextCaption,
        );
        assert.equal(
          (
            await db.get(
              "SELECT caption FROM project_media WHERE file_path=$1",
              [preserved.file],
            )
          ).caption,
          "Custom caption from CMS",
        );
      },
    );
    await t.test(
      "unique tokens, exact expiry, missing/revoked/expired/mismatched sessions",
      async () => {
        assert.notEqual(await createToken(user), token);
        assert.ok(await verifyToken(token));
        const hash = crypto.createHash("sha256").update(token).digest("hex");
        await db.run(
          "UPDATE sessions SET expires_at=expires_at+INTERVAL '1 hour' WHERE token_hash=$1",
          [hash],
        );
        assert.equal(await verifyToken(token), null);
        await db.run("UPDATE sessions SET revoked=1 WHERE token_hash=$1", [
          hash,
        ]);
        assert.equal(await verifyToken(token), null);
        await db.run(
          "UPDATE sessions SET revoked=0, expires_at=NOW()-INTERVAL '1 day' WHERE token_hash=$1",
          [hash],
        );
        assert.equal(await verifyToken(token), null);
        await db.run("DELETE FROM sessions WHERE token_hash=$1", [hash]);
        assert.equal(await verifyToken(token), null);
        assert.equal(await verifyToken(token + ".bad"), null);
        token = await createToken(user);
      },
    );
    await t.test(
      "draft/media/site-content route auth independent of middleware",
      async () => {
        for (const p of ["posts/[id]", "media", "site-content"]) {
          const { GET } = require("../src/app/api/admin/" + p + "/route.ts");
          const context = { params: Promise.resolve({ id: "1" }) };
          assert.equal(
            (await GET(req("/api/admin/" + p), context)).status,
            401,
          );
          assert.equal(
            (await GET(req("/api/admin/" + p, token), context)).status,
            200,
          );
        }
        await db.run("UPDATE users SET role='editor' WHERE id=$1", [user.id]);
        await assert.rejects(() =>
          requireAdmin(req("/api/admin/media", token)),
        );
        const { GET } = require("../src/app/api/admin/media/route.ts");
        assert.equal((await GET(req("/api/admin/media", token))).status, 403);
        await db.run("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
      },
    );
    await t.test(
      "bearer-only cron, retired bootstrap and invalid JSON",
      async () => {
        const { middleware } = require("../src/middleware.ts");
        assert.equal(
          (await middleware(req("/api/cron/cleanup"))).headers.get(
            "x-middleware-next",
          ),
          "1",
        );
        const { GET } = require("../src/app/api/cron/cleanup/route.ts");
        assert.equal((await GET(req("/api/cron/cleanup"))).status, 401);
        assert.equal(
          (
            await GET(
              new NextRequest("http://localhost/api/cron/cleanup", {
                headers: { authorization: "Bearer regression-cron" },
              }),
            )
          ).status,
          200,
        );
        assert.equal(
          require("../src/app/api/seed/route.ts").POST().status,
          410,
        );
        const { POST } = require("../src/app/api/admin/media/route.ts");
        assert.equal(
          (await POST(req("/api/admin/media", token, "{", "POST"))).status,
          400,
        );
      },
    );
    await t.test(
      "every admin handler rejects absent, downgraded and revoked credentials",
      async () => {
        const fs = require("node:fs"),
          path = require("node:path");
        const routes = [];
        function walk(dir) {
          for (const item of fs.readdirSync(dir, { withFileTypes: true })) {
            const file = path.join(dir, item.name);
            if (item.isDirectory()) walk(file);
            else if (item.name === "route.ts") routes.push(file);
          }
        }
        walk(path.resolve(__dirname, "../src/app/api/admin"));
        const handlers = routes.flatMap((file) =>
          Object.entries(require(file))
            .filter(
              ([verb, handler]) =>
                ["GET", "POST", "PUT", "PATCH", "DELETE"].includes(verb) &&
                typeof handler === "function",
            )
            .map(([verb, handler]) => ({ verb, handler, file })),
        );
        for (const role of ["anonymous", "editor", "revoked"]) {
          if (role === "editor")
            await db.run("UPDATE users SET role='editor' WHERE id=$1", [
              user.id,
            ]);
          if (role === "revoked")
            await db.run("UPDATE sessions SET revoked=1 WHERE user_id=$1", [
              user.id,
            ]);
          for (const { verb, handler, file } of handlers) {
            const response = await handler(
              req(
                "/api/admin/qa",
                role === "anonymous" ? null : token,
                ["POST", "PUT", "PATCH"].includes(verb) ? {} : undefined,
                verb,
              ),
              { params: Promise.resolve({ id: "1" }) },
            );
            assert.equal(
              response.status,
              role === "editor" ? 403 : 401,
              `${role}: ${verb} ${file}`,
            );
          }
        }
        await db.run("UPDATE users SET role='admin' WHERE id=$1", [user.id]);
        token = await createToken(user);
      },
    );
    await t.test(
      "site-content slots accept supported text and reject invisible custom keys",
      async () => {
        const {
          POST,
          GET,
        } = require("../src/app/api/admin/site-content/route.ts");
        const data = {
          page: "home",
          key: "hero_subtitle",
          value: "Synthetic public text",
        };
        assert.equal(
          (await POST(req("/api/admin/site-content", token, data, "POST")))
            .status,
          201,
        );
        assert.equal(
          (
            await (
              await GET(
                req(
                  "/api/admin/site-content?page=home&key=hero_subtitle",
                  token,
                ),
              )
            ).json()
          ).data.value,
          data.value,
        );
        assert.equal(
          (
            await POST(
              req(
                "/api/admin/site-content",
                token,
                { ...data, key: "unsupported" },
                "POST",
              ),
            )
          ).status,
          400,
        );
      },
    );
    await t.test(
      "slug/null/image contracts and server contact timing",
      async () => {
        const {
          postSchema,
          projectSchema,
          contactSchema,
        } = require("../src/lib/validation.ts");
        const post = {
          title: "Example title",
          slug: "",
          content: "Example",
          excerpt: "Example",
          cover_image: null,
        };
        assert.equal(postSchema.parse(post).slug, "example-title");
        assert.ok(
          postSchema.safeParse({
            ...post,
            cover_image: "/research/oral-cancer/model.png",
          }).success,
        );
        for (const image of [
          "https://example.test/image.png",
          "/research/missing.png",
          "/research/../secret.png",
          "/research/%2e%2e/secret.png",
        ])
          assert.equal(
            postSchema.safeParse({ ...post, cover_image: image }).success,
            false,
          );
        assert.ok(
          projectSchema.safeParse({
            title: "Example",
            slug: "",
            research_problem: "Example",
            motivation: "Example",
            approach: "Example",
            results: "Example",
            key_contribution: "Example",
            methodology: null,
          }).success,
        );
        const contact = {
          name: "QA",
          email: "qa@example.test",
          subject: "Test",
          message: "Synthetic test message",
          timestamp: String(Date.now()),
        };
        assert.equal(contactSchema.safeParse(contact).success, false);
        assert.ok(
          contactSchema.safeParse({
            ...contact,
            timestamp: String(Date.now() - 4000),
          }).success,
        );
      },
    );
    await t.test(
      "read-only totals, explicit message read, record pagination and invalid bounds",
      async () => {
        for (let i = 0; i < 23; i++)
          await db.run(
            "INSERT INTO messages (name,email,subject,message) VALUES ($1,$2,$3,$4)",
            ["QA", "qa@example.test", "Message " + i, "Synthetic body"],
          );
        const { GET: stats } = require("../src/app/api/admin/stats/route.ts");
        assert.equal(
          (await (await stats(req("/api/admin/stats", token))).json()).data
            .unreadMessages,
          23,
        );
        const {
          GET,
          PATCH,
        } = require("../src/app/api/admin/messages/route.ts");
        assert.equal(
          (await (await GET(req("/api/admin/messages?page=2", token))).json())
            .data.data.length,
          3,
        );
        assert.equal(
          (
            await db.get(
              "SELECT COUNT(*)::int AS count FROM messages WHERE read=0",
            )
          ).count,
          23,
        );
        await PATCH(req("/api/admin/messages", token, { id: 1 }, "PATCH"));
        assert.equal(
          (
            await db.get(
              "SELECT COUNT(*)::int AS count FROM messages WHERE read=0",
            )
          ).count,
          22,
        );
        for (const q of [
          "page=-1",
          "page=no",
          "limit=0",
          "limit=100000",
          "page=1.5",
        ])
          assert.equal(
            (await GET(req("/api/admin/messages?" + q, token))).status,
            400,
          );
      },
    );
    await t.test(
      "publication CMS create/update and conflict errors",
      async () => {
        const { POST } = require("../src/app/api/admin/publications/route.ts");
        const data = {
          title: "Regression paper",
          authors: "QA",
          journal: "Test venue",
          year: 2026,
          status: "manuscript",
        };
        const response = await POST(
          req("/api/admin/publications", token, data, "POST"),
        );
        assert.equal(response.status, 201);
        const id = (await response.json()).data.id;
        const {
          PUT,
        } = require("../src/app/api/admin/publications/[id]/route.ts");
        assert.equal(
          (
            await PUT(
              req(
                "/api/admin/publications/" + id,
                token,
                { ...data, status: "preprint" },
                "PUT",
              ),
              { params: Promise.resolve({ id: String(id) }) },
            )
          ).status,
          200,
        );
      },
    );
    await t.test(
      "proxy right-hand trust, separate budgets and fail-closed configuration",
      async () => {
        const { getClientIp } = require("../src/lib/client-ip.ts");
        const {
          rateLimit,
          applyRateLimit,
        } = require("../src/lib/rate-limit.ts");
        const request = (ip) =>
          new Request("https://example.test", {
            headers: { "x-forwarded-for": "spoofed, " + ip },
          });
        assert.equal(getClientIp(request("192.0.2.1")), "192.0.2.1");
        const limit = rateLimit({ maxRequests: 1, scope: "test-budgets" });
        assert.equal(
          await applyRateLimit(request("192.0.2.1"), limit),
          null,
        );
        assert.equal(
          (await applyRateLimit(request("192.0.2.1"), limit)).status,
          429,
        );
        assert.equal(
          await applyRateLimit(request("192.0.2.2"), limit),
          null,
        );
        process.env.TRUSTED_PROXY_HOPS = "0";
        assert.equal(
          (await applyRateLimit(request("192.0.2.3"), limit)).status,
          503,
        );
        process.env.TRUSTED_PROXY_HOPS = "1";
      },
    );
    await t.test(
      "rate limits are stored in the database and windows reset",
      async () => {
        const { rateLimit, applyRateLimit } = require("../src/lib/rate-limit.ts");
        const request = (ip) =>
          new Request("https://example.test", {
            headers: { "x-forwarded-for": "spoofed, " + ip },
          });
        const limit = rateLimit({ maxRequests: 1, scope: "test-reset" });
        assert.equal(
          await applyRateLimit(request("192.0.2.7"), limit),
          null,
        );
        assert.equal(
          (await applyRateLimit(request("192.0.2.7"), limit)).status,
          429,
        );
        // Simulate window expiry by backdating the stored window start.
        await db.run(
          "UPDATE rate_limits SET window_start = NOW() - INTERVAL '2 hours' WHERE key = $1",
          ["test-reset:192.0.2.7"],
        );
        assert.equal(
          await applyRateLimit(request("192.0.2.7"), limit),
          null,
        );
        const stored = await db.get(
          "SELECT count FROM rate_limits WHERE key = $1",
          ["test-reset:192.0.2.7"],
        );
        assert.equal(Number(stored.count), 1);
      },
    );
    await t.test(
      "credential rotation changes password and revokes tokens",
      async () => {
        const { rotateAdmin } = require("../scripts/rotate-admin.ts");
        const { verifyPassword } = require("../src/lib/auth.ts");
        const before = await db.get(
          "SELECT password_hash FROM users WHERE id=$1",
          [user.id],
        );
        await rotateAdmin(user.email, "Changed-local-only-2026!");
        assert.equal(await verifyToken(token), null);
        const row = await db.get(
          "SELECT password_hash FROM users WHERE id=$1",
          [user.id],
        );
        assert.ok(
          await verifyPassword("Changed-local-only-2026!", row.password_hash),
        );
        assert.equal(
          await verifyPassword(process.env.ADMIN_PASSWORD, row.password_hash),
          false,
        );
        await assert.rejects(() => createToken(user, before.password_hash));
      },
    );
    await t.test(
      "database TLS policy verifies certificates and rejects remote plaintext",
      () => {
        const { databaseConfig } = require("../src/lib/database-config.ts");
        assert.equal(
          databaseConfig("postgresql://u:p@db.example.test/db?sslmode=require")
            .ssl.rejectUnauthorized,
          true,
        );
        assert.throws(() =>
          databaseConfig("postgresql://u:p@db.example.test/db?sslmode=disable"),
        );
      },
    );
  } finally {
    await global.__portfolioPgPool?.end();
    await server.stop();
    await pg.close();
  }
});
