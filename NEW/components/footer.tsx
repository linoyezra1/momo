import { eventData } from "@/lib/event-data"

export function Footer() {
  const names = eventData.host_names.replace("&", "&").toUpperCase()
  return (
    <footer className="border-t border-border bg-secondary/40 px-6 py-12 text-center">
      <p className="flex items-center justify-center font-script text-4xl text-primary">
        we
        <svg
          viewBox="0 0 24 24"
          fill="currentColor"
          className="mx-1 h-6 w-6"
          aria-hidden="true"
        >
          <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C17 15.65 12 20 12 20Z" />
        </svg>
        do
      </p>
      <p className="mt-4 font-serif text-lg tracking-[0.3em] text-foreground">{names}</p>
      <p className="mt-2 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
        {eventData.event_date_formatted} &middot; {eventData.venue.name}
      </p>
      <div className="mt-6 flex justify-center gap-6 font-sans text-[0.65rem] uppercase tracking-[0.2em] text-muted-foreground">
        <span>Terms &amp; Support</span>
        <span>Privacy Policy</span>
      </div>
    </footer>
  )
}
