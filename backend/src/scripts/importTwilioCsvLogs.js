/**
 * One-time Twilio SMS/WhatsApp CSV reconciliation → WhatsAppDeliveryLog.
 *
 * Default CSV path: backend/data/sms-log.csv
 *
 * Usage (from backend/):
 *   node src/scripts/importTwilioCsvLogs.js
 *   node src/scripts/importTwilioCsvLogs.js --dry-run
 *   node src/scripts/importTwilioCsvLogs.js --file=./data/sms-log.csv
 *
 * From repo root:
 *   node backend/src/scripts/importTwilioCsvLogs.js
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { createReadStream } from "fs";
import dotenv from "dotenv";
import mongoose from "mongoose";
import csv from "csv-parser";
import Guest from "../models/Guest.js";
import User from "../models/User.js";
import WhatsAppDeliveryLog from "../models/WhatsAppDeliveryLog.js";
import { normalizePhone, phoneLookupVariants } from "../utils/guestPhone.js";
import {
  isBillableMessageStatus,
  isFailedMessageStatus,
  parseTwilioPrice
} from "../utils/twilioMessageBilling.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const backendRoot = path.resolve(__dirname, "../..");

dotenv.config({ path: path.resolve(backendRoot, ".env") });

const CHUNK = 400;

function parseArgs(argv) {
  const dryRun = argv.includes("--dry-run");
  const fileArg = argv.find((arg) => arg.startsWith("--file="));
  const file = fileArg
    ? path.resolve(process.cwd(), fileArg.slice("--file=".length))
    : path.resolve(backendRoot, "data/sms-log.csv");
  return { dryRun, file };
}

function normalizeGuestPhoneFromCsv(raw) {
  let value = String(raw || "").trim();
  value = value.replace(/^whatsapp:/i, "");
  value = value.replace(/[\s\-()]/g, "");
  return normalizePhone(value);
}

function mapDirection(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (value.includes("inbound")) return "inbound";
  if (value.includes("outbound")) return "outbound";
  return "outbound";
}

function mapStatus(raw) {
  const value = String(raw || "").trim().toLowerCase();
  if (!value) return "unknown";
  if (value === "received") return "delivered";
  if (
    ["queued", "sent", "delivered", "read", "undelivered", "failed", "unknown"].includes(value)
  ) {
    return value;
  }
  return "unknown";
}

function pickGuestPhone(row, direction) {
  if (direction === "inbound") return normalizeGuestPhoneFromCsv(row.From);
  return normalizeGuestPhoneFromCsv(row.To);
}

function chunkArray(items, size) {
  const out = [];
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size));
  return out;
}

/**
 * Build phone → best guest map.
 * When the same phone appears on multiple events, keep the guest whose User/event was created first.
 */
async function buildGuestPhoneIndex() {
  const guests = await Guest.find({ phone: { $exists: true, $ne: "" } })
    .select("fullName phone userId createdAt")
    .lean();

  const userIds = [...new Set(guests.map((g) => String(g.userId)).filter(Boolean))];
  const users = await User.find({ _id: { $in: userIds } }).select("createdAt").lean();
  const userCreatedAt = new Map(
    users.map((u) => [String(u._id), new Date(u.createdAt || 0).getTime()])
  );

  /** @type {Map<string, object>} */
  const byPhone = new Map();

  for (const guest of guests) {
    const variants = phoneLookupVariants(guest.phone);
    if (!variants.length) continue;
    const eventCreated = userCreatedAt.get(String(guest.userId)) ?? Number.MAX_SAFE_INTEGER;
    const guestCreated = new Date(guest.createdAt || 0).getTime();

    for (const variant of variants) {
      const key = normalizePhone(variant) || variant;
      if (!key) continue;
      const current = byPhone.get(key);
      if (!current) {
        byPhone.set(key, { guest, eventCreated, guestCreated });
        continue;
      }
      if (
        eventCreated < current.eventCreated ||
        (eventCreated === current.eventCreated && guestCreated < current.guestCreated)
      ) {
        byPhone.set(key, { guest, eventCreated, guestCreated });
      }
    }
  }

  return byPhone;
}

function resolveGuest(byPhone, normalizedPhone) {
  if (!normalizedPhone) return null;
  const direct = byPhone.get(normalizedPhone);
  if (direct) return direct.guest;
  for (const variant of phoneLookupVariants(normalizedPhone)) {
    const hit = byPhone.get(normalizePhone(variant) || variant);
    if (hit) return hit.guest;
  }
  return null;
}

function readCsvRows(file) {
  return new Promise((resolve, reject) => {
    const rows = [];
    createReadStream(file)
      .pipe(
        csv({
          mapHeaders: ({ header }) => String(header || "").trim(),
          strict: false
        })
      )
      .on("data", (row) => rows.push(row))
      .on("error", reject)
      .on("end", () => resolve(rows));
  });
}

