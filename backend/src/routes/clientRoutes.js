import express from "express";
import bcrypt from "bcryptjs";
import User from "../models/User.js";
import Guest from "../models/Guest.js";
import { normalizePhone, isSelfConfirmedSource } from "../utils/guestPhone.js";
import {
  extractGuestFieldsFromRow,
  makeFailedRow,
  processImportGuestBatch,
  validateImportGuestRow
} from "../utils/guestImport.js";
import { normalizeIlEventUpdatePayload } from "../utils/ilEvent.js";
import { sendBulkWhatsApp } from "../services/bulkWhatsAppService.js";
import { getClientBaseUrl } from "../utils/clientUrl.js";
import ActivationCode from "../models/ActivationCode.js";

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
    const { username, password } = req.body;
    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required" });
    }

    const user = await User.findOne({ username: username.trim() });
    if (!user) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    const isMatch = await bcrypt.compare(password, user.passwordHash);
    if (!isMatch) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    return res.json({
      userId: user._id,
      username: user.username,
      event: user.event
    });
  } catch (error) {
    return res.status(500).json({ message: "Login failed", error: error.message });
  }
});

router.get("/:userId/guests", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("event username");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }
    const guests = await Guest.find({ userId }).sort({ createdAt: -1 });

    const summary = guests.reduce(
      (acc, guest) => {
        const count = Math.max(0, Number(guest.attendeesCount || 0));
        acc.totalInvited += count;
        if (guest.status === "מגיע") {
          acc.totalComing += count;
        } else if (guest.status === "לא מגיע") {
          acc.totalNotComing += count;
        } else {
          acc.totalMaybe += count;
        }
        return acc;
      },
      { totalInvited: 0, totalComing: 0, totalNotComing: 0, totalMaybe: 0 }
    );

    return res.json({ summary, guests, event: user.event, username: user.username });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load guests", error: error.message });
  }
});

