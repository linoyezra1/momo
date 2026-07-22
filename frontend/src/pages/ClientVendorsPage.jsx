import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { MoreHorizontal, Phone, Plus, X } from "lucide-react";
import api from "../api";
import {
  EVENT_VENDOR_STATUS_LABELS,
  EVENT_VENDOR_STATUS_OPTIONS,
  VENDOR_CATEGORIES,
  buildTelHref,
  buildWhatsAppHref,
  formatIls
} from "../utils/vendors.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/vendors.css";

const emptyAssignForm = {
  mode: "existing",
  vendorId: "",
  quoteAmount: 0,
  status: "OFFER_SENT",
  eventNotes: "",
  attachmentUrl: "",
  createVendor: {
    name: "",
    category: "אחר",
    contactName: "",
    phone: "",
    email: "",
    notes: ""
  }
};

export default function ClientVendorsPage() {
  const { userId } = useParams();
  const [eventLabel, setEventLabel] = useState("");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({ totalProposed: 0, totalBooked: 0 });
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);

  const [editing, setEditing] = useState(null);
  const [menuOpenId, setMenuOpenId] = useState("");

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [listRes, catalogRes] = await Promise.all([
        api.get(`/client/${userId}/event-vendors`),
        api.get(`/client/${userId}/event-vendors/catalog`)
      ]);
      setEntries(listRes.data.eventVendors || []);
      setSummary(listRes.data.summary || { totalProposed: 0, totalBooked: 0 });
      setEventLabel(listRes.data.eventLabel || "");
      setCatalog(catalogRes.data.vendors || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת ספקי האירוע נכשלה");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

  useEffect(() => {
    if (!menuOpenId) return undefined;
    const onPointerDown = () => setMenuOpenId("");
    document.addEventListener("pointerdown", onPointerDown);
    return () => document.removeEventListener("pointerdown", onPointerDown);
  }, [menuOpenId]);

  const assignedVendorIds = useMemo(
    () => new Set(entries.map((item) => item.vendorId)),
    [entries]
  );

  const availableCatalog = useMemo(
    () => catalog.filter((vendor) => !assignedVendorIds.has(vendor.id)),
    [assignedVendorIds, catalog]
  );

  const openAssign = () => {
    setAssignForm({
      ...emptyAssignForm,
      createVendor: { ...emptyAssignForm.createVendor }
    });
    setShowAssign(true);
  };

  const submitAssign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = {
        quoteAmount: Number(assignForm.quoteAmount) || 0,
        status: assignForm.status,
        eventNotes: assignForm.eventNotes,
        attachmentUrl: assignForm.attachmentUrl
      };

      if (assignForm.mode === "existing") {
        if (!assignForm.vendorId) {
          setError("יש לבחור ספק מהמאגר");
          setSaving(false);
          return;
        }
        payload.vendorId = assignForm.vendorId;
      } else {
        payload.createVendor = assignForm.createVendor;
      }

      await api.post(`/client/${userId}/event-vendors`, payload);
      setShowAssign(false);
      await loadPage();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "הוספת הספק לאירוע נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (entry) => {
    setMenuOpenId("");
    setEditing({
      id: entry.id,
      quoteAmount: entry.quoteAmount || 0,
      status: entry.status,
      eventNotes: entry.eventNotes || "",
      attachmentUrl: entry.attachmentUrl || ""
    });
  };

  const saveEdit = async (event) => {
    event.preventDefault();
    if (!editing) return;
    setSaving(true);
    setError("");
    try {
      await api.patch(`/client/${userId}/event-vendors/${editing.id}`, {
        quoteAmount: Number(editing.quoteAmount) || 0,
        status: editing.status,
        eventNotes: editing.eventNotes,
        attachmentUrl: editing.attachmentUrl
      });
      setEditing(null);
      await loadPage();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "עדכון הספק נכשל");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async (entry, status) => {
    setMenuOpenId("");
    try {
      await api.patch(`/client/${userId}/event-vendors/${entry.id}`, {
        quoteAmount: entry.quoteAmount,
        status,
        eventNotes: entry.eventNotes,
        attachmentUrl: entry.attachmentUrl
      });
      await loadPage();
    } catch (statusError) {
      setError(statusError.response?.data?.message || "שינוי הסטטוס נכשל");
    }
  };

  const removeEntry = async (entry) => {
    setMenuOpenId("");
    if (!window.confirm(`להסיר את "${entry.vendor?.name || "הספק"}" מהאירוע?`)) return;
    try {
      await api.delete(`/client/${userId}/event-vendors/${entry.id}`);
      await loadPage();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "הסרת הספק נכשלה");
    }
  };

  return (
    <div className="us-client-portal il-client-portal us-dashboard-shell" dir="rtl" lang="he">
      <div className="us-dashboard-content">
        <header className="il-audit-log-page__header">
          <div className="il-audit-log-page__intro">
            <h1>ספקים והצעות מחיר</h1>
            <p>{eventLabel ? `ניהול ספקים עבור ${eventLabel}` : "ניהול ספקים והצעות מחיר לאירוע"}</p>
          </div>
          <Link className="us-btn us-btn--primary" to={`/client/dashboard/${userId}`}>
            חזרה לדף הראשי
          </Link>
        </header>

        <div className="il-vendor-summary-bar">
          <div>
            <span>סה״כ הצעות מחיר</span>
            <strong>{formatIls(summary.totalProposed)}</strong>
          </div>
          <div>
            <span>סה״כ ספקים שנסגרו</span>
            <strong>{formatIls(summary.totalBooked)}</strong>
          </div>
          <button className="us-btn us-btn--primary il-add-guest-btn" type="button" onClick={openAssign}>
            <Plus size={16} aria-hidden="true" />
            הוספת ספק לאירוע
          </button>
        </div>

        {error ? <p className="us-error-message">{error}</p> : null}
        {loading ? <p>טוען ספקים…</p> : null}

        <div className="us-table-wrap il-vendor-table-wrap">
          <table className="us-guest-table il-vendor-table">
            <thead>
              <tr>
                <th>ספק וקטגוריה</th>
                <th>איש קשר</th>
                <th>הצעת מחיר</th>
                <th>סטטוס</th>
                <th>הערות וקבצים</th>
                <th>פעולות</th>
              </tr>
            </thead>
            <tbody>
              {!loading && !entries.length ? (
                <tr>
                  <td colSpan={6} className="us-table-empty">
                    עדיין לא שויכו ספקים לאירוע
                  </td>
                </tr>
              ) : null}
              {entries.map((entry) => {
                const vendor = entry.vendor || {};
                const tel = buildTelHref(vendor.phone);
                const wa = buildWhatsAppHref(vendor.phone);
                return (
                  <tr key={entry.id}>
                    <td data-label="ספק">
                      <strong>{vendor.name || "—"}</strong>
                      <span className="il-vendor-table__sub">{vendor.category || ""}</span>
                    </td>
                    <td data-label="איש קשר">
                      <div className="il-vendor-contact-cell">
                        <span>{vendor.contactName || "—"}</span>
                        <span dir="ltr">{vendor.phone || "—"}</span>
                        <div className="il-vendor-contact-links">
                          {tel ? (
                            <a href={tel} aria-label="חיוג">
                              <Phone size={14} />
                            </a>
                          ) : null}
                          {wa ? (
                            <a href={wa} target="_blank" rel="noreferrer">
                              WhatsApp
                            </a>
                          ) : null}
                        </div>
                      </div>
                    </td>
                    <td data-label="הצעת מחיר">
                      <strong>{formatIls(entry.quoteAmount)}</strong>
                    </td>
                    <td data-label="סטטוס">
                      <span className={`il-vendor-status is-${entry.status}`}>
                        {EVENT_VENDOR_STATUS_LABELS[entry.status] || entry.status}
                      </span>
                    </td>
                    <td data-label="הערות">
                      <div className="il-vendor-notes-cell">
                        <span>{entry.eventNotes || "—"}</span>
                        {entry.attachmentUrl ? (
                          <a href={entry.attachmentUrl} target="_blank" rel="noreferrer">
                            קובץ מצורף
                          </a>
                        ) : null}
                      </div>
                    </td>
                    <td data-label="פעולות">
                      <div className="il-vendor-row-menu">
                        <button
                          type="button"
                          className="il-icon-btn"
                          aria-label="תפריט פעולות"
                          onClick={(event) => {
                            event.stopPropagation();
                            setMenuOpenId((prev) => (prev === entry.id ? "" : entry.id));
                          }}
                        >
                          <MoreHorizontal size={18} />
                        </button>
                        {menuOpenId === entry.id ? (
                          <div className="il-vendor-row-menu__panel" role="menu" onClick={(e) => e.stopPropagation()}>
                            <button type="button" role="menuitem" onClick={() => openEdit(entry)}>
                              עריכה
                            </button>
                            {EVENT_VENDOR_STATUS_OPTIONS.map((option) => (
                              <button
                                key={option.value}
                                type="button"
                                role="menuitem"
                                onClick={() => changeStatus(entry, option.value)}
                              >
                                סטטוס: {option.label}
                              </button>
                            ))}
                            <button type="button" role="menuitem" className="is-danger" onClick={() => removeEntry(entry)}>
                              מחיקה מהאירוע
                            </button>
                          </div>
                        ) : null}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {showAssign ? (
        <div className="us-modal-backdrop" role="presentation">
          <form className="us-modal-card il-vendor-modal" onSubmit={submitAssign}>
            <div className="il-vendor-modal__head">
              <h2 className="us-modal-title">הוספת ספק לאירוע</h2>
              <button type="button" className="us-btn" onClick={() => setShowAssign(false)}>
                <X size={16} />
              </button>
            </div>

            <div className="il-vendor-mode-tabs" role="tablist">
              <button
                type="button"
                className={assignForm.mode === "existing" ? "is-active" : ""}
                onClick={() => setAssignForm((prev) => ({ ...prev, mode: "existing" }))}
              >
                בחירה מהמאגר
              </button>
              <button
                type="button"
                className={assignForm.mode === "new" ? "is-active" : ""}
                onClick={() => setAssignForm((prev) => ({ ...prev, mode: "new" }))}
              >
                יצירת ספק חדש
              </button>
            </div>

            {assignForm.mode === "existing" ? (
              <label className="us-field-label" style={{ display: "block", marginTop: "1rem" }}>
                ספק
                <select
                  className="us-field-input"
                  value={assignForm.vendorId}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, vendorId: e.target.value }))}
                  required
                >
                  <option value="">בחרו ספק…</option>
                  {availableCatalog.map((vendor) => (
                    <option key={vendor.id} value={vendor.id}>
                      {vendor.name} · {vendor.category}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <div className="il-vendor-form-grid" style={{ marginTop: "1rem" }}>
                <label>
                  <span>שם ספק</span>
                  <input
                    required
                    value={assignForm.createVendor.name}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, name: e.target.value }
                      }))
                    }
                  />
                </label>
                <label>
                  <span>קטגוריה</span>
                  <select
                    value={assignForm.createVendor.category}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, category: e.target.value }
                      }))
                    }
                  >
                    {VENDOR_CATEGORIES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  <span>איש קשר</span>
                  <input
                    value={assignForm.createVendor.contactName}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, contactName: e.target.value }
                      }))
                    }
                  />
                </label>
                <label>
                  <span>טלפון</span>
                  <input
                    dir="ltr"
                    value={assignForm.createVendor.phone}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, phone: e.target.value }
                      }))
                    }
                  />
                </label>
              </div>
            )}

            <div className="il-vendor-form-grid" style={{ marginTop: "1rem" }}>
              <label>
                <span>סכום הצעה (₪)</span>
                <input
                  type="number"
                  min="0"
                  value={assignForm.quoteAmount}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, quoteAmount: e.target.value }))}
                />
              </label>
              <label>
                <span>סטטוס</span>
                <select
                  value={assignForm.status}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {EVENT_VENDOR_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="il-vendor-form-span">
                <span>הערות לאירוע</span>
                <textarea
                  rows={2}
                  value={assignForm.eventNotes}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, eventNotes: e.target.value }))}
                />
              </label>
              <label className="il-vendor-form-span">
                <span>קישור לקובץ / הצעה</span>
                <input
                  dir="ltr"
                  placeholder="https://…"
                  value={assignForm.attachmentUrl}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
                />
              </label>
            </div>

            <div className="us-toolbar mt-4">
              <button className="us-btn us-btn--primary" type="submit" disabled={saving}>
                {saving ? "שומר…" : "הוספה לאירוע"}
              </button>
              <button className="us-btn" type="button" onClick={() => setShowAssign(false)}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {editing ? (
        <div className="us-modal-backdrop" role="presentation">
          <form className="us-modal-card il-vendor-modal" onSubmit={saveEdit}>
            <h2 className="us-modal-title">עריכת שיוך ספק</h2>
            <div className="il-vendor-form-grid" style={{ marginTop: "1rem" }}>
              <label>
                <span>סכום הצעה (₪)</span>
                <input
                  type="number"
                  min="0"
                  value={editing.quoteAmount}
                  onChange={(e) => setEditing((prev) => ({ ...prev, quoteAmount: e.target.value }))}
                />
              </label>
              <label>
                <span>סטטוס</span>
                <select
                  value={editing.status}
                  onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
                >
                  {EVENT_VENDOR_STATUS_OPTIONS.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className="il-vendor-form-span">
                <span>הערות</span>
                <textarea
                  rows={2}
                  value={editing.eventNotes}
                  onChange={(e) => setEditing((prev) => ({ ...prev, eventNotes: e.target.value }))}
                />
              </label>
              <label className="il-vendor-form-span">
                <span>קישור לקובץ</span>
                <input
                  dir="ltr"
                  value={editing.attachmentUrl}
                  onChange={(e) => setEditing((prev) => ({ ...prev, attachmentUrl: e.target.value }))}
                />
              </label>
            </div>
            <div className="us-toolbar mt-4">
              <button className="us-btn us-btn--primary" type="submit" disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </button>
              <button className="us-btn" type="button" onClick={() => setEditing(null)}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </div>
  );
}
