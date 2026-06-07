import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api.js";
import "../us/us.css";
import UsHero from "../us/components/UsHero.jsx";
import UsCountdown from "../us/components/UsCountdown.jsx";
import UsSchedule from "../us/components/UsSchedule.jsx";
import UsVenue from "../us/components/UsVenue.jsx";
import UsAccommodation from "../us/components/UsAccommodation.jsx";
import UsDetails from "../us/components/UsDetails.jsx";
import UsRsvp from "../us/components/UsRsvp.jsx";
import UsFooter from "../us/components/UsFooter.jsx";
import UsReveal from "../us/components/UsReveal.jsx";

export default function UsEventPage() {
  const { slug, eventId } = useParams();
  const [event, setEvent] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  useEffect(() => {
    let active = true;
    setLoading(true);
    setError("");

    const endpoint = slug ? `/public/event/by-slug/${slug}` : `/public/event/${eventId}`;

    api
      .get(endpoint)
      .then((response) => {
        if (active) {
          setEvent(response.data);
        }
      })
      .catch((fetchError) => {
        if (active) {
          setError(fetchError.response?.data?.message || "Event not found");
        }
      })
      .finally(() => {
        if (active) {
          setLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [slug, eventId]);

  if (loading) {
    return (
      <div className="us-invite-page flex min-h-screen items-center justify-center bg-background px-6">
        <p className="font-sans text-sm uppercase tracking-[0.25em] text-muted-foreground">Loading invitation…</p>
      </div>
    );
  }

  if (error || !event) {
    return (
      <div className="us-invite-page flex min-h-screen items-center justify-center bg-background px-6 text-center">
        <div>
          <h1 className="font-serif text-3xl text-foreground">Invitation not found</h1>
          <p className="mt-3 font-sans text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    );
  }

  return (
    <main className="us-invite-page bg-background">
      <UsHero event={event} />
      <UsReveal delay={0}>
        <UsCountdown event={event} />
      </UsReveal>
      {event.features?.include_timeline ? (
        <UsReveal delay={80}>
          <UsSchedule event={event} />
        </UsReveal>
      ) : null}
      <UsReveal delay={120}>
        <UsVenue event={event} />
      </UsReveal>
      {event.features?.include_accommodation ? (
        <UsReveal delay={160}>
          <UsAccommodation event={event} />
        </UsReveal>
      ) : null}
      <UsReveal delay={200}>
        <UsDetails event={event} />
      </UsReveal>
      <UsReveal delay={240}>
        <UsRsvp event={event} slug={slug || event.slug} />
      </UsReveal>
      <UsReveal delay={280}>
        <UsFooter event={event} />
      </UsReveal>
    </main>
  );
}
