import IlAnimateIn from "./IlAnimateIn.jsx";
import { getDateParts } from "./ilInviteUtils.js";

function WeddingHeadline({ event }) {
  return (
    <div className="il-invite-headline">
      <IlAnimateIn as="p" className="il-invite-script" delay={80}>
        הנכם מוזמנים
      </IlAnimateIn>
      <IlAnimateIn as="p" className="il-invite-script il-invite-script--accent" delay={160}>
        לחגוג עמנו
      </IlAnimateIn>
      <IlAnimateIn as="h1" className="il-invite-names" delay={260}>
        {event.groomName || "—"} <span className="il-invite-amp">&</span> {event.brideName || "—"}
      </IlAnimateIn>
    </div>
  );
}

function BritHeadline({ event }) {
  const dateParts = getDateParts(event);
  return (
    <div className="il-invite-headline il-invite-headline--brit">
      <IlAnimateIn as="p" className="il-invite-lead" delay={80}>
        שמחים להזמינכם לחגוג עמנו את ברית המילה של בננו
      </IlAnimateIn>
      <IlAnimateIn as="p" className="il-invite-sub" delay={180}>
        {dateParts.weekday}
        {dateParts.hebrew ? ` · ${dateParts.hebrew}` : ""}
      </IlAnimateIn>
    </div>
  );
}

function BatMitzvahHeadline({ event }) {
  return (
    <div className="il-invite-headline">
      <IlAnimateIn as="p" className="il-invite-lead" delay={80}>
        אנו נרגשים להזמינכם לחגיגת בת המצווה של בתנו
      </IlAnimateIn>
      <IlAnimateIn as="h1" className="il-invite-names" delay={220}>
        {event.batMitzvahName || "—"}
      </IlAnimateIn>
    </div>
  );
}

export default function IlInviteHero({ event }) {
  const hasCover = Boolean(event?.imageDataUrl?.trim());
  const dateParts = getDateParts(event);
  const isBrit = event?.eventType === "ברית";

  return (
    <header className="il-invite-hero">
      <div
        className={`il-invite-hero__media${hasCover ? "" : " il-invite-hero__media--fallback"}`}
        style={hasCover ? { backgroundImage: `url(${event.imageDataUrl})` } : undefined}
      >
        <div className="il-invite-hero__shade" />
        <img className="il-invite-hero__blur-edge" src="/images/il-invite/blur-soft.png" alt="" aria-hidden="true" />
        <div className="il-invite-hero__blur-fade" aria-hidden="true" />
      </div>

      <div className="il-invite-hero__body">
        {event?.eventType === "חתונה" ? (
          <WeddingHeadline event={event} />
        ) : isBrit ? (
          <BritHeadline event={event} />
        ) : event?.eventType === "בת מצווה" ? (
          <BatMitzvahHeadline event={event} />
        ) : (
          <div className="il-invite-headline">
            <IlAnimateIn as="p" className="il-invite-lead" delay={80}>
              הנכם מוזמנים{event?.eventType && event.eventType !== "אחר" ? ` ל${event.eventType}` : ""}
            </IlAnimateIn>
            {event?.eventNames ? (
              <IlAnimateIn as="h1" className="il-invite-names" delay={220}>
                {event.eventNames}
              </IlAnimateIn>
            ) : null}
          </div>
        )}

        {!isBrit ? (
          <IlAnimateIn className="il-invite-date-block" delay={340}>
            <div className="il-invite-date-row">
              <span className="il-invite-date-side">{dateParts.month}</span>
              <span className="il-invite-date-day">{dateParts.day}</span>
              <span className="il-invite-date-side">{dateParts.weekday}</span>
            </div>
            <p className="il-invite-date-year">{dateParts.year}</p>
            {dateParts.hebrew ? <p className="il-invite-date-hebrew">{dateParts.hebrew}</p> : null}
          </IlAnimateIn>
        ) : (
          <IlAnimateIn className="il-invite-date-block" delay={300}>
            <p className="il-invite-date-dots">{dateParts.dots}</p>
          </IlAnimateIn>
        )}

        <IlAnimateIn className="il-invite-venue" delay={420}>
          <p className="il-invite-venue__name">{event?.venueName || "—"}</p>
          <p className="il-invite-venue__address">
            {event?.streetAndNumber || "—"}, {event?.city || "—"}
          </p>
          {event?.eventTime ? (
            <p className="il-invite-venue__time">
              בשעה <span>{event.eventTime}</span>
            </p>
          ) : null}
        </IlAnimateIn>
      </div>
    </header>
  );
}
