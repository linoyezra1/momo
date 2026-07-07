export default function UsFooter({ event }) {
  const names = String(event.host_names || "Bride & Groom").trim().toUpperCase();
  const dateText = event.event_date_formatted || "";
  const venueName = event.venue?.name || "";

  return (
    <footer className="border-t border-border bg-secondary/40 px-6 py-12 text-center">
      <p className="font-serif text-lg tracking-[0.3em] text-foreground">{names}</p>
      {dateText || venueName ? (
        <p className="mt-2 font-sans text-xs uppercase tracking-[0.25em] text-muted-foreground">
          {[dateText, venueName].filter(Boolean).join(" · ")}
        </p>
      ) : null}
      <p className="mt-6 font-sans text-[0.6rem] uppercase tracking-[0.2em] text-muted-foreground/70">
        Digital invitation by momoEVENTS
      </p>
    </footer>
  );
}
