import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { normalizePhone, isSelfConfirmedSource } from "../utils/guestPhone.js";
import {
  extractGuestFieldsFromRow,
  hasUsablePhoneDigits,
  isValidIsraeliMobilePhone,
  makeFailedRow,
  makeWarningRow,
  NON_ISRAELI_PHONE_WARNING,
  processImportGuestBatch,
  validateImportGuestRow
} from "../utils/guestImport.js";
import { normalizeIlEventUpdatePayload } from "../utils/ilEvent.js";
import { applyCoverToEventPayload, clearEventCover, uploadAndAttachCover } from "../utils/eventCover.js";
import { coverUpload } from "../middleware/coverUpload.js";
import { isCoverStorageConfigured } from "../services/coverStorage.js";
import { sendBulkWhatsApp } from "../services/bulkWhatsAppService.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import ActivationCode from "../models/ActivationCode.js";
import { subscribeToDashboardEvents } from "../services/dashboardEvents.js";
import {
  buildGuestCreatedDescription,
  countGuestAuditLogsSince,
  listGuestAuditLogs,
  recordClientGuestUpdate,
  recordGuestAuditLog
} from "../services/guestAuditService.js";
import { resolveMaxPhoneRounds } from "../utils/phoneRounds.js";
import { coupleCanManageVendors, coupleHasEventManager } from "../utils/coupleVendors.js";
import {
  applyCouplePassword,
  normalizeLoginCredentials,
  normalizeLoginPassword,
  normalizeLoginUsername
} from "../utils/loginCredentials.js";
import {
  STATUS_HISTORY_LABELS,
  STATUS_HISTORY_SOURCES,
  initialStatusHistoryEntry,
  statusHistoryPushEntry
} from "../utils/guestStatusHistory.js";

const router = express.Router();

function mapRowToGuest(row) {
  const fields = extractGuestFieldsFromRow(row);
  return {
    fullName: fields.fullName,
    phone: fields.phone,
    attendeesCount: fields.attendeesCount,
    status: fields.status,
    giftAmount: 0,
    rowNumber: row?.rowNumber ?? row?.excelRowNumber ?? null
  };
}

function toGuestDoc(userId, mapped) {
  return {
    userId,
    fullName: mapped.fullName,
    phone: normalizePhone(mapped.phone),
    attendeesCount: mapped.attendeesCount,
    giftAmount: Math.max(0, Number(mapped.giftAmount || 0)),
    status: mapped.status,
    source: "excel",
    rowNumber: mapped.rowNumber ?? null
  };
}

function guestSnapshot(guest) {
  return {
    fullName: guest.fullName,
    attendeesCount: guest.attendeesCount,
    giftAmount: guest.giftAmount || 0,
    status: guest.status,
    source: guest.source
  };
}

function resolveSourceAfterExcelOverwrite(existingSource) {
  if (isSelfConfirmedSource(existingSource)) {
    return "excel_and_form";
  }
  return "excel";
}

