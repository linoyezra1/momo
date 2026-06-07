const emptyTimelineItem = { time: "", title: "" };

function pad2(value) {
  return String(value).padStart(2, "0");
}

export function isoToDatetimeLocal(iso) {
  if (!iso) return "";
  const parsed = new Date(iso);
  if (Number.isNaN(parsed.getTime())) return "";
  return `${parsed.getFullYear()}-${pad2(parsed.getMonth() + 1)}-${pad2(parsed.getDate())}T${pad2(parsed.getHours())}:${pad2(parsed.getMinutes())}`;
}

export function datetimeLocalToIso(localValue) {
  if (!localValue) return "";
  const parsed = new Date(localValue);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString();
}

export function eventInfoToForm(eventInfo) {
  const event = eventInfo || {};
  const venue = event.venue || {};
  const details = event.details || {};
  const rsvpSettings = event.rsvpSettings || {};
  const features = event.features || {};
  const images = event.images || {};
  const timeline = event.timeline?.length ? event.timeline : [{ ...emptyTimelineItem }];

  return {
    hostNames: event.hostNames || "",
    introText: event.introText || "",
    celebrationText: event.celebrationText || "",
    eventDateFormatted: event.eventDateFormatted || "",
    eventTime: event.eventTime || "",
    countdownTargetDate: isoToDatetimeLocal(event.countdownTargetDate),
    venueName: venue.name || "",
    venueDescription: venue.description || "",
    venueAddress: venue.address || "",
    venueMapsLink: venue.mapsLink || "",
    dressCode: details.dressCode || "",
    transportation: details.transportation || "",
    accommodationTitle: details.accommodationTitle || "",
    accommodationSubtitle: details.accommodationSubtitle || "",
    accommodationBody: details.accommodationBody || "",
    deadlineText: rsvpSettings.deadlineText || "",
    registryLink: rsvpSettings.registryLink || "",
    includeTimeline: Boolean(features.includeTimeline),
    includeTransportation: Boolean(features.includeTransportation),
    includeAccommodation: Boolean(features.includeAccommodation),
    timeline,
    images: {
      heroBg: images.heroBg || "/images/floral-bg.png",
      countdownBg: images.countdownBg || "/images/coral-floral-bg.png",
      rsvpBg: images.rsvpBg || "/images/pink-sprig-bg.png",
      timelineBanner: images.timelineBanner || "",
      venueBanner: images.venueBanner || "",
      accommodationBanner: images.accommodationBanner || ""
    }
  };
}

export function formToEventUpdatePayload(form) {
  return {
    hostNames: form.hostNames,
    introText: form.introText,
    celebrationText: form.celebrationText,
    eventDateFormatted: form.eventDateFormatted,
    eventTime: form.eventTime,
    countdownTargetDate: datetimeLocalToIso(form.countdownTargetDate),
    images: form.images,
    venue: {
      name: form.venueName,
      description: form.venueDescription,
      address: form.venueAddress,
      mapsLink: form.venueMapsLink
    },
    details: {
      dressCode: form.dressCode,
      transportation: form.transportation,
      accommodationTitle: form.accommodationTitle,
      accommodationSubtitle: form.accommodationSubtitle,
      accommodationBody: form.accommodationBody
    },
    rsvpSettings: {
      deadlineText: form.deadlineText,
      registryLink: form.registryLink
    },
    features: {
      includeTimeline: form.includeTimeline,
      includeTransportation: form.includeTransportation,
      includeAccommodation: form.includeAccommodation
    },
    timeline: form.includeTimeline
      ? form.timeline.filter((item) => item.time.trim() && item.title.trim())
      : []
  };
}

export function eventFormToPublicPayload(form, slug, eventId) {
  const features = {
    include_timeline: Boolean(form.includeTimeline),
    include_transportation: Boolean(form.includeTransportation),
    include_accommodation: Boolean(form.includeAccommodation)
  };

  return {
    eventId,
    slug,
    event_type: "wedding",
    host_names: form.hostNames?.trim() || "Bride & Groom",
    intro_text: form.introText?.trim() || "Together with their families",
    celebration_text: form.celebrationText?.trim() || "Invite you to their wedding celebration",
    event_date_formatted: form.eventDateFormatted || "",
    event_time: form.eventTime || "",
    countdown_target_date: datetimeLocalToIso(form.countdownTargetDate),
    images: {
      hero_bg: form.images?.heroBg || "/images/floral-bg.png",
      countdown_bg: form.images?.countdownBg || "/images/coral-floral-bg.png",
      rsvp_bg: form.images?.rsvpBg || "/images/pink-sprig-bg.png",
      timeline_banner: form.images?.timelineBanner || "",
      venue_banner: form.images?.venueBanner || "",
      accommodation_banner: form.images?.accommodationBanner || ""
    },
    timeline: features.include_timeline
      ? form.timeline.filter((item) => item.time.trim() && item.title.trim())
      : [],
    venue: {
      name: form.venueName?.trim() || "Your Venue Name",
      description: form.venueDescription || "",
      address: form.venueAddress || "",
      maps_link: form.venueMapsLink || ""
    },
    details: {
      dress_code: form.dressCode || "",
      transportation: features.include_transportation ? form.transportation || "" : "",
      accommodation_title: features.include_accommodation ? form.accommodationTitle || "" : "",
      accommodation_subtitle: features.include_accommodation ? form.accommodationSubtitle || "" : "",
      accommodation_body: features.include_accommodation ? form.accommodationBody || "" : ""
    },
    rsvp_settings: {
      deadline_text: form.deadlineText || "",
      registry_link: form.registryLink || ""
    },
    features
  };
}
