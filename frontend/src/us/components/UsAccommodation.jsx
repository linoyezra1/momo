export default function UsAccommodation({ event }) {
  const details = event.details || {};
  const title = details.accommodation_title || "";
  const subtitle = details.accommodation_subtitle || "";
  const body = details.accommodation_body || "";
  const banner = event.images?.accommodation_banner;

  if (!title && !body) {
    return null;
  }

  const hasStayAt = title.toLowerCase().includes("stay at");
  const stayAt = hasStayAt ? "Stay at" : "";
  const venueName = hasStayAt ? title.replace(/stay at/i, "").trim() : title;

  return (
    <section className="relative overflow-hidden bg-[url('/images/Accommodation.png')] bg-cover bg-center bg-no-repeat px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-[#fdfbf7]/72" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <h2 className="font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">Accommodation</h2>
      </div>

      <div className="relative z-10 mx-auto mt-14 grid max-w-4xl items-center gap-12 md:grid-cols-2">
        {banner ? (
          <div className="overflow-hidden rounded-sm shadow-sm">
            <img
              src={banner}
              alt={venueName ? `Accommodation at ${venueName}` : "Accommodation"}
              className="h-full w-full object-cover"
            />
          </div>
        ) : null}

        <div
          className={`rounded-sm border border-border bg-card/95 px-6 py-8 text-center shadow-sm backdrop-blur-[1px] ${
            banner ? "md:text-left" : "md:mx-auto md:max-w-xl"
          }`}
        >
          {stayAt ? (
            <p className="font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">{stayAt}</p>
          ) : null}
          {venueName ? (
            <p className="mt-1 font-serif text-2xl tracking-wide text-foreground">{venueName}</p>
          ) : null}
          {subtitle ? (
            <p className="mt-6 font-sans text-sm leading-relaxed text-primary">{subtitle}</p>
          ) : null}
          {body ? (
            <p className="mt-8 font-sans text-sm leading-relaxed text-muted-foreground">{body}</p>
          ) : null}
        </div>
      </div>
    </section>
  );
}
