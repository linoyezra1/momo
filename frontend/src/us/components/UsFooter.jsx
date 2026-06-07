export default function UsFooter({ event }) {
  const names = String(event.host_names || "Bride & Groom").trim().toUpperCase();
  const dateText = event.event_date_formatted || "";
  const venueName = event.venue?.name || "";

  return (
    <footer className="border-t border-border bg-secondary/40 px-6 py-12 text-center">
      <p className="flex items-center justify-center font-script text-4xl text-primary">
        we
        <svg viewBox="0 0 24 24" fill="currentColor" className="mx-1 h-6 w-6" aria-hidden="true">
          <path d="M12 20s-7-4.35-9.5-8.5C1 8.5 2.5 5 6 5c2 0 3.2 1.2 4 2.5C10.8 6.2 12 5 14 5c3.5 0 5 3.5 3.5 6.5C17 15.65 12 20 12 20Z" />
        </svg>
        do
      </p>
      <p className="mt-4 font-serif text-lg tracking-[0.3em] text-foreground">{names}</p>
      {dateText || venueName ? (
        <p className="mt-2 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {[dateText, venueName].filter(Boolean).join(" · ")}
        </p>
      ) : null}
    </footer>
  );
}