router.post("/login", async (req, res) => {
  try {
    // Defense-in-depth: WhatsApp paste often includes trailing \n/\r on password.
    const { username, password } = normalizeLoginCredentials({
      username: req.body?.username,
      password: req.body?.password
    });
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    let isMatch = await bcrypt.compare(password, user.passwordHash);

    // Heal corrupted legacy hashes: if typed password matches stored plaintext
    // loginPassword (or username when used as passcode), re-hash from the clean string.
    if (!isMatch) {
      const healCandidates = [
        normalizeLoginPassword(user.loginPassword),
        normalizeLoginUsername(user.username)
      ].filter((value, index, arr) => value && arr.indexOf(value) === index);

      if (healCandidates.includes(password)) {
        await applyCouplePassword(user, password, bcrypt);
        await user.save();
        isMatch = true;
      }
    }

    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const hasEventManager = coupleHasEventManager(user);
    return res.json({
      userId: user._id,
      username: user.username,
      event: user.event,
      managedBy: user.managedBy || "admin",
      hasEventManager,
      /** Alias for product language: assigned event manager */
      eventManagerId: hasEventManager ? "assigned" : null,
      canManageVendors: coupleCanManageVendors(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/:userId/live-updates", async (req, res) => {
  try {
    const { userId } = req.params;
    const userExists = await User.exists({ _id: userId });
    if (!userExists) {
      return res.status(404).end();
    }

    res.setHeader("Content-Type", "text/event-stream");
    res.setHeader("Cache-Control", "no-cache, no-transform");
    res.setHeader("Connection", "keep-alive");
    res.setHeader("X-Accel-Buffering", "no");
    res.flushHeaders?.();
    res.write(`data: ${JSON.stringify({ type: "connected" })}\n\n`);

    const unsubscribe = subscribeToDashboardEvents(userId, (payload) => {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    });
    const heartbeat = setInterval(() => {
      res.write(": heartbeat\n\n");
    }, 25000);

    req.on("close", () => {
      clearInterval(heartbeat);
      unsubscribe();
    });
  } catch {
    return res.status(400).end();
  }
});

router.get("/:userId/audit-logs/unread-count", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const count = await countGuestAuditLogsSince({
      userId,
      since: req.query.since
    });
    return res.json({ count });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to count unread audit logs" });
  }
});

router.get("/:userId/audit-logs", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const result = await listGuestAuditLogs({
      userId,
      limit: req.query.limit,
      skip: req.query.skip,
      guestId: req.query.guestId
    });

    return res.json(result);
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to load audit logs" });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username deal.includedFeatures managedBy");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const guests = await Guest.find({ userId }).sort({ createdAt: -1 });

    const summary = guests.reduce(
      (acc, guest) => {
        const count = Math.max(0, Number(guest.attendeesCount || 0));
        acc.totalInvited += count;
        if (guest.status === "מגיע" || guest.status === "הגיע לאירוע") {
          acc.totalComing += count;
        } else if (guest.status === "לא מגיע") {
          acc.totalNotComing += count;
        } else if (guest.status === "אולי") {
          acc.totalMaybe += count;
        } else {
          acc.totalUnknown += count;
        }
        return acc;
      },
      {
        totalInvited: 0,
        totalComing: 0,
        totalNotComing: 0,
        totalMaybe: 0,
        totalUnknown: 0
      }
    );

    const event = user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) };
    event.maxPhoneRounds = resolveMaxPhoneRounds(user);

    const hasEventManager = coupleHasEventManager(user);
    return res.json({
      summary,
      guests,
      event,
      username: user.username,
      managedBy: user.managedBy || "admin",
      hasEventManager,
      eventManagerId: hasEventManager ? "assigned" : null,
      canManageVendors: coupleCanManageVendors(user)
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.post("/:userId/guests/manual", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, attendeesCount, status, giftAmount, confirmReplace } = req.body;

    if (!fullName || !phone || !status) {
      return res.status(400).json({ message: "Missing required fields" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const normalizedPhone = normalizePhone(phone);
    if (!normalizedPhone) {
      return res.status(400).json({ message: "Invalid phone number" });
    }

    const existing = await Guest.findOne({ userId, phone: normalizedPhone });
    if (existing) {
      if (!confirmReplace) {
        return res.status(409).json({
          code: "duplicate_guest",
          message: "המוזמן כבר קיים במערכת",
          existing: guestSnapshot(existing),
          incoming: {
            fullName: fullName.trim(),
            attendeesCount: Number(attendeesCount || 1),
            giftAmount: Math.max(0, Number(giftAmount || 0)),
            status
          }
        });
      }

      const updateOps = {
        $set: {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Number(attendeesCount || 1),
          giftAmount: Math.max(0, Number(giftAmount || 0)),
          status,
          source: "manual"
        }
      };
      const historyEntry = statusHistoryPushEntry({
        previousStatus: existing.status,
        nextStatus: status,
        updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.MANUAL],
        source: STATUS_HISTORY_SOURCES.MANUAL
      });
      if (historyEntry) {
        updateOps.$push = { statusHistory: historyEntry };
      }
      const guest = await Guest.findByIdAndUpdate(existing._id, updateOps, {
        new: true,
        runValidators: true
      });
      await recordClientGuestUpdate({
        userId,
        before: existing,
        after: guest,
        channel: "dashboard"
      });
      return res.json({ message: "Guest updated", guest, replaced: true });
    }

    const guest = await Guest.create({
      userId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Number(attendeesCount || 1),
      giftAmount: Math.max(0, Number(giftAmount || 0)),
      status,
      source: "manual",
      statusHistory: [
        initialStatusHistoryEntry({
          status,
          updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.MANUAL],
          source: STATUS_HISTORY_SOURCES.MANUAL
        })
      ]
    });

    await recordGuestAuditLog({
      userId,
      guestId: guest._id,
      guestName: guest.fullName,
      guestPhone: guest.phone,
      actor: "client",
      channel: "dashboard",
      action: "guest_created",
      description: buildGuestCreatedDescription(guest),
      metadata: {},
      changes: {
        status: { to: guest.status },
        attendeesCount: { to: guest.attendeesCount }
      }
    });

    return res.status(201).json({ message: "Guest added", guest });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add guest" });
  }
});

