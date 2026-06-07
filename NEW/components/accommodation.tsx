import Image from "next/image"
import { eventData } from "@/lib/event-data"

export function Accommodation() {
  const { details, images } = eventData
  const [stayAt, venueName] = details.accommodation_title.split("Stay at").length > 1
    ? ["Stay at", details.accommodation_title.replace("Stay at", "").trim()]
    : ["Stay at", details.accommodation_title]

  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">
          Accommodation
        </h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-4xl items-center gap-12 md:grid-cols-2">
        <div className="overflow-hidden rounded-sm shadow-sm">
          <Image
            src={images.accommodation_banner || "/placeholder.svg"}
            alt={`Elegant luxury suite at ${venueName}`}
            width={800}
            height={600}
            className="h-full w-full object-cover"
          />
        </div>

        <div className="text-center md:text-left">
          <p className="font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
            {stayAt}
          </p>
          <p className="mt-1 font-serif text-2xl tracking-wide text-foreground">{venueName}</p>

          <p className="mt-6 font-sans text-sm leading-relaxed text-primary">
            {details.accommodation_subtitle}
          </p>

          <p className="mt-8 font-sans text-sm leading-relaxed text-muted-foreground">
            {details.accommodation_body}
          </p>
        </div>
      </div>
    </section>
  )
}
