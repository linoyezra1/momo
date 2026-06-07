import { MapPin } from "lucide-react";

export default function UsVenue({ event }) {
  const venue = event.venue || {};
  const banner = event.images?.venue_banner;

  return (
    <section className="bg-secondary/40 px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">Wedding</h2>
      </div>

      {banner ? (
        <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-sm shadow-sm">
          <img src={banner} alt={venue.name || "Wedding venue"} className="h-auto w-full object-cover" />
        </div>
      ) : null}

      <div className="mx-auto mt-10 max-w-xl text-center">
        {venue.description ? (
          <p className="font-sans text-sm leading-relaxed text-muted-foreground">{venue.description}</p>
        ) : null}
        <p className="mt-6 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">The Venue</p>
        {venue.name ? (
          <p className="mt-1 font-serif text-2xl tracking-wide text-foreground">{venue.name}</p>
        ) : null}
        {venue.address ? (
          <p className="mt-2 font-sans text-sm text-muted-foreground">{venue.address}</p>
        ) : null}

        {venue.maps_link ? (
          <a
            href={venue.maps_link}
            target="_blank"
            rel="noopener noreferrer"
            className="mt-6 inline-flex items-center gap-2 border border-primary px-6 py-3 font-sans text-xs uppercase tracking-[0.25em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
          >
            <MapPin className="h-4 w-4" />
            Google Maps
          </a>
        ) : null}
      </div>
    </section>
  );
}