router.post("/:userId/guests/contacts-import", async (req, res) => {
  try {
    const { userId } = req.params;
    const guestsPayload = Array.isArray(req.body?.guests) ? req.body.guests : [];
    const replacePhones = new Set(
      (Array.isArray(req.body?.replacePhones) ? req.body.replacePhones : [])
        .map((phone) => normalizePhone(phone))
        .filter(Boolean)
    );
    if (!guestsPayload.length) {
      return res.status(400).json({ message: "יש לבחור לפחות איש קשר אחד לייבוא" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const inserted = [];
    const replaced = [];
    const skipped = [];
    const failed = [];
    const seenPhones = new Set();

    for (const raw of guestsPayload) {
      const fullName = String(raw?.fullName || "").trim();
      const normalizedPhone = normalizePhone(raw?.phone);
      const guestGroup = String(raw?.guestGroup || "").trim();
      const attendeesCount = Math.max(1, Number(raw?.attendeesCount) || 1);

      if (!fullName || !normalizedPhone) {
        failed.push({ fullName, phone: raw?.phone || "", reason: "חסר שם או טלפון תקין" });
        continue;
      }

      if (!isValidIsraeliMobilePhone(normalizedPhone) && !hasUsablePhoneDigits(normalizedPhone)) {
        failed.push({ fullName, phone: normalizedPhone, reason: "מספר טלפון לא תקין" });
        continue;
      }

      if (seenPhones.has(normalizedPhone)) {
        skipped.push({ fullName, phone: normalizedPhone, reason: "כפילות ברשימת הייבוא" });
        continue;
      }
      seenPhones.add(normalizedPhone);

      const existing = await Guest.findOne({ userId, phone: normalizedPhone });
      if (existing) {
        if (!replacePhones.has(normalizedPhone)) {
          skipped.push({
            fullName,
            phone: normalizedPhone,
            reason: "קיים במערכת",
            existingId: String(existing._id)
          });
          continue;
        }

        try {
          const updateOps = {
            $set: {
              fullName,
              phone: normalizedPhone,
              attendeesCount,
              giftAmount: 0,
              status: "לא ידוע",
              source: "contacts",
              guestGroup: guestGroup || existing.guestGroup || ""
            }
          };
          const historyEntry = statusHistoryPushEntry({
            previousStatus: existing.status,
            nextStatus: "לא ידוע",
            updatedBy: "הזוג (ייבוא מאנשי קשר)",
            source: STATUS_HISTORY_SOURCES.EXCEL
          });
          if (historyEntry) {
            updateOps.$push = { statusHistory: historyEntry };
          }

          const guest = await Guest.findByIdAndUpdate(existing._id, updateOps, {
            new: true,
            runValidators: true
          });
          await recordClientGuestUpdate({
            userId,
            before: existing,
            after: guest,
            channel: "import"
          });
          replaced.push(guest);
        } catch (updateError) {
          failed.push({
            fullName,
            phone: normalizedPhone,
            reason: updateError.message || "החלפה נכשלה"
          });
        }
        continue;
      }

      try {
        const guest = await Guest.create({
          userId,
          fullName,
          phone: normalizedPhone,
          attendeesCount,
          giftAmount: 0,
          status: "לא ידוע",
          source: "contacts",
          guestGroup: "",
          statusHistory: [
            initialStatusHistoryEntry({
              status: "לא ידוע",
              updatedBy: "הזוג (ייבוא מאנשי קשר)",
              source: STATUS_HISTORY_SOURCES.EXCEL
            })
          ]
        });

        await recordGuestAuditLog({
          userId,
          guestId: guest._id,
          guestName: guest.fullName,
          guestPhone: guest.phone,
          actor: "client",
          channel: "import",
          action: "guest_created",
          description: buildGuestCreatedDescription(guest),
          metadata: { source: "contacts" },
          changes: {
            status: { to: guest.status },
            attendeesCount: { to: guest.attendeesCount }
          }
        });

        inserted.push(guest);
      } catch (createError) {
        failed.push({
          fullName,
          phone: normalizedPhone,
          reason: createError.message || "שמירה נכשלה"
        });
      }
    }

    return res.status(201).json({
      message: `יובאו ${inserted.length} מוזמנים מאנשי קשר${replaced.length ? `, הוחלפו ${replaced.length}` : ""}`,
      insertedCount: inserted.length,
      replacedCount: replaced.length,
      skippedCount: skipped.length,
      failedCount: failed.length,
      skipped,
      failed,
      guests: inserted,
      replacedGuests: replaced
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "ייבוא מאנשי קשר נכשל" });
  }
});

router.post("/:userId/guests/import/precheck", async (req, res) => {
  try {
    const { userId } = req.params;
    const { guests } = req.body;

    if (!Array.isArray(guests) || guests.length === 0) {
      return res.status(400).json({ message: "Guests array is required" });
    }

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const { totalCount, validGuests, failedRows, warningRows } = processImportGuestBatch(guests);

    if (totalCount === 0) {
      return res.status(400).json({
        message: "No valid guests to import",
        success: false,
        uploadedCount: 0,
        totalCount: 0,
        failedRows: [],
        warningRows: []
      });
    }

    if (validGuests.length === 0) {
      return res.json({
        message: "Precheck completed — no valid rows",
        success: true,
        totalCount,
        totalRows: 0,
        conflictCount: 0,
        newCount: 0,
        conflicts: [],
        newGuests: [],
        failedRows,
        warningRows
      });
    }

    const phones = [...new Set(validGuests.map((guest) => guest.phone))];
    const existingGuests = await Guest.find({ userId, phone: { $in: phones } });
    const existingByPhone = new Map(existingGuests.map((guest) => [guest.phone, guest]));

    const newGuests = [];
    const conflicts = [];

    for (const guest of validGuests) {
      const existing = existingByPhone.get(guest.phone);
      const doc = toGuestDoc(userId, guest);
      if (existing) {
        conflicts.push({
          guestId: existing._id,
          phone: doc.phone,
          rowNumber: guest.rowNumber,
          existing: guestSnapshot(existing),
          excel: {
            fullName: doc.fullName,
            attendeesCount: doc.attendeesCount,
            status: doc.status,
            rowNumber: guest.rowNumber
          }
        });
      } else {
        newGuests.push(doc);
      }
    }

    return res.json({
      message: "Precheck completed",
      success: true,
      totalCount,
      totalRows: validGuests.length,
      conflictCount: conflicts.length,
      newCount: newGuests.length,
      conflicts,
      newGuests,
      failedRows,
      warningRows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to precheck import" });
  }
});

router.post("/:userId/guests/import", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newGuests, resolutions, totalCount: clientTotalCount, failedRows: clientFailedRows, warningRows: clientWarningRows } =
      req.body;

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const failedRows = Array.isArray(clientFailedRows)
      ? clientFailedRows.map((item) => makeFailedRow(item.rowNumber, item.name, item.reason))
      : [];
    const warningRows = Array.isArray(clientWarningRows)
      ? clientWarningRows.map((item) => makeWarningRow(item.rowNumber, item.name, item.reason))
      : [];

    let insertedCount = 0;
    const guestsToInsert = Array.isArray(newGuests) ? newGuests : [];
    const seenInsertPhones = new Set();

    for (const row of guestsToInsert) {
      const rowNumber = row?.rowNumber ?? row?.excelRowNumber ?? null;
      let doc;
      if (row?.phone && row?.fullName) {
        const normalized = normalizePhone(row.phone);
        doc = {
          userId,
          fullName: String(row.fullName).trim(),
          phone: normalized || String(row.phone).replace(/\D/g, ""),
          attendeesCount: Math.max(1, Number(row.attendeesCount || 1)),
          giftAmount: Math.max(0, Number(row.giftAmount || 0)),
          status: row.status || "לא ידוע",
          source: "excel"
        };
      } else {
        const validated = validateImportGuestRow(row, rowNumber);
        if (validated.empty) continue;
        if (validated.fail) {
          failedRows.push(validated.fail);
          continue;
        }
        if (validated.warning) warningRows.push(validated.warning);
        doc = toGuestDoc(userId, validated.guest);
      }

      if (!doc.fullName) {
        failedRows.push(makeFailedRow(rowNumber, "", "שם חסר בקובץ"));
        continue;
      }
      if (!doc.phone || !hasUsablePhoneDigits(doc.phone)) {
        failedRows.push(makeFailedRow(rowNumber, doc.fullName, "מספר טלפון לא ניתן לזיהוי"));
        continue;
      }
      if (!isValidIsraeliMobilePhone(doc.phone)) {
        warningRows.push(makeWarningRow(rowNumber, doc.fullName, NON_ISRAELI_PHONE_WARNING));
      }
      if (seenInsertPhones.has(doc.phone)) {
        failedRows.push(
          makeFailedRow(rowNumber, doc.fullName, "מספר טלפון כבר קיים במערכת (כפילות)")
        );
        continue;
      }

      const exists = await Guest.findOne({ userId, phone: doc.phone }).select("_id fullName");
      if (exists) {
        failedRows.push(
          makeFailedRow(rowNumber, doc.fullName, "מספר טלפון כבר קיים במערכת (כפילות)")
        );
        continue;
      }

      try {
        await Guest.create({
          ...doc,
          statusHistory: [
            initialStatusHistoryEntry({
              status: doc.status || "לא ידוע",
              updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.EXCEL],
              source: STATUS_HISTORY_SOURCES.EXCEL
            })
          ]
        });
        seenInsertPhones.add(doc.phone);
        insertedCount += 1;
      } catch (createError) {
        failedRows.push(
          makeFailedRow(rowNumber, doc.fullName, createError.message || "שמירת הרשומה נכשלה")
        );
      }
    }

    let updatedCount = 0;
    let keptExistingCount = 0;
    const resolutionList = Array.isArray(resolutions) ? resolutions : [];

    for (const resolution of resolutionList) {
      if (resolution?.choice === "keep_existing") {
        keptExistingCount += 1;
        continue;
      }
      if (resolution?.choice !== "use_excel") continue;
      const phone = normalizePhone(resolution.phone);
      const excelRow = resolution.excel || resolution.excelData;
      const rowNumber = excelRow?.rowNumber ?? resolution.rowNumber ?? null;
      if (!phone || !excelRow) {
        failedRows.push(makeFailedRow(rowNumber, "", "חסרים פרטי עדכון מהאקסל"));
        continue;
      }

      const validated = validateImportGuestRow(
        {
          fullName: excelRow.fullName,
          phone: excelRow.phone || phone,
          attendeesCount: excelRow.attendeesCount,
          status: excelRow.status,
          rowNumber
        },
        rowNumber
      );

      if (validated.fail) {
        failedRows.push(validated.fail);
        continue;
      }

      const doc = toGuestDoc(userId, validated.guest || mapRowToGuest(excelRow));
      const existing = await Guest.findOne({ userId, phone });
      if (!existing) {
        failedRows.push(
          makeFailedRow(rowNumber, doc.fullName, "לא נמצאה רשומה קיימת לעדכון")
        );
        continue;
      }

      try {
        const updateOps = {
          $set: {
            fullName: doc.fullName,
            attendeesCount: doc.attendeesCount,
            giftAmount: Math.max(0, Number(doc.giftAmount || 0)),
            status: doc.status,
            source: resolveSourceAfterExcelOverwrite(existing.source)
          }
        };
        const historyEntry = statusHistoryPushEntry({
          previousStatus: existing.status,
          nextStatus: doc.status,
          updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.EXCEL],
          source: STATUS_HISTORY_SOURCES.EXCEL
        });
        if (historyEntry) {
          updateOps.$push = { statusHistory: historyEntry };
        }
        const updatedGuest = await Guest.findByIdAndUpdate(existing._id, updateOps, {
          new: true,
          runValidators: true
        });
        if (updatedGuest) {
          await recordClientGuestUpdate({
            userId,
            before: existing,
            after: updatedGuest,
            channel: "import"
          });
        }
        updatedCount += 1;
      } catch (updateError) {
        failedRows.push(
          makeFailedRow(rowNumber, doc.fullName, updateError.message || "עדכון הרשומה נכשל")
        );
      }
    }

    const uploadedCount = insertedCount + updatedCount + keptExistingCount;
    const totalCount =
      Number(clientTotalCount) > 0
        ? Number(clientTotalCount)
        : uploadedCount + failedRows.length;

    failedRows.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));
    warningRows.sort((a, b) => (a.rowNumber || 0) - (b.rowNumber || 0));

    // Deduplicate soft warnings by row+reason
    const uniqueWarnings = [];
    const seenWarnings = new Set();
    for (const item of warningRows) {
      const key = `${item.rowNumber}|${item.name}|${item.reason}`;
      if (seenWarnings.has(key)) continue;
      seenWarnings.add(key);
      uniqueWarnings.push(item);
    }

    return res.status(201).json({
      success: true,
      message: "Guests import saved",
      uploadedCount,
      insertedCount,
      updatedCount,
      keptExistingCount,
      totalCount,
      failedRows,
      warningRows: uniqueWarnings
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to import guests" });
  }
});

