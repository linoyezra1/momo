/**
 * One-time idempotent migration: event.imageDataUrl (base64) → Cloudinary cover metadata.
 *
 * Usage:
 *   node scripts/migrateEventCovers.js --dry-run
 *   node scripts/migrateEventCovers.js
 *   node scripts/migrateEventCovers.js --limit=20
 *
 * Safe to resume: skips events that already have cover.publicId and empty imageDataUrl.
 */
import dotenv from "dotenv";
import mongoose from "mongoose";
import path from "path";
import { fileURLToPath } from "url";
import User from "../src/models/User.js";
import {
  isCoverStorageConfigured,
  toEventCoverFields,
  uploadCoverDataUrl
} from "../src/services/coverStorage.js";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../.env") });

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const limitArg = argv.find((arg) => arg.startsWith("--limit="));
  const limit = limitArg ? Math.max(1, Number(limitArg.split("=")[1]) || 0) : 0;
  return { dryRun, limit };
}

function approxBytes(dataUrl) {
  const idx = String(dataUrl).indexOf(",");
  if (idx < 0) return 0;
  return Math.floor(((dataUrl.length - idx - 1) * 3) / 4);
}

async function main() {
  const { dryRun, limit } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing");
  }
  if (!dryRun && !isCoverStorageConfigured()) {
    throw new Error("Cloudinary env vars are required for a live migration");
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(JSON.stringify({ type: "migrate_start", dryRun, limit: limit || null }));

  const query = {
    "event.imageDataUrl": { $regex: "^data:image/" }
  };

  let cursor = User.find(query).select("_id username event.imageDataUrl event.cover").cursor();
  const report = {
    scanned: 0,
    migrated: 0,
    skipped: 0,
    failed: 0,
    approxLegacyBytes: 0,
    failures: []
  };

  for await (const user of cursor) {
    report.scanned += 1;
    if (limit && report.migrated + report.failed + report.skipped >= limit) {
      break;
    }

    const dataUrl = String(user.event?.imageDataUrl || "");
    const existingPublicId = String(user.event?.cover?.publicId || "").trim();
    const bytes = approxBytes(dataUrl);
    report.approxLegacyBytes += bytes;

    if (existingPublicId && !dataUrl.startsWith("data:image/")) {
      report.skipped += 1;
      continue;
    }

    if (dryRun) {
      console.log(
        JSON.stringify({
          type: "dry_run_candidate",
          userId: String(user._id),
          username: user.username,
          approxBytes: bytes,
          hasExistingCover: Boolean(existingPublicId)
        })
      );
      report.migrated += 1;
      continue;
    }

    try {
      const uploaded = await uploadCoverDataUrl(dataUrl, {
        folder: "momo/event-covers",
        publicId: existingPublicId || undefined
      });
      if (!uploaded?.url || !uploaded?.publicId) {
        throw new Error("Upload returned incomplete cover metadata");
      }
      const fields = toEventCoverFields(uploaded);
      user.event.cover = fields.cover;
      user.event.imageDataUrl = "";
      await user.save();
      report.migrated += 1;
      console.log(
        JSON.stringify({
          type: "migrated",
          userId: String(user._id),
          username: user.username,
          publicId: uploaded.publicId,
          bytes: uploaded.bytes
        })
      );
    } catch (error) {
      report.failed += 1;
      report.failures.push({
        userId: String(user._id),
        username: user.username,
        message: error?.message || String(error)
      });
      console.error(
        JSON.stringify({
          type: "migrate_error",
          userId: String(user._id),
          message: error?.message || String(error)
        })
      );
    }
  }

  console.log(JSON.stringify({ type: "migrate_complete", ...report, failures: report.failures }));
  await mongoose.disconnect();
  process.exit(report.failed ? 1 : 0);
}

main().catch(async (error) => {
  console.error(JSON.stringify({ type: "migrate_fatal", message: error.message }));
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
