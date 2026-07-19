import { useEffect, useState } from "react";
import api from "../api";

const RSVP_STATUS_OPTIONS = [
  { value: "מגיע", label: "מגיע" },
  { value: "לא מגיע", label: "לא מגיע" },
  { value: "אולי", label: "אולי" }
];

function buildInitialForm(guest) {
  return {
    currentCallRound: guest?.currentCallRound ? String(guest.currentCallRound) : "",
    callStatus: guest?.callStatus || "",
    agentNotes: guest?.agentNotes || "",
    status: "",
    attendeesCount: guest?.attendeesCount ?? ""
  };
}

export default function AgentPhoneRsvpForm({ guest, userId, onSaved }) {
  const [form, setForm] = useState(() => buildInitialForm(guest));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    setForm(buildInitialForm(guest));
    setError("");
    setSuccess("");
  }, [guest._id, guest.callTimestamp, guest.callStatus, guest.currentCallRound, guest.agentNotes]);

  const isAnswered = form.callStatus === "answered";
  const showRsvpFields = isAnswered;

  const onChange = (field, value) => {
    setForm((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "status" && value === "מגיע" && (prev.attendeesCount === "" || prev.attendeesCount == null)) {
        next.attendeesCount = 1;
      }
      if (field === "status" && value === "לא מגיע") {
        next.attendeesCount = 0;
      }
      if (field === "callStatus" && value !== "answered") {
        next.status = "";
      }
      return next;
    });
    setError("");
    setSuccess("");
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.currentCallRound) {
      setError("יש לבחור סבב שיחה");
      return;
    }
    if (!form.callStatus) {
      setError("יש לבחור סטטוס שיחה");
      return;
    }

    const payload = {
      currentCallRound: Number(form.currentCallRound),
      callStatus: form.callStatus,
      agentNotes: form.agentNotes
    };

    if (isAnswered && form.status) {
      payload.status = form.status;
      if (form.status === "מגיע") {
        payload.attendeesCount =
          form.attendeesCount === "" || form.attendeesCount == null ? 1 : Number(form.attendeesCount);
      } else if (form.attendeesCount !== "" && form.attendeesCount != null) {
        payload.attendeesCount = Number(form.attendeesCount);
      }
    }

    setSaving(true);
    try {
      const response = await api.patch(`/agent/${userId}/guests/${guest._id}/phone-rsvp`, payload);
      setSuccess("נשמר בהצלחה");
      onSaved?.(response.data?.guest || guest);
      setForm((prev) => ({ ...prev, status: "" }));
    } catch (submitError) {
      setError(submitError.response?.data?.message || "שמירה נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="agent-phone-form" onSubmit={onSubmit}>
      <div className="agent-phone-form__grid">
        <div className="agent-field">
          <label className="agent-field-label" htmlFor={`round-${guest._id}`}>
            סבב שיחה *
          </label>
          <select
            id={`round-${guest._id}`}
            className="agent-field-input"
            value={form.currentCallRound}
            onChange={(event) => onChange("currentCallRound", event.target.value)}
          >
            <option value="">בחרו סבב</option>
            <option value="1">סבב 1</option>
            <option value="2">סבב 2</option>
          </select>
        </div>

        <div className="agent-field">
          <span className="agent-field-label">סטטוס שיחה *</span>
          <div className="agent-binary-toggle" role="group" aria-label="סטטוס שיחה">
            <button
              type="button"
              className={`agent-toggle-btn${form.callStatus === "answered" ? " is-active" : ""}`}
              onClick={() => onChange("callStatus", "answered")}
            >
              ענה
            </button>
            <button
              type="button"
              className={`agent-toggle-btn${form.callStatus === "no_answer" ? " is-active" : ""}`}
              onClick={() => onChange("callStatus", "no_answer")}
            >
              לא ענה
            </button>
            <button
              type="button"
              className={`agent-toggle-btn${form.callStatus === "disconnected" ? " is-active" : ""}`}
              onClick={() => onChange("callStatus", "disconnected")}
            >
              מנותק
            </button>
          </div>
        </div>
      </div>

      <div className="agent-field">
        <label className="agent-field-label" htmlFor={`notes-${guest._id}`}>
          מלל חופשי (אופציונלי)
        </label>
        <textarea
          id={`notes-${guest._id}`}
          className="agent-field-input agent-field-textarea"
          rows={3}
          value={form.agentNotes}
          onChange={(event) => onChange("agentNotes", event.target.value)}
          placeholder="הערות הנציג מהשיחה…"
        />
      </div>

      {showRsvpFields ? (
        <div className="agent-rsvp-panel">
          <p className="agent-rsvp-panel__title">עדכון סטטוס הגעה (אופציונלי)</p>
          <div className="agent-status-group" role="group" aria-label="סטטוס הגעה">
            {RSVP_STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className={`agent-status-btn agent-status-btn--${option.value}${form.status === option.value ? " is-selected" : ""}`}
                onClick={() => onChange("status", option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>

          {form.status === "מגיע" || form.status === "אולי" ? (
            <div className="agent-field">
              <label className="agent-field-label" htmlFor={`count-${guest._id}`}>
                כמה מגיעים?
              </label>
              <input
                id={`count-${guest._id}`}
                className="agent-field-input"
                type="number"
                min="0"
                value={form.attendeesCount}
                onChange={(event) => onChange("attendeesCount", event.target.value)}
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {error ? <p className="agent-error">{error}</p> : null}
      {success ? <p className="agent-success">{success}</p> : null}

      <button className="agent-btn agent-btn--primary" type="submit" disabled={saving}>
        {saving ? "שומר…" : "שמירת רשומת שיחה"}
      </button>
    </form>
  );
}