router.patch("/:userId/guests/:guestId", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { fullName, attendeesCount, status, giftAmount, phone } = req.body;

    const update = {};
    if (typeof fullName !== "undefined") {
      const trimmed = String(fullName).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "שם מלא הוא שדה חובה" });
      }
      update.fullName = trimmed;
    }
    if (typeof phone !== "undefined") {
      const normalizedPhone = normalizePhone(phone);
      if (!normalizedPhone) {
        return res.status(400).json({ message: "מספר טלפון לא תקין" });
      }
      const duplicate = await Guest.findOne({
        userId,
        phone: normalizedPhone,
        _id: { $ne: guestId }
      }).select("_id");
      if (duplicate) {
        return res.status(400).json({ message: "מספר הטלפון כבר קיים ברשימת המוזמנים" });
      }
      update.phone = normalizedPhone;
    }
    if (typeof attendeesCount !== "undefined") {
      update.attendeesCount = Math.max(0, Number(attendeesCount));
    }
    if (typeof giftAmount !== "undefined") {
      update.giftAmount = Math.max(0, Number(giftAmount));
    }
    if (typeof req.body.guestSide !== "undefined") {
      const side = String(req.body.guestSide || "").trim();
      if (["חתן", "כלה", "משותף", ""].includes(side)) {
        update.guestSide = side;
      }
    }
    if (typeof req.body.guestGroup !== "undefined") {
      update.guestGroup = String(req.body.guestGroup || "").trim();
    }
    if (typeof req.body.seatingTableId !== "undefined") {
      update.seatingTableId = String(req.body.seatingTableId || "").trim();
    }
    if (typeof status !== "undefined") {
      if (!["מגיע", "לא מגיע", "אולי", "לא ידוע", "הגיע לאירוע"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      update.status = status;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const existingGuest = await Guest.findOne({ _id: guestId, userId });
    if (!existingGuest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    if (typeof status !== "undefined") {
      if (status === "לא מגיע" && (update.seatingTableId || existingGuest.seatingTableId)) {
        update.declinedWhileSeatedAt = new Date();
      } else if (status !== "לא מגיע") {
        update.declinedWhileSeatedAt = null;
      }
    }

    const updateOps = { $set: update };
    if (typeof status !== "undefined") {
      const historyEntry = statusHistoryPushEntry({
        previousStatus: existingGuest.status,
        nextStatus: status,
        updatedBy: STATUS_HISTORY_LABELS[STATUS_HISTORY_SOURCES.COUPLE],
        source: STATUS_HISTORY_SOURCES.COUPLE
      });
      if (historyEntry) {
        updateOps.$push = { statusHistory: historyEntry };
      }
    }

    const guest = await Guest.findOneAndUpdate({ _id: guestId, userId }, updateOps, {
      new: true,
      runValidators: true
    });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    await recordClientGuestUpdate({
      userId,
      before: existingGuest,
      after: guest,
      channel: "dashboard"
    });

    return res.json({ message: "Guest updated", guest });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update guest", error: error.message });
  }
});

router.delete("/:userId/guests/:guestId", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const guest = await Guest.findOneAndDelete({ _id: guestId, userId });
    if (!guest) {
      return res.status(404).json({ message: "המוזמן לא נמצא" });
    }
    return res.json({ message: "המוזמן נמחק", deletedCount: 1, guestId });
  } catch (error) {
    return res.status(500).json({ message: "מחיקת המוזמן נכשלה", error: error.message });
  }
});

