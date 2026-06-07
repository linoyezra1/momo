function cleanPhoneDigits(phone) {
  if (phone == null || phone === "") return "";

  let value = String(phone).trim();
  if (typeof phone === "number" && Number.isFinite(phone)) {
    value = String(Math.trunc(phone));
  }

  return value.replace(/\D/g, "");
}

function fixIsraeliInternational(digits) {
  if (!digits.startsWith("972")) {
    return digits;
  }

  if (digits.startsWith("9720")) {
    return `972${digits.slice(4)}`;
  }

  return digits;
}

function isUsNanpTenDigit(digits) {
  return digits.length === 10 && /^[2-9]\d{9}$/.test(digits);
}

function isUsNanpElevenDigit(digits) {
  return digits.length === 11 && digits.startsWith("1") && /^1[2-9]\d{9}$/.test(digits);
}

function normalizeIsraeliLocal(digits) {
  if (digits.startsWith("05") && digits.length === 10) {
    return `972${digits.slice(1)}`;
  }

  if (digits.startsWith("5") && digits.length === 9) {
    return `972${digits}`;
  }

  return "";
}

function normalizeCorruptedOnePrefix(digits) {
  if (!digits.startsWith("1") || digits.length < 11) {
    return "";
  }

  const afterCountryDigit = digits.slice(1);

  if (afterCountryDigit.startsWith("05") && afterCountryDigit.length === 10) {
    return `972${afterCountryDigit.slice(1)}`;
  }

  if (afterCountryDigit.startsWith("972")) {
    return fixIsraeliInternational(afterCountryDigit);
  }

  return "";
}

export function normalizeUsPhone(phone) {
  let digits = cleanPhoneDigits(phone);
  if (!digits) return "";

  if (digits.startsWith("00")) {
    digits = digits.slice(2);
  }

  if (digits.startsWith("972")) {
    return fixIsraeliInternational(digits);
  }

  const corruptedIsraeli = normalizeCorruptedOnePrefix(digits);
  if (corruptedIsraeli) {
    return corruptedIsraeli;
  }

  const israeliLocal = normalizeIsraeliLocal(digits);
  if (israeliLocal) {
    return israeliLocal;
  }

  if (isUsNanpElevenDigit(digits)) {
    return digits;
  }

  if (isUsNanpTenDigit(digits)) {
    return `1${digits}`;
  }

  if (digits.length >= 11) {
    return digits;
  }

  return digits;
}

function guestFirstName(guestName) {
  const trimmed = String(guestName || "").trim();
  if (!trimmed) return "Friend";
  return trimmed.split(/\s+/)[0];
}

export function buildUsWhatsAppMessage({ guestName, publicLink, hostNames }) {
  const name = guestFirstName(guestName);
  const hosts = String(hostNames || "").trim();
  const link = publicLink || "";
  const signature = hosts ? `\n— ${hosts}` : "";

  return `${name} — your invitation is here. 💍
🔗 ${link}
RSVP + full wedding details inside.
We can't wait to celebrate with you!${signature}`;
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

  return `https://wa.me/${intlPhone}?text=${encodeURIComponent(message)}`;
}
