import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../api";
import IlInviteExperience from "../il/invite/IlInviteExperience.jsx";

export default function EventPage() {
  const { eventId } = useParams();
  const [eventData, setEventData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    setLoading(true);
    setError("");
    api
      .get(`/public/event/${eventId}`)
      .then((response) => setEventData(response.data))
      .catch(() => setError("לא ניתן לטעון את פרטי האירוע"))
      .finally(() => setLoading(false));
  }, [eventId]);

  return (
    <IlInviteExperience
      event={eventData?.event}
      loading={loading}
      loadError={error}
      onSubmitRsvp={(payload) => api.post(`/public/event/${eventId}/rsvp`, payload)}
    />
  );
}
