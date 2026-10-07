import Venue, { normalizeVenueName } from "../models/Venue.js";
import User from "../models/User.js";

export function serializeVenue(doc) {
  if (!doc) return null;
  const raw = typeof doc.toObject === "function" ? doc.toObject() : doc;
  return {
    id: String(raw._id),
    name: raw.name || "",
    city: raw.city || "",
    streetAndNumber: raw.streetAndNumber || "",
    usageCount: Number(raw.usageCount || 0)
  };
}

/**
 * Upsert a venue from event hall fields (admin create / invitation editor).
 */
export async function upsertVenueFromEventFields({ venueName, city, streetAndNumber } = {}) {
  const name = String(venueName || "").trim();
  if (!name) return null;
  const nameNormalized = normalizeVenueName(name);
  const cityTrim = String(city || "").trim();
  const streetTrim = String(streetAndNumber || "").trim();

  const existing = await Venue.findOne({ nameNormalized });
  if (existing) {
    existing.name = name;
    existing.usageCount = Number(existing.usageCount || 0) + 1;
    if (cityTrim) existing.city = cityTrim;
    if (streetTrim) existing.streetAndNumber = streetTrim;
    await existing.save();
    return serializeVenue(existing);
  }

  if (!cityTrim && !streetTrim) return null;

  const created = await Venue.create({
    name,
    nameNormalized,
    city: cityTrim,
    streetAndNumber: streetTrim,
    usageCount: 1
  });
  return serializeVenue(created);
}

/**
 * Search venues by name prefix/substring. Also backfills from User.event if catalog is thin.
 */
export async function searchVenues(query, { limit = 12 } = {}) {
  const q = String(query || "").trim();
  const take = Math.min(Math.max(Number(limit) || 12, 1), 30);

  if (q.length < 1) {
    const top = await Venue.find({})
      .sort({ usageCount: -1, name: 1 })
      .limit(take)
      .lean();
    return top.map(serializeVenue);
  }

  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const regex = new RegExp(escaped, "i");

  let rows = await Venue.find({
    $or: [{ name: regex }, { nameNormalized: regex }, { city: regex }]
  })
    .sort({ usageCount: -1, name: 1 })
    .limit(take)
    .lean();

  if (rows.length < take) {
    await backfillVenuesFromUsers(escaped);
    rows = await Venue.find({
      $or: [{ name: regex }, { nameNormalized: regex }, { city: regex }]
    })
      .sort({ usageCount: -1, name: 1 })
      .limit(take)
      .lean();
  }

  return rows.map(serializeVenue);
}

async function backfillVenuesFromUsers(nameRegexSource) {
  const regex = new RegExp(nameRegexSource, "i");
  const users = await User.find({
    "event.venueName": { $regex: regex },
    $or: [
      { "event.city": { $exists: true, $ne: "" } },
      { "event.streetAndNumber": { $exists: true, $ne: "" } }
    ]
  })
    .select("event.venueName event.city event.streetAndNumber")
    .limit(40)
    .lean();

  for (const user of users) {
    const event = user.event || {};
    await upsertVenueFromEventFields({
      venueName: event.venueName,
      city: event.city,
      streetAndNumber: event.streetAndNumber
    }).catch(() => {});
  }
}
