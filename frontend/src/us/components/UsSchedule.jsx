export default function UsSchedule({ event }) {
  const timeline = event.timeline || [];
  if (!timeline.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-[url('/images/Accommodation.png')] bg-cover bg-center bg-no-repeat px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-[#fdfbf7]/72" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-2xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">Day</h2>

        <ul className="mt-14 flex flex-col gap-10 rounded-sm border border-border bg-card/95 px-8 py-10 shadow-sm backdrop-blur-[1px]">
          {timeline.map((item, index) => (
            <li key={`${item.time}-${item.title}`} className="flex flex-col items-center">
              <span className="font-serif text-2xl font-light tracking-wide text-primary">{item.time}</span>
              <span className="mt-2 font-sans text-xs uppercase tracking-[0.3em] text-muted-foreground">
                {item.title}
              </span>
              {index < timeline.length - 1 ? <span className="mt-8 h-8 w-px bg-border" /> : null}
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}