router.post("/:userId/guests/bulk-delete", async (req, res) => {
  try {
    const { userId } = req.params;
    const guestIds = Array.isArray(req.body?.guestIds) ? req.body.guestIds : [];
    if (!guestIds.length) {
      return res.status(400).json({ message: "יש לבחור לפחות מוזמן אחד למחיקה" });
    }

    const result = await Guest.deleteMany({ userId, _id: { $in: guestIds } });
    return res.json({
      message: `נמחקו ${result.deletedCount} מוזמנים`,
      deletedCount: result.deletedCount
    });
  } catch (error) {
    return res.status(500).json({ message: "מחיקה מרובה נכשלה", error: error.message });
  }
});

router.get("/:userId/whatsapp/quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const now = new Date();
    const codes = await ActivationCode.find({
      redeemedByUserId: userId,
      isActive: true,
      remaining_credits: { $gt: 0 },
      $or: [{ expiresAt: null }, { expiresAt: { $gt: now } }]
    })
      .sort({ createdAt: -1 })
      .select("code total_credits remaining_credits createdAt expiresAt");

    const quotas = codes.map((item) => ({
      code: item.code,
      total_credits: item.total_credits,
      remaining_credits: item.remaining_credits,
      createdAt: item.createdAt,
      expiresAt: item.expiresAt || null
    }));
    const usable = quotas;

    return res.json({
      quota: usable[0] || null,
      quotas
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load WhatsApp quota", error: error.message });
  }
});

