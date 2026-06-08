import { useState } from "react";
import IlInviteCountdown from "./IlInviteCountdown.jsx";
import IlInviteFloral from "./IlInviteFloral.jsx";
import IlInviteHero from "./IlInviteHero.jsx";
import IlInviteRsvp from "./IlInviteRsvp.jsx";
import IlInviteSchedule from "./IlInviteSchedule.jsx";
import "./il-invite.css";

const initialRsvp = {
  fullName: "",
  phone: "",
  attendeesCount: 1,
  status: "מגיע"
};

function attendeesCountForStatus(status, currentCount) {
  if (status === "מגיע") return Math.max(1, Number(currentCount) || 1);
  if (status === "לא מגיע") return 0;
  if (status === "אולי") return 1;
  return currentCount;
}

export default function IlInviteExperience({
  event,
  previewMode = false,
  onSubmitRsvp,
  loading = false,
  loadError = ""
}) {
  const [form, setForm] = useState(initialRsvp);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  if (loading) {
    return (
      <div className="il-invite-page il-invite-page--state">
        <p className="il-invite-state">טוען את פרטי האירוע…</p>
      </div>
    );
  }

  if (loadError && !event) {
    return (
      <div className="il-invite-page il-invite-page--state">
        <p className="il-invite-state il-invite-error">{loadError}</p>
      </div>
    );
  }

  if (!event) return null;

  function onChange(changeEvent) {
    const { name, value } = changeEvent.target;
    setForm((prev) => ({
      ...prev,
      [name]: name === "attendeesCount" ? Number(value) : value
    }));
  }

  function onStatusChange(status) {
    setForm((prev) => ({
      ...prev,
      status,
      attendeesCount: attendeesCountForStatus(status, prev.attendeesCount)
    }));
  }

  function onIncrease() {
    setForm((prev) => ({ ...prev, attendeesCount: Math.min(20, Number(prev.attendeesCount || 0) + 1) }));
  }

  function onDecrease() {
    setForm((prev) => ({ ...prev, attendeesCount: Math.max(1, Number(prev.attendeesCount || 1) - 1) }));
  }

  async function onSubmit(submitEvent) {
    submitEvent.preventDefault();
    if (previewMode || !onSubmitRsvp) return;
    setMessage("");
    setError("");
    setSubmitting(true);
    try {
      const payload = {
        ...form,
        attendeesCount: attendeesCountForStatus(form.status, form.attendeesCount)
      };
      await onSubmitRsvp(payload);
      setMessage("תודה! האישור נשמר בהצלחה");
      setForm(initialRsvp);
    } catch (submitError) {
      setError(submitError?.response?.data?.message || "שליחת הטופס נכשלה. נסו שוב.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className={`il-invite-page${previewMode ? " il-invite-page--preview" : ""}`} dir="rtl" lang="he">
      <IlInviteFloral />
      <div className="il-invite-flow">
        <IlInviteHero event={event} />
        <IlInviteCountdown event={event} />
        <IlInviteSchedule event={event} />
        <IlInviteRsvp
          previewMode={previewMode}
          form={form}
          message={message}
          error={error}
          submitting={submitting}
          onChange={onChange}
          onStatusChange={onStatusChange}
          onSubmit={onSubmit}
          onIncrease={onIncrease}
          onDecrease={onDecrease}
          event={event}
        />
      </div>
    </div>
  );
}