function buildPayload(row, guest, direction, status, normalizedPhone) {
  const price = parseTwilioPrice(row.Price);
  const amount = price != null ? price : Math.abs(Number.parseFloat(String(row.Price || ""))) || 0;
  const sentAt = row.SentDate ? new Date(row.SentDate) : null;
  const sentAtValid = sentAt && !Number.isNaN(sentAt.getTime()) ? sentAt : null;
  const errorCodeRaw = String(row.ErrorCode ?? "").trim();
  const errorCode = errorCodeRaw === "0" || errorCodeRaw === "" ? "" : errorCodeRaw;
  const failed = isFailedMessageStatus(status);
  const isBilled = !failed && (isBillableMessageStatus(status) || direction === "inbound");
  const billedAmount = failed ? 0 : amount;

  return {
    messageSid: String(row.Sid || "").trim(),
    userId: guest.userId,
    eventId: guest.userId,
    guestId: guest._id,
    guestName: String(guest.fullName || "").trim(),
    guestPhone: normalizedPhone,
    direction,
    status,
    priceUnit: "USD",
    isBilled: failed ? false : isBilled,
    actualCost: billedAmount,
    cost: billedAmount,
    costUsd: billedAmount,
    errorCode,
    errorMessage: "",
    errorMessageHe: "",
    sentAt: sentAtValid,
    failedAt: failed && sentAtValid ? sentAtValid : null
  };
}

function needsUpdate(existing, payload) {
  if (!existing.userId && payload.userId) return true;
  if (!existing.eventId && payload.eventId) return true;
  if (!existing.guestId && payload.guestId) return true;
  if (!existing.guestName && payload.guestName) return true;
  if (!existing.guestPhone && payload.guestPhone) return true;
  if (!existing.direction && payload.direction) return true;
  if (payload.status && payload.status !== existing.status) return true;
  if (!existing.sentAt && payload.sentAt) return true;
  if (payload.errorCode && !existing.errorCode) return true;
  const currentCost = Number(existing.actualCost ?? existing.costUsd ?? existing.cost) || 0;
  if (payload.isBilled && payload.actualCost > 0 && (currentCost <= 0 || existing.isBilled !== true)) {
    return true;
  }
  if (payload.isBilled !== Boolean(existing.isBilled) && payload.isBilled) return true;
  if (!payload.isBilled && (existing.isBilled || currentCost > 0) && isFailedMessageStatus(payload.status)) {
    return true;
  }
  return false;
}

function mergeUpdate(existing, payload) {
  const next = { ...existing };
  if (!next.userId && payload.userId) next.userId = payload.userId;
  if (!next.eventId && payload.eventId) next.eventId = payload.eventId;
  if (!next.guestId && payload.guestId) next.guestId = payload.guestId;
  if (!next.guestName && payload.guestName) next.guestName = payload.guestName;
  if (!next.guestPhone && payload.guestPhone) next.guestPhone = payload.guestPhone;
  if (!next.direction) next.direction = payload.direction;
  if (payload.status) next.status = payload.status;
  if (!next.sentAt && payload.sentAt) next.sentAt = payload.sentAt;
  if (payload.errorCode && !next.errorCode) next.errorCode = payload.errorCode;

  if (isFailedMessageStatus(payload.status)) {
    next.isBilled = false;
    next.actualCost = 0;
    next.cost = 0;
    next.costUsd = 0;
    if (!next.failedAt && payload.failedAt) next.failedAt = payload.failedAt;
  } else {
    const currentCost = Number(next.actualCost ?? next.costUsd ?? next.cost) || 0;
    if (payload.actualCost > 0 && (currentCost <= 0 || next.isBilled !== true)) {
      next.actualCost = payload.actualCost;
      next.cost = payload.actualCost;
      next.costUsd = payload.actualCost;
      next.isBilled = payload.isBilled;
      next.priceUnit = "USD";
    } else if (payload.isBilled && next.isBilled !== true) {
      next.isBilled = true;
      if (currentCost <= 0 && payload.actualCost > 0) {
        next.actualCost = payload.actualCost;
        next.cost = payload.actualCost;
        next.costUsd = payload.actualCost;
      }
    }
  }
  return next;
}

async function loadExistingBySids(sids) {
  /** @type {Map<string, object>} */
  const map = new Map();
  for (const batch of chunkArray(sids, CHUNK)) {
    const rows = await WhatsAppDeliveryLog.find({ messageSid: { $in: batch } }).lean();
    for (const row of rows) map.set(String(row.messageSid), row);
  }
  return map;
}

