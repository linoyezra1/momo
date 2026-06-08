import IlAnimateIn from "./IlAnimateIn.jsx";
import IlScheduleIcon from "./IlScheduleIcon.jsx";
import { buildWeddingSchedule } from "./ilInviteUtils.js";

export default function IlInviteSchedule({ event }) {
  if (event?.eventType !== "חתונה") return null;

  const items = buildWeddingSchedule(event);
  if (!items.length) return null;

  return (
    <section className="il-invite-schedule">
      <IlAnimateIn className="il-invite-schedule__title-wrap" delay={80}>
        <h2 className="il-invite-schedule__title">יום החתונה</h2>
      </IlAnimateIn>

      <div className="il-invite-schedule__timeline">
        <div className="il-invite-schedule__line" aria-hidden="true" />
        {items.map((item, index) => (
          <IlAnimateIn
            key={`${item.time}-${item.title}`}
            className={`il-invite-schedule__item il-invite-schedule__item--${item.side}`}
            delay={120 + index * 90}
          >
            <div className="il-invite-schedule__content">
              <span className="il-invite-schedule__time">{item.time}</span>
              <span className="il-invite-schedule__label">{item.title}</span>
            </div>
            <div className="il-invite-schedule__icon">
              <IlScheduleIcon name={item.icon} />
            </div>
          </IlAnimateIn>
        ))}
      </div>

      <img className="il-invite-schedule__blur-edge" src="/images/il-invite/blur-soft.png" alt="" aria-hidden="true" />
    </section>
  );
}
