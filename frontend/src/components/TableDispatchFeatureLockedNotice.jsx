import { buildTableDispatchPurchaseWhatsAppUrl } from "../utils/tableDispatchPurchase.js";

const DEFAULT_MESSAGE =
  "לאירוע זה אין את האפשרות לשלוח מספר שולחן בוואטסאפ. לרכישת השירות ניתן ליצור קשר בוואטסאפ.";

export default function TableDispatchFeatureLockedNotice({
  event,
  eventLabel,
  eventType,
  eventId,
  className = "il-budget-warning",
  message = DEFAULT_MESSAGE
}) {
  const href = buildTableDispatchPurchaseWhatsAppUrl({
    event,
    eventLabel,
    eventType,
    eventId
  });

  const [beforeLink, afterLink = ""] = String(message).split("ליצור קשר בוואטסאפ");

  return (
    <p className={className} role="status">
      {beforeLink}
      {href ? (
        <a href={href} target="_blank" rel="noreferrer">
          ליצור קשר בוואטסאפ
        </a>
      ) : (
        "ליצור קשר בוואטסאפ"
      )}
      {afterLink}
    </p>
  );
}
