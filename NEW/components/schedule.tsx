import { eventData } from "@/lib/event-data"

const SCHEDULE = eventData.timeline

export function Schedule() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-2xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">
          Day
        </h2>

        <ul className="mt-14 flex flex-col gap-10">
          {SCHEDULE.map((item, i) => (
            <li key={item.title} className="flex flex-col items-center">
              <span className="font-serif text-2xl font-light tracking-wide text-primary">
                {item.time}
              </span>
              <span className="mt-2 font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {item.title}
              </span>
              {i < SCHEDULE.length - 1 && <span className="mt-8 h-8 w-px bg-border" />}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