async function main() {
  const { dryRun, file } = parseArgs(process.argv.slice(2));

  if (!process.env.MONGO_URI) {
    throw new Error("MONGO_URI is missing (env or backend/.env)");
  }
  if (!fs.existsSync(file)) {
    throw new Error(`CSV file not found: ${file}`);
  }

  await mongoose.connect(process.env.MONGO_URI);
  console.log(`[importTwilioCsv] connected · dryRun=${dryRun} · file=${file}`);

  const byPhone = await buildGuestPhoneIndex();
  console.log(`[importTwilioCsv] guest phone index size=${byPhone.size}`);

  console.log("[importTwilioCsv] reading CSV…");
  const csvRows = await readCsvRows(file);
  console.log(`[importTwilioCsv] csv rows=${csvRows.length}`);

  const unmatched = [];
  const summary = {
    rowsRead: csvRows.length,
    inbound: 0,
    outbound: 0,
    matched: 0,
    created: 0,
    updated: 0,
    unchanged: 0,
    unmatched: 0,
    skippedNoSid: 0
  };

  /** @type {Array<{ sid: string, payload: object }>} */
  const matchedRows = [];

  for (const row of csvRows) {
    const direction = mapDirection(row.Direction);
    if (direction === "inbound") summary.inbound += 1;
    else summary.outbound += 1;

    const sid = String(row.Sid || "").trim();
    if (!sid) {
      summary.skippedNoSid += 1;
      continue;
    }

    const status = mapStatus(row.Status);
    const normalizedPhone = pickGuestPhone(row, direction);
    const guest = resolveGuest(byPhone, normalizedPhone);

    if (!guest) {
      summary.unmatched += 1;
      unmatched.push({
        sid,
        direction,
        status,
        from: row.From || "",
        to: row.To || "",
        guestPhone: normalizedPhone || "",
        sentDate: row.SentDate || "",
        price: row.Price || ""
      });
      continue;
    }

    summary.matched += 1;
    matchedRows.push({
      sid,
      payload: buildPayload(row, guest, direction, status, normalizedPhone)
    });
  }

  console.log(`[importTwilioCsv] loading existing logs for ${matchedRows.length} SIDs…`);
  const existingBySid = await loadExistingBySids(matchedRows.map((row) => row.sid));

  const toInsert = [];
  const toUpdate = [];

  for (const { sid, payload } of matchedRows) {
    const existing = existingBySid.get(sid);
    if (!existing) {
      toInsert.push(payload);
      continue;
    }
    if (needsUpdate(existing, payload)) {
      toUpdate.push(mergeUpdate(existing, payload));
    } else {
      summary.unchanged += 1;
    }
  }

  summary.created = toInsert.length;
  summary.updated = toUpdate.length;

  if (dryRun) {
    console.log("[importTwilioCsv] dry-run — no writes");
  } else {
    console.log(`[importTwilioCsv] inserting ${toInsert.length}…`);
    for (const batch of chunkArray(toInsert, CHUNK)) {
      if (!batch.length) continue;
      await WhatsAppDeliveryLog.insertMany(batch, { ordered: false }).catch(async (error) => {
        // Ignore duplicate key races; continue with remaining.
        if (error?.code !== 11000 && error?.writeErrors) {
          const nonDup = error.writeErrors.filter((err) => err.code !== 11000);
          if (nonDup.length) throw error;
        } else if (error?.code && error.code !== 11000 && !error.writeErrors) {
          throw error;
        }
      });
    }

    console.log(`[importTwilioCsv] updating ${toUpdate.length}…`);
    for (const batch of chunkArray(toUpdate, CHUNK)) {
      if (!batch.length) continue;
      const ops = batch.map((doc) => ({
        updateOne: {
          filter: { messageSid: doc.messageSid },
          update: {
            $set: {
              userId: doc.userId,
              eventId: doc.eventId,
              guestId: doc.guestId,
              guestName: doc.guestName,
              guestPhone: doc.guestPhone,
              direction: doc.direction,
              status: doc.status,
              priceUnit: doc.priceUnit || "USD",
              isBilled: doc.isBilled === true,
              actualCost: Number(doc.actualCost) || 0,
              cost: Number(doc.cost) || 0,
              costUsd: Number(doc.costUsd) || 0,
              errorCode: doc.errorCode || "",
              sentAt: doc.sentAt || null,
              failedAt: doc.failedAt || null
            }
          }
        }
      }));
      await WhatsAppDeliveryLog.bulkWrite(ops, { ordered: false });
    }
  }

  const unmatchedPath = path.resolve(
    backendRoot,
    `data/sms-log-unmatched-${new Date().toISOString().slice(0, 10)}.json`
  );
  fs.writeFileSync(unmatchedPath, JSON.stringify(unmatched, null, 2), "utf8");

  console.log("\n========== Twilio CSV import summary ==========");
  console.log(`Rows read:              ${summary.rowsRead}`);
  console.log(`Inbound:                ${summary.inbound}`);
  console.log(`Outbound:               ${summary.outbound}`);
  console.log(`Matched to guest/event: ${summary.matched}`);
  console.log(`${(dryRun ? "Would create" : "Created") + ":"}`.padEnd(24) + String(summary.created));
  console.log(`${(dryRun ? "Would update" : "Updated") + ":"}`.padEnd(24) + String(summary.updated));
  console.log(`Unchanged:              ${summary.unchanged}`);
  console.log(`Unmatched (no phone):   ${summary.unmatched}`);
  console.log(`Skipped (no Sid):       ${summary.skippedNoSid}`);
  console.log(`Unmatched JSON:         ${unmatchedPath}`);
  console.log("================================================\n");

  await mongoose.disconnect();
}

main().catch(async (error) => {
  console.error("[importTwilioCsv] failed:", error?.message || error);
  try {
    await mongoose.disconnect();
  } catch {
    /* ignore */
  }
  process.exit(1);
});
