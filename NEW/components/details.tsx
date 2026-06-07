import { Shirt, Bus } from "lucide-react"
import { eventData } from "@/lib/event-data"

const DETAILS = [
  {
    icon: Shirt,
    title: "Dress Code",
    text: eventData.details.dress_code,
  },
  {
    icon: Bus,
    title: "Transportation",
    text: eventData.details.transportation,
  },
]

export function Details() {
  return (
    <section className="bg-secondary/40 px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">
          Details
        </h2>
      </div>

      <div className="mx-auto mt-14 grid max-w-3xl gap-8 md:grid-cols-2">
        {DETAILS.map((d) => (
          <div
            key={d.title}
            className="flex flex-col items-center rounded-sm border border-border bg-card px-8 py-10 text-center"
          >
            <d.icon className="h-7 w-7 text-primary" strokeWidth={1.25} />
            <h3 className="mt-5 font-serif text-xl uppercase tracking-[0.25em] text-foreground">
              {d.title}
            </h3>
            <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">
              {d.text}
            </p>
          </div>
        ))}
      </div>
    </section>
  )
}