router.post("/:userId/whatsapp/bulk-send", async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentCode, guestIds } = req.body;

    const user = await User.findById(userId).select(
      "event deal.includedFeatures.isPremiumWhatsappButtonsEnabled"
    );
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (!Array.isArray(guestIds) || guestIds.length === 0) {
      return res.status(400).json({ message: "יש לבחור לפחות מוזמן אחד לשליחה" });
    }

    const guests = await Guest.find({ userId, _id: { $in: guestIds } });
    if (guests.length !== guestIds.length) {
      return res.status(400).json({ message: "חלק מהמוזמנים שנבחרו לא נמצאו ברשימה" });
    }

    const event = user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) };
    event.isPremiumWhatsappButtonsEnabled =
      user.event?.isPremiumWhatsappButtonsEnabled === true ||
      user.deal?.includedFeatures?.isPremiumWhatsappButtonsEnabled === true;

    const origin = getClientBaseUrl(req);
    const result = await sendBulkWhatsApp({
      paymentCode,
      guests,
      event,
      userId,
      origin
    });

    return res.status(result.status).json(result.body);
  } catch (error) {
    console.error("Bulk WhatsApp route error:", error?.message || error);
    return res.status(500).json({
      success: false,
      message: "שגיאה פנימית בשליחת ההודעות, אנא נסה שוב מאוחר יותר."
    });
  }
});

