import { useEffect, useState } from "react";

function getRemaining(targetDate) {
  const target = new Date(targetDate);
  const diff = Math.max(0, target.getTime() - Date.now());
  return {
    days: Math.floor(diff / (1000 * 60 * 60 * 24)),
    hours: Math.floor((diff / (1000 * 60 * 60)) % 24),
    minutes: Math.floor((diff / (1000 * 60)) % 60),
    seconds: Math.floor((diff / 1000) % 60)
  };
}

export default function UsCountdown({ event }) {
  const [time, setTime] = useState({ days: 0, hours: 0, minutes: 0, seconds: 0 });

  useEffect(() => {
    if (!event.countdown_target_date) {
      return undefined;
    }
    setTime(getRemaining(event.countdown_target_date));
    const id = setInterval(() => setTime(getRemaining(event.countdown_target_date)), 1000);
    return () => clearInterval(id);
  }, [event.countdown_target_date]);

  const units = [
    { label: "Days", value: time.days },
    { label: "Hours", value: time.hours },
    { label: "Minutes", value: time.minutes },
    { label: "Seconds", value: time.seconds }
  ];

  return (
    <section
      className="bg-cover bg-center px-6 py-28 text-center"
      style={{ backgroundImage: `url('${event.images?.countdown_bg || "/images/coral-floral-bg.png"}')` }}
    >
      <p className="font-script text-5xl text-card md:text-6xl">the</p>
      <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-card md:text-4xl">Countdown</h2>
      <p className="mx-auto mt-4 max-w-md font-sans text-xs uppercase tracking-[0.25em] text-card/90">
        To our forever begins
      </p>

      <div className="mx-auto mt-12 grid max-w-2xl grid-cols-4 gap-3 md:gap-6">
        {units.map((unit) => (
          <div
            key={unit.label}
            className="flex flex-col items-center rounded-sm border border-card/30 bg-card/15 px-2 py-6 backdrop-blur-sm md:py-8"
          >
            <span className="font-serif text-4xl font-light text-card md:text-6xl">
              {String(unit.value).padStart(2, "0")}
            </span>
            <span className="mt-2 font-sans text-[0.6rem] uppercase tracking-[0.25em] text-card/90 md:text-xs">
              {unit.label}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}
