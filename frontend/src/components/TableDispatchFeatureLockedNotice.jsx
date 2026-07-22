import {
  TABLE_DISPATCH_SALES_PHONE,
  buildTableDispatchPurchaseWhatsAppUrl
} from "../utils/tableDispatchPurchase.js";

export default function TableDispatchFeatureLockedNotice({
  event,
  eventLabel,
  eventType,
  eventId,
  className = "il-budget-warning"
}) {
  const href = buildTableDispatchPurchaseWhatsAppUrl({
    event,
    eventLabel,
    eventType,
    eventId
  });

  return (
    <p className={className} role="status">
      הפיצ׳ר אינו פעיל לאירוע זה. לרכישת הפיצ׳ר אנא{" "}
      <a href={href} target="_blank" rel="noreferrer">
        לחצו כאן
      </a>
      {" "}או בטלפון{" "}
      <a href={href} target="_blank" rel="noreferrer" dir="ltr">
        {TABLE_DISPATCH_SALES_PHONE}
      </a>
      .
    </p>
  );
}
