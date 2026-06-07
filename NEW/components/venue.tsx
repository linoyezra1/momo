import Image from "next/image"
import { MapPin } from "lucide-react"
import { eventData } from "@/lib/event-data"

export function Venue() {
  const { venue, images } = eventData

  return (
    <section className="bg-secondary/40 px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">
          Wedding
        </h2>
      </div>

      <div className="mx-auto mt-12 max-w-3xl overflow-hidden rounded-sm shadow-sm">
        <Image
          src={images.venue_banner || "/placeholder.svg"}
          alt={`${venue.name}, a French-style château wedding venue`}
          width={1200}
          height={700}
          className="h-auto w-full object-cover"
        />
      </div>

      <div className="mx-auto mt-10 max-w-xl text-center">
        <p className="font-sans text-sm leading-relaxed text-muted-foreground">
          {venue.description}
        </p>
        <p className="mt-6 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
          The Venue
        </p>
        <p className="mt-1 font-serif text-2xl tracking-wide text-foreground">{venue.name}</p>

        <a
          href={venue.maps_link}
          target="_blank"
          rel="noopener noreferrer"
          className="mt-6 inline-flex items-center gap-2 border border-primary px-6 py-3 font-sans text-xs uppercase tracking-[0.25em] text-primary transition-colors hover:bg-primary hover:text-primary-foreground"
        >
          <MapPin className="h-4 w-4" />
          Google Maps
        </a>
      </div>
    </section>
  )
}
