function parseEventDate(event) {
  const formatted = String(event.event_date_formatted || "").trim();
  const time = String(event.event_time || "").trim();

  if (!formatted) {
    return { month: "", day: "", weekday: "", time };
  }

  const [weekdayPart, rest] = formatted.split(",").map((part) => part.trim());
  const tokens = (rest || "").split(/\s+/).filter(Boolean);
  const month = tokens[0] || "";
  const day = (tokens[1] || "").replace(",", "");

  return {
    month: month.toUpperCase(),
    day,
    weekday: weekdayPart.toUpperCase(),
    time: time.toUpperCase()
  };
}

export default function UsHero({ event }) {
  const [first, second] = String(event.host_names || "")
    .split("&")
    .map((name) => name.trim());

  const { month, day, weekday, time } = parseEventDate(event);
  const heroBg = event.images?.hero_bg || "/images/floral-bg.png";

  return (
    <section
      className="us-hero"
      style={{ backgroundImage: `url('${heroBg}')` }}
      aria-label="Wedding invitation hero"
    >
      <div className="us-hero-content">
        <p className="us-animate-in us-animate-delay-1 us-hero-logo flex items-center justify-center font-script text-6xl leading-none text-primary sm:text-7xl md:text-8xl">
          we
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="mx-1 h-12 w-12 text-primary sm:h-14 sm:w-14 md:h-16 md:w-16"
            aria-hidden="true"
          >
            <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C17 15.65 12 20 12 20Z" />
          </svg>
          do
        </p>

        <div className="us-animate-in us-animate-delay-2 us-hero-divider" aria-hidden="true" />

        {event.intro_text ? (
          <p className="us-animate-in us-animate-delay-3 us-hero-intro font-sans text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground sm:text-xs">
            {event.intro_text}
          </p>
        ) : null}

        <div className="us-animate-in us-animate-delay-4 us-hero-names flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
          {first ? (
            <h1 className="font-serif text-4xl font-medium tracking-wide text-foreground sm:text-5xl md:text-7xl">
              {first.toUpperCase()}
            </h1>
          ) : null}
          {first && second ? (
            <span className="font-script text-3xl text-primary sm:text-4xl md:text-5xl">and</span>
          ) : null}
          {second ? (
            <h1 className="font-serif text-4xl font-medium tracking-wide text-foreground sm:text-5xl md:text-7xl">
              {second.toUpperCase()}
            </h1>
          ) : null}
        </div>

        {event.celebration_text ? (
          <p className="us-animate-in us-animate-delay-5 us-hero-celebration font-sans text-[0.65rem] uppercase leading-relaxed tracking-[0.3em] text-muted-foreground sm:text-xs">
            {event.celebration_text}
          </p>
        ) : null}

        {month || day || weekday || time ? (
          <div
            className="us-animate-in us-animate-delay-6 us-hero-date-grid font-serif text-foreground"
            aria-label={`${weekday} ${month} ${day}${time ? `, ${time}` : ""}`}
          >
            <div className="us-hero-date-col us-hero-date-col--month">
              {month ? (
                <span className="font-sans text-[0.68rem] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
                  {month}
                </span>
              ) : null}
            </div>

            <div className="us-hero-date-col us-hero-date-col--day">
              {day ? <span className="us-hero-date-day">{day}</span> : null}
            </div>

            <div className="us-hero-date-col us-hero-date-col--meta">
              {weekday ? (
                <p className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-xs sm:tracking-[0.25em]">
                  {weekday}
                </p>
              ) : null}
              {time ? (
                <p className="mt-1.5 font-sans text-[0.62rem] font-medium uppercase tracking-[0.2em] text-muted-foreground sm:mt-2 sm:text-xs sm:tracking-[0.22em]">
                  {time}
                </p>
              ) : null}
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
