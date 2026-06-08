import { useEffect, useState } from "react";
import IlAnimateIn from "./IlAnimateIn.jsx";
import { getCountdownTarget } from "./ilInviteUtils.js";

function getRemaining(targetDate) {
  const diff = Math.max(0, targetDate.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60)
  };
}

export default function IlInviteCountdown({ event }) {
  const target = getCountdownTarget(event);
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!target) return undefined;
    setTime(getRemaining(target));
    const id = setInterval(() => setTime(getRemaining(target)), 1000);
    return () => clearInterval(id);
  }, [event?.eventDate, event?.eventTime, target?.getTime()]);

  if (!target || target.getTime() <= Date.now()) return null;

  const units = [
    { label: "ימים", value: time.days },
    { label: "שעות", value: time.hours },
    { label: "דקות", value: time.minutes },
    { label: "שניות", value: time.seconds }
  ];

  return (
    <IlAnimateIn className="il-invite-countdown" delay={120}>
      <p className="il-invite-countdown__eyebrow">עד החתונה נשארו</p>
      <div className="il-invite-countdown__grid">
        {units.map((unit, index) => (
          <div key={unit.label} className="il-invite-countdown__unit" style={{ animationDelay: `${index * 90}ms` }}>
            <span className="il-invite-countdown__value">{String(unit.value).padStart(2, "0")}</span>
            <span className="il-invite-countdown__label">{unit.label}</span>
          </div>
        ))}
      </div>
    </IlAnimateIn>
  );
}
