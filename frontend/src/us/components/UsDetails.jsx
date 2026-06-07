import { Bus, Shirt } from "lucide-react";
import { sanitizeInvitationDetailText } from "../../utils/usInvitationCopy.js";

export default function UsDetails({ event }) {
  const details = event.details || {};
  const items = [];

  const dressCode = sanitizeInvitationDetailText(details.dress_code);
  const transportation = sanitizeInvitationDetailText(details.transportation);

  if (dressCode) {
    items.push({ icon: Shirt, title: "Dress Code", text: dressCode });
  }
  if (transportation) {
    items.push({ icon: Bus, title: "Transportation", text: transportation });
  }

  if (!items.length) {
    return null;
  }

  return (
    <section className="relative overflow-hidden bg-[url('/images/the.png')] bg-cover bg-center bg-no-repeat px-6 py-24">
      <div className="pointer-events-none absolute inset-0 bg-[#fdfbf7]/72" aria-hidden="true" />
      <div className="relative z-10 mx-auto max-w-4xl text-center">
        <p className="font-script text-5xl text-primary md:text-6xl">the</p>
        <h2 className="mt-1 font-serif text-3xl uppercase tracking-[0.3em] text-foreground md:text-4xl">Details</h2>
      </div>

      <div
        className={`relative z-10 mx-auto mt-14 grid max-w-3xl gap-8 ${
          items.length > 1 ? "md:grid-cols-2" : "md:grid-cols-1"
        }`}
      >
        {items.map((item) => (
          <div
            key={item.title}
            className="flex flex-col items-center rounded-sm border border-border bg-card/95 px-8 py-10 text-center shadow-sm backdrop-blur-[1px]"
          >
            <item.icon className="h-7 w-7 text-primary" strokeWidth={1.25} />
            <h3 className="mt-5 font-serif text-xl uppercase tracking-[0.25em] text-foreground">{item.title}</h3>
            <p className="mt-4 font-sans text-sm leading-relaxed text-muted-foreground">{item.text}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
