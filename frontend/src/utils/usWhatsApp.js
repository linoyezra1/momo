export function normalizeUsPhone(phone) {
  if (phone == null || phone === "") return "";

  let value = String(phone).trim();
  if (typeof phone === "number" && Number.isFinite(phone)) {
    value = String(Math.trunc(phone));
  }

  value = value.replace(/[\s\-().]/g, "");
  if (value.startsWith("+")) {
    value = value.slice(1);
  }
  value = value.replace(/\D/g, "");

  if (value.length === 10) {
    return `1${value}`;
  }

  return value;
}

export function buildUsWhatsAppMessage({ guestName, publicLink, hostNames }) {
  const name = guestName || "there";
  const hosts = hostNames || "Us";
  const link = publicLink || "";

  return `Hi ${name}! We are so excited for our wedding day! Here is the link to our dynamic wedding invitation, where you can view our schedule, registry, and easily submit your RSVP: ${link}. Can't wait to celebrate with you! - ${hosts}`;
}

export function buildUsWhatsAppSendUrl({ phone, guestName, event, slug, userId, origin }) {
  const intlPhone = normalizeUsPhone(phone);
  if (!intlPhone) return "";

  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const publicLink = slug ? `${baseOrigin}/e/${slug}` : `${baseOrigin}/event/${userId}`;
  const hostNames = event?.hostNames || event?.host_names || "";

  const message = buildUsWhatsAppMessage({
    guestName,
    publicLink,
    hostNames
  });

  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(message)}`;
}
