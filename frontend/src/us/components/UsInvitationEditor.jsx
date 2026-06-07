import { useEffect, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import api from "../../api.js";
import {
  eventFormToPublicPayload,
  eventInfoToForm,
  formToEventUpdatePayload
} from "../../utils/usEventPreview.js";
import UsInvitationPreview from "./UsInvitationPreview.jsx";
import "../us.css";

const emptyTimelineItem = { time: "", title: "" };

export default function UsInvitationEditor({ userId, eventInfo, slug, onClose, onSaved }) {
  const [form, setForm] = useState(() => eventInfoToForm(eventInfo));
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState("");

  const previewEvent = useMemo(
    () => eventFormToPublicPayload(form, slug, userId),
    [form, slug, userId]
  );

  useEffect(() => {
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow || "unset";
    };
  }, []);

  function onChange(event) {
    const { name, value, type, checked } = event.target;
    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value
    }));
  }

  function onTimelineChange(index, field, value) {
    setForm((prev) => {
      const timeline = [...prev.timeline];
      timeline[index] = { ...timeline[index], [field]: value };
      return { ...prev, timeline };
    });
  }

  function addTimelineItem() {
    setForm((prev) => ({ ...prev, timeline: [...prev.timeline, { ...emptyTimelineItem }] }));
  }

  function removeTimelineItem(index) {
    setForm((prev) => ({
      ...prev,
      timeline: prev.timeline.filter((_, itemIndex) => itemIndex !== index)
    }));
  }

  async function handleSave() {
    setSaving(true);
    setToast("");
    try {
      const response = await api.put(`/client/${userId}/event`, formToEventUpdatePayload(form));
      onSaved(response.data.event);
      setToast("Your live wedding invitation has been updated successfully!");
      window.setTimeout(() => setToast(""), 4000);
    } catch (saveError) {
      setToast(saveError.response?.data?.message || "Failed to save invitation changes.");
    } finally {
      setSaving(false);
    }
  }

  return createPortal(
    <div className="us-invitation-editor" dir="ltr" lang="en-US">
      <div className="us-invitation-editor__topbar">
        <div>
          <p className="us-invitation-editor__eyebrow">Design &amp; Details Portal</p>
          <h2 className="us-invitation-editor__title">Edit Invitation &amp; Live Preview</h2>
        </div>
        <button type="button" className="us-invitation-editor__close" onClick={onClose} aria-label="Close editor">
          <X size={20} />
        </button>
      </div>

      <div className="us-invitation-editor__layout min-h-0 flex-1 overflow-hidden">
        <div className="us-invitation-editor__form-panel h-full min-h-0 overflow-y-auto overscroll-y-contain pr-2 lg:h-[calc(100vh-8.5rem)] lg:max-h-[calc(100vh-8.5rem)]">
          <section className="us-editor-section">
            <h3>General Info</h3>
            <label className="us-editor-field">
              Host Names
              <input name="hostNames" value={form.hostNames} onChange={onChange} placeholder="Emma & Lucas" />
            </label>
            <label className="us-editor-field">
              Intro Text
              <input name="introText" value={form.introText} onChange={onChange} placeholder="Together with their families" />
            </label>
            <label className="us-editor-field">
              Celebration Text
              <input
                name="celebrationText"
                value={form.celebrationText}
                onChange={onChange}
                placeholder="Invite you to their wedding celebration"
              />
            </label>
            <div className="us-editor-grid-2">
              <label className="us-editor-field">
                Date (formatted)
                <input
                  name="eventDateFormatted"
                  value={form.eventDateFormatted}
                  onChange={onChange}
                  placeholder="Saturday, July 22, 2027"
                />
              </label>
              <label className="us-editor-field">
                Time
                <input name="eventTime" value={form.eventTime} onChange={onChange} placeholder="at 3:30 pm" />
              </label>
            </div>
            <label className="us-editor-field">
              Countdown Date &amp; Time
              <input
                type="datetime-local"
                name="countdownTargetDate"
                lang="en-US"
                value={form.countdownTargetDate}
                onChange={onChange}
              />
            </label>
          </section>

          <section className="us-editor-section">
            <h3>The Venue</h3>
            <label className="us-editor-field">
              Venue Name
              <input name="venueName" value={form.venueName} onChange={onChange} placeholder="The Grand Estate" />
            </label>
            <label className="us-editor-field">
              Description
              <textarea name="venueDescription" rows={3} value={form.venueDescription} onChange={onChange} />
            </label>
            <label className="us-editor-field">
              Address
              <input name="venueAddress" value={form.venueAddress} onChange={onChange} placeholder="123 Garden Lane" />
            </label>
            <label className="us-editor-field">
              Google Maps Link
              <input name="venueMapsLink" value={form.venueMapsLink} onChange={onChange} placeholder="https://maps.google.com/..." />
            </label>
          </section>

          <section className="us-editor-section">
            <h3>Event Logistics</h3>
            <label className="us-editor-field">
              Dress Code
              <textarea name="dressCode" rows={2} value={form.dressCode} onChange={onChange} />
            </label>
            <label className="us-editor-field">
              RSVP Deadline Text
              <input name="deadlineText" value={form.deadlineText} onChange={onChange} placeholder="Kindly respond by June 1st" />
            </label>
            <label className="us-editor-field">
              Registry Link
              <input name="registryLink" value={form.registryLink} onChange={onChange} placeholder="https://..." />
            </label>

            <label className="us-editor-checkbox">
              <input type="checkbox" name="includeTimeline" checked={form.includeTimeline} onChange={onChange} />
              Include Event Timeline
            </label>
            {form.includeTimeline ? (
              <div className="us-editor-subpanel">
                {form.timeline.map((item, index) => (
                  <div key={`timeline-${index}`} className="us-editor-grid-2 us-editor-grid-2--actions">
                    <input
                      placeholder="3:30 PM"
                      value={item.time}
                      onChange={(event) => onTimelineChange(index, "time", event.target.value)}
                    />
                    <input
                      placeholder="Wedding Ceremony"
                      value={item.title}
                      onChange={(event) => onTimelineChange(index, "title", event.target.value)}
                    />
                    {form.timeline.length > 1 ? (
                      <button type="button" className="us-editor-link-btn" onClick={() => removeTimelineItem(index)}>
                        Remove
                      </button>
                    ) : null}
                  </div>
                ))}
                <button type="button" className="us-editor-link-btn" onClick={addTimelineItem}>
                  + Add timeline item
                </button>
              </div>
            ) : null}

            <label className="us-editor-checkbox">
              <input type="checkbox" name="includeTransportation" checked={form.includeTransportation} onChange={onChange} />
              Include Transportation
            </label>
            {form.includeTransportation ? (
              <textarea name="transportation" rows={3} value={form.transportation} onChange={onChange} />
            ) : null}

            <label className="us-editor-checkbox">
              <input
                type="checkbox"
                name="includeAccommodation"
                checked={form.includeAccommodation}
                onChange={onChange}
              />
              Include Accommodation
            </label>
            {form.includeAccommodation ? (
              <div className="us-editor-subpanel">
                <input
                  name="accommodationTitle"
                  placeholder="Stay at Marriott Hotel"
                  value={form.accommodationTitle}
                  onChange={onChange}
                />
                <input
                  name="accommodationSubtitle"
                  placeholder="Rates from $250 per night"
                  value={form.accommodationSubtitle}
                  onChange={onChange}
                />
                <textarea name="accommodationBody" rows={3} value={form.accommodationBody} onChange={onChange} />
              </div>
            ) : null}
          </section>
        </div>

        <div className="us-invitation-editor__preview-panel sticky top-0 flex h-full min-h-0 flex-col self-start lg:max-h-[calc(100vh-8.5rem)]">
          <p className="us-invitation-editor__preview-label shrink-0">Live Preview</p>
          <div className="us-invitation-editor__preview-frame min-h-0 flex-1 overflow-y-auto overscroll-y-contain">
            <div className="us-invitation-editor__preview-scale">
              <UsInvitationPreview event={previewEvent} slug={slug} />
            </div>
          </div>
        </div>
      </div>

      <div className="us-invitation-editor__footer">
        {toast ? <p className="us-invitation-editor__toast">{toast}</p> : <span />}
        <button type="button" className="us-invitation-editor__save" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </div>
    </div>,
    document.body
  );
}
