const DIETARY_OPTIONS = ["None", "Vegetarian", "Vegan", "Gluten-Free", "Nut Allergy"];
const RSVP_STATUSES = ["Joyfully Accepts", "Regretfully Declines"];

export function normalizeSlug(slug) {
  return String(slug || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-]/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

export function validateSlug(slug) {
  const normalized = normalizeSlug(slug);
  if (!normalized || normalized.length < 3 || normalized.length > 60) {
    return "";
  }
  return normalized;
}

export function generateDefaultSlug(contactEmail, etsyOrderId) {
  const fromEmail = validateSlug(String(contactEmail || "").split("@")[0]);
  if (fromEmail) {
    return fromEmail;
  }

  const fromOrder = validateSlug(`order-${String(etsyOrderId || "").toLowerCase()}`);
  if (fromOrder) {
    return fromOrder;
  }

  return validateSlug(`wedding-${Date.now().toString(36)}`) || `evt-${Date.now().toString(36)}`.slice(0, 60);
}

export function normalizeTimeline(rawTimeline) {
  if (!Array.isArray(rawTimeline)) {
    return [];
  }
  return rawTimeline
    .map((item) => ({
      time: String(item?.time || "").trim(),
      title: String(item?.title || "").trim()
    }))
    .filter((item) => item.time && item.title);
}

export function normalizeSetupPayload(body) {
  const features = {
    includeTimeline: Boolean(body?.features?.includeTimeline),
    includeTransportation: Boolean(body?.features?.includeTransportation),
    includeAccommodation: Boolean(body?.features?.includeAccommodation)
  };

  const event = {
    eventType: String(body?.eventType || "wedding").trim() || "wedding",
    hostNames: String(body?.hostNames || "").trim(),
    introText: String(body?.introText || "").trim(),
    celebrationText: String(body?.celebrationText || "").trim(),
    eventDateFormatted: String(body?.eventDateFormatted || "").trim(),
    eventTime: String(body?.eventTime || "").trim(),
    countdownTargetDate: String(body?.countdownTargetDate || "").trim(),
    images: {
      heroBg: String(body?.images?.heroBg || "/images/floral-bg.png").trim(),
      countdownBg: String(body?.images?.countdownBg || "/images/coral-floral-bg.png").trim(),
      rsvpBg: String(body?.images?.rsvpBg || "/images/pink-sprig-bg.png").trim(),
      timelineBanner: String(body?.images?.timelineBanner || "").trim(),
      venueBanner: String(body?.images?.venueBanner || "").trim(),
      accommodationBanner: String(body?.images?.accommodationBanner || "").trim()
    },
    timeline: features.includeTimeline ? normalizeTimeline(body?.timeline) : [],
    venue: {
      name: String(body?.venue?.name || "").trim(),
      description: String(body?.venue?.description || "").trim(),
      address: String(body?.venue?.address || "").trim(),
      mapsLink: String(body?.venue?.mapsLink || "").trim()
    },
    details: {
      dressCode: String(body?.details?.dressCode || "").trim(),
      transportation: features.includeTransportation
        ? String(body?.details?.transportation || "").trim()
        : "",
      accommodationTitle: features.includeAccommodation
        ? String(body?.details?.accommodationTitle || "").trim()
        : "",
      accommodationSubtitle: features.includeAccommodation
        ? String(body?.details?.accommodationSubtitle || "").trim()
        : "",
      accommodationBody: features.includeAccommodation
        ? String(body?.details?.accommodationBody || "").trim()
        : ""
    },
    rsvpSettings: {
      deadlineText: String(body?.rsvpSettings?.deadlineText || "").trim(),
      registryLink: String(body?.rsvpSettings?.registryLink || "").trim()
    },
    features
  };

  return {
    etsyOrderId: String(body?.etsyOrderId || "").trim(),
    contactEmail: String(body?.contactEmail || "").trim().toLowerCase(),
    slug: validateSlug(body?.slug) || generateDefaultSlug(body?.contactEmail, body?.etsyOrderId),
    event
  };
}

export function validateSetupPayload(payload) {
  if (!payload.etsyOrderId) {
    return "Etsy order ID is required";
  }
  if (!payload.contactEmail || !payload.contactEmail.includes("@")) {
    return "A valid contact email is required";
  }
  if (!payload.slug) {
    return "Unable to generate a valid event URL slug";
  }
  return "";
}

export function normalizeEventUpdatePayload(body) {
  const features = {
    includeTimeline: Boolean(body?.features?.includeTimeline),
    includeTransportation: Boolean(body?.features?.includeTransportation),
    includeAccommodation: Boolean(body?.features?.includeAccommodation)
  };

  return {
    eventType: String(body?.eventType || "wedding").trim() || "wedding",
    hostNames: String(body?.hostNames || "").trim(),
    introText: String(body?.introText || "").trim(),
    celebrationText: String(body?.celebrationText || "").trim(),
    eventDateFormatted: String(body?.eventDateFormatted || "").trim(),
    eventTime: String(body?.eventTime || "").trim(),
    countdownTargetDate: String(body?.countdownTargetDate || "").trim(),
    images: {
      heroBg: String(body?.images?.heroBg || "/images/floral-bg.png").trim(),
      countdownBg: String(body?.images?.countdownBg || "/images/coral-floral-bg.png").trim(),
      rsvpBg: String(body?.images?.rsvpBg || "/images/pink-sprig-bg.png").trim(),
      timelineBanner: String(body?.images?.timelineBanner || "").trim(),
      venueBanner: String(body?.images?.venueBanner || "").trim(),
      accommodationBanner: String(body?.images?.accommodationBanner || "").trim()
    },
    timeline: features.includeTimeline ? normalizeTimeline(body?.timeline) : [],
    venue: {
      name: String(body?.venue?.name || "").trim(),
      description: String(body?.venue?.description || "").trim(),
      address: String(body?.venue?.address || "").trim(),
      mapsLink: String(body?.venue?.mapsLink || "").trim()
    },
    details: {
      dressCode: String(body?.details?.dressCode || "").trim(),
      transportation: features.includeTransportation
        ? String(body?.details?.transportation || "").trim()
        : "",
      accommodationTitle: features.includeAccommodation
        ? String(body?.details?.accommodationTitle || "").trim()
        : "",
      accommodationSubtitle: features.includeAccommodation
        ? String(body?.details?.accommodationSubtitle || "").trim()
        : "",
      accommodationBody: features.includeAccommodation
        ? String(body?.details?.accommodationBody || "").trim()
        : ""
    },
    rsvpSettings: {
      deadlineText: String(body?.rsvpSettings?.deadlineText || "").trim(),
      registryLink: String(body?.rsvpSettings?.registryLink || "").trim()
    },
    features
  };
}

export function toPublicEventPayload(user) {
  const event = user.event || {};
  const features = event.features || {};

  return {
    eventId: user._id,
    slug: user.slug,
    event_type: event.eventType || "wedding",
    host_names: event.hostNames || "Bride & Groom",
    intro_text: event.introText || "Together with their families",
    celebration_text: event.celebrationText || "Invite you to their wedding celebration",
    event_date_formatted: event.eventDateFormatted || "",
    event_time: event.eventTime || "",
    countdown_target_date: event.countdownTargetDate || "",
    images: {
      hero_bg: event.images?.heroBg || "/images/floral-bg.png",
      countdown_bg: event.images?.countdownBg || "/images/coral-floral-bg.png",
      rsvp_bg: event.images?.rsvpBg || "/images/pink-sprig-bg.png",
      timeline_banner: event.images?.timelineBanner || "",
      venue_banner: event.images?.venueBanner || "",
      accommodation_banner: event.images?.accommodationBanner || ""
    },
    timeline: features.includeTimeline ? event.timeline || [] : [],
    venue: {
      name: event.venue?.name || "Your Venue Name",
      description: event.venue?.description || "",
      address: event.venue?.address || "",
      maps_link: event.venue?.mapsLink || ""
    },
    details: {
      dress_code: event.details?.dressCode || "",
      transportation: features.includeTransportation ? event.details?.transportation || "" : "",
      accommodation_title: features.includeAccommodation ? event.details?.accommodationTitle || "" : "",
      accommodation_subtitle: features.includeAccommodation ? event.details?.accommodationSubtitle || "" : "",
      accommodation_body: features.includeAccommodation ? event.details?.accommodationBody || "" : ""
    },
    rsvp_settings: {
      deadline_text: event.rsvpSettings?.deadlineText || "",
      registry_link: event.rsvpSettings?.registryLink || ""
    },
    features: {
      include_timeline: Boolean(features.includeTimeline),
      include_transportation: Boolean(features.includeTransportation),
      include_accommodation: Boolean(features.includeAccommodation)
    }
  };
}

export function normalizeDietaryRestrictions(raw) {
  if (!Array.isArray(raw)) {
    return [];
  }
  const selected = raw
    .map((item) => String(item || "").trim())
    .filter((item) => DIETARY_OPTIONS.includes(item));
  if (selected.includes("None")) {
    return ["None"];
  }
  return [...new Set(selected)];
}

export function normalizeUsRsvpPayload(body) {
  const status = String(body?.status || "").trim();
  const normalizedStatus = RSVP_STATUSES.includes(status) ? status : "";

  return {
    fullName: String(body?.fullName || "").trim(),
    email: String(body?.email || "").trim().toLowerCase(),
    status: normalizedStatus,
    attendeesCount: Math.max(0, Number(body?.attendeesCount ?? 1)),
    dietaryRestrictions: normalizeDietaryRestrictions(body?.dietaryRestrictions),
    dietaryNotes: String(body?.dietaryNotes || "").trim()
  };
}

export function validateUsRsvpPayload(payload) {
  if (!payload.fullName) {
    return "Full name is required";
  }
  if (!payload.email || !payload.email.includes("@")) {
    return "A valid email is required";
  }
  if (!payload.status) {
    return "Attendance status is required";
  }
  if (payload.status === "Joyfully Accepts" && payload.attendeesCount < 1) {
    return "Number of guests must be at least 1 when accepting";
  }
  return "";
}

export { DIETARY_OPTIONS, RSVP_STATUSES };
