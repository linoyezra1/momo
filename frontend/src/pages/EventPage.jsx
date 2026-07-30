import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import IlInviteExperience from "../il/invite/IlInviteExperience.jsx";
import { observePublicWebVitals, reportPublicPerf } from "../utils/publicPerf.js";

export default function EventPage() {
  const { eventId } = useParams();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const stopVitals = observePublicWebVitals({ eventId });
    return stopVitals;
  }, [eventId]);

  useEffect(() => {
    let cancelled = false;
    const started = performance.now();
    setLoading(true);
    setError("");
    api
      .get(`/public/event/${eventId}`)
      .then((response) => {
        if (cancelled) return;
        setEventData(response.data);
        reportPublicPerf("api_event", {
          eventId,
          apiMs: Math.round(performance.now() - started),
          bytes: Number(response.headers?.["content-length"]) || null
        });
      })
      .catch(() => {
        if (!cancelled) setError("לא ניתן לטעון את פרטי האירוע");
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [eventId]);

  useEffect(() => {
    const coverUrl =
      eventData?.event?.cover?.url ||
      eventData?.event?.cover?.variants?.["480"] ||
      eventData?.event?.imageDataUrl;
    if (!coverUrl || coverUrl.startsWith("data:")) return undefined;
    const started = performance.now();
    const img = new Image();
    img.onload = () => {
      reportPublicPerf("cover_load", {
        eventId,
        coverMs: Math.round(performance.now() - started)
      });
    };
    img.onerror = () => {
      reportPublicPerf("cover_error", { eventId });
    };
    img.src = coverUrl;
    return undefined;
  }, [eventData, eventId]);

  return (
    <IlInviteExperience
      event={eventData?.event}
      loading={loading}
      loadError={error}
      onSubmitRsvp={(payload) => api.post(`/public/event/${eventId}/rsvp`, payload)}
    />
  );
}