router.patch("/:userId/whatsapp-invite-copy", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    if (!user.event) {
      user.event = {};
    }

    if (Object.prototype.hasOwnProperty.call(req.body || {}, "welcomeParagraph")) {
      user.event.welcomeParagraph = String(req.body.welcomeParagraph ?? "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "eventDetailsParagraph")) {
      user.event.eventDetailsParagraph = String(req.body.eventDetailsParagraph ?? "").trim();
    }
    if (Object.prototype.hasOwnProperty.call(req.body || {}, "closingParagraph")) {
      user.event.closingParagraph = String(req.body.closingParagraph ?? "").trim();
    }

    user.markModified("event");
    await user.save();

    return res.json({
      message: "נוסח הוואטסאפ נשמר",
      event: {
        welcomeParagraph: user.event.welcomeParagraph || "",
        eventDetailsParagraph: user.event.eventDetailsParagraph || "",
        closingParagraph: user.event.closingParagraph || ""
      }
    });
  } catch (error) {
    return res.status(500).json({ message: "שמירת נוסח הוואטסאפ נכשלה", error: error.message });
  }
});

router.put("/:userId/event", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const previous = user.event?.toObject ? user.event.toObject() : { ...(user.event || {}) };
    const next = normalizeIlEventUpdatePayload(req.body);
    const withCover = await applyCoverToEventPayload(next, previous, {
      clearCover: req.body?.clearCover === true
    });
    user.event = {
      ...withCover,
      maxPhoneRounds: Number(previous.maxPhoneRounds) || 0,
      isPremiumWhatsappButtonsEnabled: Boolean(previous.isPremiumWhatsappButtonsEnabled),
      welcomeParagraph: previous.welcomeParagraph || "",
      eventDetailsParagraph: previous.eventDetailsParagraph || "",
      closingParagraph: previous.closingParagraph || ""
    };
    await user.save();

    return res.json({
      message: "פרטי ההזמנה עודכנו בהצלחה",
      event: user.event
    });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "שמירת ההזמנה נכשלה" });
  }
});

router.post("/:userId/event/cover", coverUpload.single("cover"), async (req, res) => {
  try {
    if (!isCoverStorageConfigured()) {
      return res.status(503).json({
        message:
          "אחסון תמונות לא מוגדר. יש להגדיר CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY ו-CLOUDINARY_API_SECRET"
      });
    }
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const cover = await uploadAndAttachCover(user, req.file);
    return res.json({ message: "תמונת הקאבר הועלתה בהצלחה", cover, event: user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "העלאת התמונה נכשלה" });
  }
});

router.delete("/:userId/event/cover", async (req, res) => {
  try {
    const user = await User.findById(req.params.userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    await clearEventCover(user);
    return res.json({ message: "תמונת הקאבר הוסרה", event: user.event });
  } catch (error) {
    return res.status(error.status || 400).json({ message: error.message || "מחיקת התמונה נכשלה" });
  }
});

export default router;