router.post("/:userId/guests/manual", async (req, res) => {
  try {
    const { userId } = req.params;
    const { fullName, phone, attendeesCount, status, giftAmount } = req.body;

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
      if (isSelfConfirmedSource(existing.source)) {
        return res.status(409).json({
          message: "מוזמן עם מספר טלפון זה כבר אישר הגעה בעצמו במערכת"
        });
      }
      const guest = await Guest.findByIdAndUpdate(
        existing._id,
        {
          fullName: fullName.trim(),
          phone: normalizedPhone,
          attendeesCount: Number(attendeesCount || 1),
          giftAmount: Math.max(0, Number(giftAmount || 0)),
          status,
          source: "manual"
        },
        { new: true, runValidators: true }
      );
      return res.json({ message: "Guest updated", guest });
    }

    const guest = await Guest.create({
      userId,
      fullName: fullName.trim(),
      phone: normalizedPhone,
      attendeesCount: Number(attendeesCount || 1),
      giftAmount: Math.max(0, Number(giftAmount || 0)),
      status,
      source: "manual"
    });

    return res.status(201).json({ message: "Guest added", guest });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to add guest" });
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

    const { totalCount, validGuests, failedRows } = processImportGuestBatch(guests);

    if (totalCount === 0) {
      return res.status(400).json({
        message: "No valid guests to import",
        success: false,
        uploadedCount: 0,
        totalCount: 0,
        failedRows: []
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
        failedRows
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
      failedRows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to precheck import" });
  }
});

router.post("/:userId/guests/import", async (req, res) => {
  try {
    const { userId } = req.params;
    const { newGuests, resolutions, totalCount: clientTotalCount, failedRows: clientFailedRows } = req.body;

    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const failedRows = Array.isArray(clientFailedRows)
      ? clientFailedRows.map((item) =>
          makeFailedRow(item.rowNumber, item.name, item.reason)
        )
      : [];

    let insertedCount = 0;
    const guestsToInsert = Array.isArray(newGuests) ? newGuests : [];
    const seenInsertPhones = new Set();

    for (const row of guestsToInsert) {
      const rowNumber = row?.rowNumber ?? row?.excelRowNumber ?? null;
      let doc;
      if (row?.phone && row?.fullName) {
        doc = {
          userId,
          fullName: String(row.fullName).trim(),
          phone: normalizePhone(row.phone),
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
        doc = toGuestDoc(userId, validated.guest);
      }

      if (!doc.fullName) {
        failedRows.push(makeFailedRow(rowNumber, "", "שם חסר בקובץ"));
        continue;
      }
      if (!doc.phone || !/^05\d{8}$/.test(doc.phone)) {
        failedRows.push(makeFailedRow(rowNumber, doc.fullName, "מספר טלפון לא תקין"));
        continue;
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
        await Guest.create(doc);
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
        await Guest.findByIdAndUpdate(
          existing._id,
          {
            fullName: doc.fullName,
            attendeesCount: doc.attendeesCount,
            giftAmount: Math.max(0, Number(doc.giftAmount || 0)),
            status: doc.status,
            source: resolveSourceAfterExcelOverwrite(existing.source)
          },
          { runValidators: true }
        );
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

    return res.status(201).json({
      success: true,
      message: "Guests import saved",
      uploadedCount,
      insertedCount,
      updatedCount,
      keptExistingCount,
      totalCount,
      failedRows
    });
  } catch (error) {
    return res.status(500).json({ message: error.message || "Failed to import guests" });
  }
});

router.patch("/:userId/guests/:guestId", async (req, res) => {
  try {
    const { userId, guestId } = req.params;
    const { fullName, attendeesCount, status, giftAmount } = req.body;

    const update = {};
    if (typeof fullName !== "undefined") {
      const trimmed = String(fullName).trim();
      if (!trimmed) {
        return res.status(400).json({ message: "שם מלא הוא שדה חובה" });
      }
      update.fullName = trimmed;
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
      if (!["מגיע", "לא מגיע", "אולי", "לא ידוע"].includes(status)) {
        return res.status(400).json({ message: "Invalid status" });
      }
      update.status = status;
    }
    if (!Object.keys(update).length) {
      return res.status(400).json({ message: "No fields to update" });
    }

    const guest = await Guest.findOneAndUpdate({ _id: guestId, userId }, update, {
      new: true,
      runValidators: true
    });
    if (!guest) {
      return res.status(404).json({ message: "Guest not found" });
    }

    return res.json({ message: "Guest updated", guest });
  } catch (error) {
    return res.status(500).json({ message: "Failed to update guest", error: error.message });
  }
});

router.get("/:userId/whatsapp/quota", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId).select("_id");
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    const codeRecord = await ActivationCode.findOne({
      redeemedByUserId: userId,
      isActive: true
    }).sort({ updatedAt: -1 });

    return res.json({
      quota: codeRecord
        ? {
            code: codeRecord.code,
            total_credits: codeRecord.total_credits,
            remaining_credits: codeRecord.remaining_credits
          }
        : null
    });
  } catch (error) {
    return res.status(500).json({ message: "Failed to load WhatsApp quota", error: error.message });
  }
});

router.post("/:userId/whatsapp/bulk-send", async (req, res) => {
  try {
    const { userId } = req.params;
    const { paymentCode, guestIds, customMessage } = req.body;

    const user = await User.findById(userId).select("event");
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

    const origin = getClientBaseUrl(req);
    const result = await sendBulkWhatsApp({
      paymentCode,
      guests,
      customMessage,
      event: user.event,
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

router.put("/:userId/event", async (req, res) => {
  try {
    const { userId } = req.params;
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "Client not found" });
    }

    user.event = normalizeIlEventUpdatePayload(req.body);
    await user.save();

    return res.json({
      message: "פרטי ההזמנה עודכנו בהצלחה",
      event: user.event
    });
  } catch (error) {
    return res.status(400).json({ message: error.message || "שמירת ההזמנה נכשלה" });
  }
});

export default router;
