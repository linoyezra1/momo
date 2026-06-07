import UsHero from "./UsHero.jsx";
import UsCountdown from "./UsCountdown.jsx";
import UsSchedule from "./UsSchedule.jsx";
import UsVenue from "./UsVenue.jsx";
import UsAccommodation from "./UsAccommodation.jsx";
import UsDetails from "./UsDetails.jsx";
import UsRsvp from "./UsRsvp.jsx";
import UsFooter from "./UsFooter.jsx";

export default function UsInvitationPreview({ event, slug }) {
  return (
    <main className="us-invite-page us-invite-preview bg-background">
      <UsHero event={event} />
      <UsCountdown event={event} />
      {event.features?.include_timeline ? <UsSchedule event={event} /> : null}
      <UsVenue event={event} />
      {event.features?.include_accommodation ? <UsAccommodation event={event} /> : null}
      <UsDetails event={event} />
      <UsRsvp event={event} slug={slug || event.slug || "preview"} previewMode />
      <UsFooter event={event} />
    </main>
  );
}
