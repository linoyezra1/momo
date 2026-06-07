export default function UsHero({ event }) {
  const [first, second] = String(event.host_names || "")
    .split("&")
    .map((name) => name.trim());

  const [weekday, rest] = String(event.event_date_formatted || "")
    .split(",")
    .map((part) => part.trim());
  const [month, dayWithComma, year] = (rest || "").split(" ");
  const day = (dayWithComma || "").replace(",", "");

  return (
    <section className="relative flex min-h-screen flex-col items-center justify-center overflow-hidden px-6 py-20 text-center">
      <div className="relative z-10 mt-24 flex flex-col items-center">
        <p className="flex items-center justify-center font-script text-7xl leading-none text-primary md:text-8xl">
          we
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={1.5}
            className="mx-1 h-14 w-14 text-primary md:h-16 md:w-16"
            aria-hidden="true"
          >
            <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C17 15.65 12 20 12 20Z" />
          </svg>
          do
        </p>

        <div className="mt-12 h-px w-24 bg-border" />

        {event.intro_text ? (
          <p className="mt-10 font-sans text-xs uppercase tracking-[0.35em] text-muted-foreground">
            {event.intro_text}
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap items-center justify-center gap-4">
          {first ? (
            <h1 className="font-serif text-5xl font-medium tracking-wide text-foreground md:text-7xl">
              {first.toUpperCase()}
            </h1>
          ) : null}
          {first && second ? (
            <span className="font-script text-4xl text-accent-foreground md:text-5xl">and</span>
          ) : null}
          {second ? (
            <h1 className="font-serif text-5xl font-medium tracking-wide text-foreground md:text-7xl">
              {second.toUpperCase()}
            </h1>
          ) : null}
        </div>

        {event.celebration_text ? (
          <p className="mt-10 max-w-xs font-sans text-xs uppercase leading-relaxed tracking-[0.3em] text-muted-foreground">
            {event.celebration_text}
          </p>
        ) : null}

        <div className="mt-12 flex items-stretch gap-6 font-serif text-foreground">
          {month ? (
            <div className="flex flex-col items-center justify-center">
              <span className="text-sm uppercase tracking-[0.25em] text-muted-foreground">{month}</span>
            </div>
          ) : null}
          <div className="border-x border-border px-6 text-center">
            {weekday ? (
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{weekday}</p>
            ) : null}
            {day ? <p className="my-1 text-6xl font-light leading-none">{day}</p> : null}
            {event.event_time ? (
              <p className="text-xs uppercase tracking-[0.25em] text-muted-foreground">{event.event_time}</p>
            ) : null}
          </div>
          {year ? (
            <div className="flex flex-col items-center justify-center">
              <span className="text-sm uppercase tracking-[0.25em] text-muted-foreground">{year}</span>
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
