import { formatUsInvitationTime } from "../../utils/usInvitationCopy.js";

function parseEventDate(event) {
  const formatted = String(event.event_date_formatted || "").trim();
  const time = formatUsInvitationTime(event.event_time);

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
    time
  };
}

export default function UsHero({ event }) {
  const hostNames = String(event.host_names || "").trim() || "Bride & Groom";
  const introText = String(event.intro_text || "").trim() || "Together with their families";
  const celebrationText =
    String(event.celebration_text || "").trim() ||
    "request the pleasure of your company as they celebrate their marriage";

  const [first, second] = hostNames
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
        <div className="us-animate-in us-animate-delay-1 us-hero-divider" aria-hidden="true" />

        <p className="us-animate-in us-animate-delay-2 us-hero-intro font-sans text-[0.65rem] uppercase tracking-[0.35em] text-muted-foreground sm:text-xs">
          {introText}
        </p>

        <div className="us-animate-in us-animate-delay-3 us-hero-names flex w-full flex-wrap items-center justify-center gap-x-4 gap-y-2">
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

        <p className="us-animate-in us-animate-delay-4 us-hero-celebration font-sans text-[0.65rem] uppercase leading-relaxed tracking-[0.3em] text-muted-foreground sm:text-xs">
          {celebrationText}
        </p>

        {month || day || weekday || time ? (
          <div
            className="us-animate-in us-animate-delay-5 us-hero-date-grid font-serif text-foreground"
            aria-label={`${weekday} ${month} ${day}${time ? `, ${time}` : ""}`}
          >
            <div className="us-hero-date-col us-hero-date-col--weekday">
              {weekday ? (
                <p className="font-sans text-[0.68rem] font-medium uppercase tracking-[0.28em] text-muted-foreground sm:text-sm">
                  {weekday}
                </p>
              ) : null}
            </div>

            <div className="us-hero-date-col us-hero-date-col--day">
              {day ? <span className="us-hero-date-day">{day}</span> : null}
            </div>

            <div className="us-hero-date-col us-hero-date-col--meta">
              {month ? (
                <p className="font-sans text-[0.62rem] font-medium uppercase tracking-[0.22em] text-muted-foreground sm:text-xs sm:tracking-[0.25em]">
                  {month}
                </p>
              ) : null}
              {time ? (
                <p className="mt-1.5 font-sans text-[0.62rem] font-normal normal-case tracking-[0.06em] text-muted-foreground sm:mt-2 sm:text-xs">
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
