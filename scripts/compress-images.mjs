#!/usr/bin/env node
/**
 * In-place image compression for public/research and public/theses.
 *
 * - Keeps filenames EXACTLY the same (DB rows, CMS seeds and regression tests
 *   reference these paths; some files are intentionally "mislabeled", e.g.
 *   JPEG bytes in a .png file — we preserve the container format as-is).
 * - JPEG  -> mozjpeg quality 82, 4:2:0 (visually transparent for captures)
 * - PNG   -> picks the smaller of palette-quantized (q85, dithered) and
 *            max-effort lossless recompression
 * - Only overwrites when the result saves >= 15%.
 * - Originals are backed up to .image-backups/<relative-path>; originals are
 *   never modified unless the new version passes the size gate.
 *
 * Usage:
 *   node scripts/compress-images.mjs           # compress
 *   node scripts/compress-images.mjs --restore # restore all originals
 */
import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";

const ROOTS = ["public/research", "public/theses"];
const BACKUP_DIR = ".image-backups";
const MIN_BYTES = 150 * 1024; // only touch files >= 150 KB
const MIN_SAVING = 0.15; // require >= 15% smaller to overwrite

const args = new Set(process.argv.slice(2));
const restoring = args.has("--restore");

async function* walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) yield* walk(full);
    else if (/\.(png|jpe?g)$/i.test(entry.name)) yield full;
  }
}

async function collectTargets() {
  const targets = [];
  for (const root of ROOTS) {
    let exists = true;
    try {
      await fs.access(root);
    } catch {
      exists = false;
    }
    if (!exists) continue;
    for await (const file of walk(root)) {
      const stat = await fs.stat(file);
      if (stat.size >= MIN_BYTES) targets.push(file);
    }
  }
  return targets;
}

function formatBytes(n) {
  return n >= 1024 * 1024
    ? `${(n / 1024 / 1024).toFixed(2)} MB`
    : `${(n / 1024).toFixed(0)} KB`;
}

async function restoreAll() {
  let restored = 0;
  const manifestPath = path.join(BACKUP_DIR, "manifest.json");
  let manifest = [];
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    console.log("No backup manifest found — nothing to restore.");
    return;
  }
  for (const entry of manifest) {
    const backup = entry.backupPath;
    try {
      await fs.copyFile(backup, entry.file);
      restored++;
      console.log(`restored  ${entry.file}`);
    } catch (err) {
      console.warn(`skip      ${entry.file} (${err.code ?? err.message})`);
    }
  }
  console.log(`\nRestored ${restored}/${manifest.length} files.`);
}

async function compressAll() {
  const targets = await collectTargets();
  if (targets.length === 0) {
    console.log("No target images found.");
    return;
  }

  const manifestPath = path.join(BACKUP_DIR, "manifest.json");
  await fs.mkdir(BACKUP_DIR, { recursive: true });
  let manifest = [];
  try {
    manifest = JSON.parse(await fs.readFile(manifestPath, "utf8"));
  } catch {
    /* first run */
  }
  const backedUp = new Set(manifest.map((m) => m.file));

  let totalBefore = 0;
  let totalAfter = 0;
  let changed = 0;
  let skipped = 0;

  for (const file of targets) {
    const before = await fs.readFile(file);
    let meta;
    try {
      meta = await sharp(before).metadata();
    } catch {
      console.warn(`unreadable ${file} — skipped`);
      skipped++;
      continue;
    }

    const format = meta.format; // actual byte format, may differ from extension
    let candidates = [];
    try {
      if (format === "jpeg") {
        candidates = [
          await sharp(before)
            .jpeg({ quality: 82, mozjpeg: true, chromaSubsampling: "4:2:0" })
            .toBuffer(),
        ];
      } else if (format === "png") {
        // Palette quantization (great for screenshots/captures) vs lossless.
        candidates = [
          await sharp(before)
            .png({
              palette: true,
              quality: 85,
              dither: 1.0,
              compressionLevel: 9,
              effort: 7,
            })
            .toBuffer(),
          await sharp(before)
            .png({ compressionLevel: 9, effort: 7 })
            .toBuffer(),
        ];
      } else {
        console.warn(`unsupported format ${format} — ${file}, skipped`);
        skipped++;
        continue;
      }
    } catch (err) {
      console.warn(`encode failed ${file} — skipped (${err.message})`);
      skipped++;
      continue;
    }

    const best = candidates.reduce((a, b) => (b.length < a.length ? b : a));

    if (best.length >= before.length * (1 - MIN_SAVING)) {
      console.log(
        `no gain   ${file}  ${formatBytes(before.length)} → ${formatBytes(best.length)}`,
      );
      skipped++;
      continue;
    }

    if (!backedUp.has(file)) {
      const backupPath = path.join(BACKUP_DIR, file);
      await fs.mkdir(path.dirname(backupPath), { recursive: true });
      await fs.writeFile(backupPath, before);
      manifest.push({ file, backupPath, bytes: before.length });
      backedUp.add(file);
    }

    await fs.writeFile(file, best);
    changed++;
    totalBefore += before.length;
    totalAfter += best.length;
    console.log(
      `compressed ${file}  ${formatBytes(before.length)} → ${formatBytes(best.length)}  (${Math.round((1 - best.length / before.length) * 100)}% smaller, ${format} bytes)`,
    );
  }

  await fs.writeFile(manifestPath, JSON.stringify(manifest, null, 2));

  console.log("\n──────── summary ────────");
  console.log(`files changed: ${changed}, skipped: ${skipped}`);
  if (changed > 0) {
    console.log(
      `total: ${formatBytes(totalBefore)} → ${formatBytes(totalAfter)}  (saved ${formatBytes(totalBefore - totalAfter)})`,
    );
  }
}

if (restoring) await restoreAll();
else await compressAll();
