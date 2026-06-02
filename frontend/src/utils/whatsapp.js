export function toInternationalWhatsAppPhone(phone) {
  let digits = String(phone ?? "").replace(/[^\d]/g, "");
  if (!digits) return "";
  if (digits.startsWith("972")) return digits;
  if (digits.startsWith("0")) return `972${digits.slice(1)}`;
  if (digits.startsWith("5") && digits.length === 9) return `972${digits}`;
  return digits;
}

export function buildWhatsAppSendUrl({ phone, fullName, eventId, origin }) {
  const intlPhone = toInternationalWhatsAppPhone(phone);
  const baseOrigin = origin || (typeof window !== "undefined" ? window.location.origin : "");
  const guestLink = `${baseOrigin}/event/${eventId}?phone=${encodeURIComponent(phone)}`;
  const whatsappMessage = `שלום ${fullName}, נשמח שתאשרו את ההגעה לאירוע שלנו בקישור האישי שלכם: ${guestLink}`;
  return `https://api.whatsapp.com/send?phone=${intlPhone}&text=${encodeURIComponent(whatsappMessage)}`;
}
