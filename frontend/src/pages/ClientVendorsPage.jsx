import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, Navigate } from "react-router-dom";
import { Pencil, Phone, Plus, Trash2 } from "lucide-react";
import api from "../api";
import IconActionButton from "../components/IconActionButton.jsx";
import WhatsAppIcon from "../components/WhatsAppIcon.jsx";
import {
  EVENT_VENDOR_STATUS_LABELS,
  EVENT_VENDOR_STATUS_OPTIONS,
  VENDOR_CATEGORIES,
  vendorCategorySelectValue,
  vendorCustomCategoryValue,
  buildTelHref,
  buildWhatsAppHref,
  formatIls
} from "../utils/vendors.js";
import { useEventWorkspace } from "../utils/useEventWorkspace.js";
import { moneyFromStored, moneyToNumber, normalizeMoneyInput } from "../utils/moneyInput.js";
import "../us/client-portal.css";
import "../il/il-portal.css";
import "../il/vendors.css";
import "../il/manager-event.css";

const emptyAssignForm = {
  mode: "existing",
  vendorId: "",
  vendorQuoteAmount: "",
  couplePrice: "",
  agreedPrice: "",
  status: "NEGOTIATING",
  eventNotes: "",
  attachmentUrl: "",
  createVendor: {
    name: "",
    category: "אחר",
    customCategory: "",
    contactName: "",
    phone: "",
    email: "",
    notes: ""
  }
};

function calcProfit(vendorQuoteAmount, couplePrice) {
  return (Number(couplePrice) || 0) - (Number(vendorQuoteAmount) || 0);
}

export default function ClientVendorsPage() {
  const { userId, isManagerEvent, backPath, backLabel } = useEventWorkspace();
  const isCoupleView = !isManagerEvent;

  const [eventLabel, setEventLabel] = useState("");
  const [entries, setEntries] = useState([]);
  const [summary, setSummary] = useState({
    totalProposed: 0,
    totalBooked: 0,
    totalCost: 0,
    totalRevenue: 0,
    totalProfit: 0,
    totalAgreed: 0,
    vendorCount: 0,
    bookedCount: 0
  });
  const [finance, setFinance] = useState({ targetCoupleBudget: 0 });
  const [budgetWarning, setBudgetWarning] = useState({ exceeded: false, message: "" });
  const [catalog, setCatalog] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);
  const [accessDenied, setAccessDenied] = useState(false);

  const [showAssign, setShowAssign] = useState(false);
  const [assignForm, setAssignForm] = useState(emptyAssignForm);
  const [editing, setEditing] = useState(null);

  const listBase = isManagerEvent
    ? `/manager/clients/${userId}/event-vendors`
    : `/client/${userId}/event-vendors`;

  const loadPage = useCallback(async () => {
    setLoading(true);
    setError("");
    setAccessDenied(false);
    try {
      const listRes = await api.get(listBase);
      setEntries(listRes.data.eventVendors || []);
      setSummary(
        listRes.data.summary || {
          totalProposed: 0,
          totalBooked: 0,
          totalCost: 0,
          totalRevenue: 0,
          totalProfit: 0,
          totalAgreed: 0,
          vendorCount: 0,
          bookedCount: 0
        }
      );
      setFinance(listRes.data.finance || { targetCoupleBudget: 0 });
      setBudgetWarning(listRes.data.budgetWarning || { exceeded: false, message: "" });
      setEventLabel(listRes.data.eventLabel || "");

      if (isManagerEvent) {
        const catalogRes = await api.get("/manager/vendors");
        setCatalog(catalogRes.data.vendors || []);
      } else {
        setCatalog([]);
      }
    } catch (loadError) {
      if (loadError.response?.status === 403) {
        setAccessDenied(true);
        setError(loadError.response?.data?.message || "אין הרשאה לניהול ספקים");
      } else {
        setError(loadError.response?.data?.message || "טעינת ספקי האירוע נכשלה");
      }
    } finally {
      setLoading(false);
    }
  }, [isManagerEvent, listBase]);

  useEffect(() => {
    loadPage();
  }, [loadPage]);

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
      mode: isCoupleView ? "new" : "existing",
      createVendor: { ...emptyAssignForm.createVendor }
    });
    setShowAssign(true);
  };

  const submitAssign = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      const payload = isCoupleView
        ? {
            agreedPrice: moneyToNumber(assignForm.agreedPrice),
            status: assignForm.status,
            eventNotes: assignForm.eventNotes,
            attachmentUrl: assignForm.attachmentUrl,
            createVendor: assignForm.createVendor
          }
        : {
            vendorQuoteAmount: moneyToNumber(assignForm.vendorQuoteAmount),
            couplePrice: moneyToNumber(assignForm.couplePrice),
            status: assignForm.status,
            eventNotes: assignForm.eventNotes,
            attachmentUrl: assignForm.attachmentUrl
          };

      if (!isCoupleView) {
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
      } else if (!String(assignForm.createVendor?.name || "").trim()) {
        setError("שם הספק הוא שדה חובה");
        setSaving(false);
        return;
      }

      const { data } = await api.post(listBase, payload);
      if (data.budgetWarning?.exceeded) {
        setBudgetWarning(data.budgetWarning);
      }
      setShowAssign(false);
      await loadPage();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "הוספת הספק לאירוע נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const openEdit = (entry) => {
    if (isCoupleView) {
      setEditing({
        id: entry.id,
        agreedPrice: moneyFromStored(entry.agreedPrice ?? entry.couplePrice),
        status: entry.status === "OFFER_SENT" ? "NEGOTIATING" : entry.status,
        eventNotes: entry.eventNotes || "",
        attachmentUrl: entry.attachmentUrl || ""
      });
      return;
    }
    setEditing({
      id: entry.id,
      vendorQuoteAmount: moneyFromStored(entry.vendorQuoteAmount ?? entry.quoteAmount),
      couplePrice: moneyFromStored(entry.couplePrice),
      status: entry.status === "OFFER_SENT" ? "NEGOTIATING" : entry.status,
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
      const body = isCoupleView
        ? {
            agreedPrice: moneyToNumber(editing.agreedPrice),
            status: editing.status,
            eventNotes: editing.eventNotes,
            attachmentUrl: editing.attachmentUrl
          }
        : {
            vendorQuoteAmount: moneyToNumber(editing.vendorQuoteAmount),
            couplePrice: moneyToNumber(editing.couplePrice),
            status: editing.status,
            eventNotes: editing.eventNotes,
            attachmentUrl: editing.attachmentUrl
          };
      const { data } = await api.patch(`${listBase}/${editing.id}`, body);
      if (data.budgetWarning?.exceeded) {
        setBudgetWarning(data.budgetWarning);
      }
      setEditing(null);
      await loadPage();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "עדכון הספק נכשל");
    } finally {
      setSaving(false);
    }
  };

  const removeEntry = async (entry) => {
    if (!window.confirm(`להסיר את "${entry.vendor?.name || "הספק"}" מהאירוע?`)) return;
    try {
      await api.delete(`${listBase}/${entry.id}`);
      await loadPage();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "הסרת הספק נכשלה");
    }
  };

  if (accessDenied && isCoupleView) {
    return <Navigate to={`/client/dashboard/${userId}`} replace />;
  }

  const assignProfit = calcProfit(assignForm.vendorQuoteAmount, assignForm.couplePrice);
  const editProfit = editing && !isCoupleView
    ? calcProfit(editing.vendorQuoteAmount, editing.couplePrice)
    : 0;

  const pageBody = (
    <div className={isCoupleView ? "il-vendor-embedded us-dashboard-content" : "il-vendor-embedded"} dir="rtl" lang="he">
      <header className="il-audit-log-page__header" style={{ marginBottom: "1rem" }}>
        <div className="il-audit-log-page__intro">
          <h1>{isCoupleView ? "ניהול ספקים" : "ספקי אירוע"}</h1>
          <p>
            {eventLabel
              ? isCoupleView
                ? `מעקב ספקים עבור ${eventLabel}`
                : `ניהול ספקים עבור ${eventLabel}`
              : isCoupleView
                ? "מעקב ספקים, סטטוס ומחיר מוסכם"
                : "ניהול ספקים והצעות מחיר לאירוע"}
          </p>
        </div>
        {isCoupleView ? (
          <Link className="us-btn" to={backPath}>
            {backLabel}
          </Link>
        ) : null}
      </header>

      {!isCoupleView && budgetWarning.exceeded ? (
        <p className="il-budget-warning" role="status">
          {budgetWarning.message}
          {finance.targetCoupleBudget
            ? ` · תקציב יעד ${formatIls(finance.targetCoupleBudget)}`
            : ""}
        </p>
      ) : null}

      <div className="il-vendor-summary-bar">
        {isCoupleView ? (
          <>
            <div>
              <span>ספקים</span>
              <strong>{summary.vendorCount ?? entries.length}</strong>
            </div>
            <div>
              <span>הוזמנו</span>
              <strong>{summary.bookedCount ?? 0}</strong>
            </div>
            <div>
              <span>סה״כ מחיר מוסכם</span>
              <strong>{formatIls(summary.totalAgreed || 0)}</strong>
            </div>
          </>
        ) : (
          <>
            <div>
              <span>עלות ספקים</span>
              <strong>{formatIls(summary.totalCost ?? summary.totalProposed)}</strong>
            </div>
            <div>
              <span>מחיר לזוג</span>
              <strong>{formatIls(summary.totalRevenue || 0)}</strong>
            </div>
            <div>
              <span>רווח</span>
              <strong>{formatIls(summary.totalProfit || 0)}</strong>
            </div>
          </>
        )}
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
              {isCoupleView ? <th>מחיר מוסכם</th> : null}
              {!isCoupleView ? (
                <>
                  <th>הצעת מחיר ספק</th>
                  <th>הצעת מחיר לזוג</th>
                  <th>רווח</th>
                </>
              ) : null}
              <th>סטטוס</th>
              {isCoupleView ? <th>הערות / חוזה</th> : null}
              <th>פעולות</th>
            </tr>
          </thead>
          <tbody>
            {!loading && !entries.length ? (
              <tr>
                <td colSpan={isCoupleView ? 6 : 7} className="us-table-empty">
                  עדיין לא שויכו ספקים לאירוע
                </td>
              </tr>
            ) : null}
            {entries.map((entry) => {
              const vendor = entry.vendor || {};
              const tel = buildTelHref(vendor.phone);
              const wa = buildWhatsAppHref(vendor.phone);
              const cost = entry.vendorQuoteAmount ?? entry.quoteAmount ?? 0;
              const revenue = entry.couplePrice || 0;
              const profit = entry.profit ?? calcProfit(cost, revenue);
              const agreed = entry.agreedPrice ?? entry.couplePrice ?? 0;
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
                    </div>
                  </td>
                  {isCoupleView ? (
                    <td data-label="מחיר מוסכם">
                      <strong>{formatIls(agreed)}</strong>
                    </td>
                  ) : null}
                  {!isCoupleView ? (
                    <>
                      <td data-label="הצעת מחיר ספק">
                        <strong>{formatIls(cost)}</strong>
                      </td>
                      <td data-label="הצעת מחיר לזוג">
                        <strong>{formatIls(revenue)}</strong>
                      </td>
                      <td data-label="רווח">
                        <strong>{formatIls(profit)}</strong>
                      </td>
                    </>
                  ) : null}
                  <td data-label="סטטוס">
                    <span className={`il-vendor-status is-${entry.status}`}>
                      {EVENT_VENDOR_STATUS_LABELS[entry.status] || entry.status}
                    </span>
                  </td>
                  {isCoupleView ? (
                    <td data-label="הערות">
                      <span className="il-vendor-table__sub">
                        {entry.eventNotes || entry.attachmentUrl || "—"}
                      </span>
                    </td>
                  ) : null}
                  <td data-label="פעולות">
                    <div className="il-guest-actions">
                      {wa ? (
                        <IconActionButton
                          as="a"
                          className="il-icon-action--whatsapp"
                          href={wa}
                          target="_blank"
                          rel="noreferrer"
                          tooltip="וואטסאפ"
                        >
                          <WhatsAppIcon size={18} />
                        </IconActionButton>
                      ) : (
                        <IconActionButton className="il-icon-action--whatsapp is-disabled" tooltip="אין מספר וואטסאפ" disabled>
                          <WhatsAppIcon size={18} />
                        </IconActionButton>
                      )}
                      {tel ? (
                        <IconActionButton as="a" className="il-icon-action--phone" href={tel} tooltip="חיוג">
                          <Phone size={16} />
                        </IconActionButton>
                      ) : (
                        <IconActionButton className="il-icon-action--phone is-disabled" tooltip="אין מספר טלפון" disabled>
                          <Phone size={16} />
                        </IconActionButton>
                      )}
                      <IconActionButton tooltip="עריכה" onClick={() => openEdit(entry)}>
                        <Pencil size={16} />
                      </IconActionButton>
                      <IconActionButton
                        className="il-icon-action--danger"
                        tooltip="מחיקה"
                        onClick={() => removeEntry(entry)}
                      >
                        <Trash2 size={16} />
                      </IconActionButton>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <div className="il-vendor-mobile-cards" aria-label="רשימת ספקים">
        {!loading && !entries.length ? (
          <p className="il-vendor-mobile-cards__empty">עדיין לא שויכו ספקים לאירוע</p>
        ) : null}
        {entries.map((entry) => {
          const vendor = entry.vendor || {};
          const tel = buildTelHref(vendor.phone);
          const wa = buildWhatsAppHref(vendor.phone);
          const cost = entry.vendorQuoteAmount ?? entry.quoteAmount ?? 0;
          const revenue = entry.couplePrice || 0;
          const profit = entry.profit ?? calcProfit(cost, revenue);
          const agreed = entry.agreedPrice ?? entry.couplePrice ?? 0;
          return (
            <article key={`mobile-${entry.id}`} className="il-vendor-mobile-card">
              <div className="il-vendor-mobile-card__row">
                <div className="il-vendor-mobile-card__main">
                  <strong className="il-vendor-mobile-card__name">{vendor.name || "—"}</strong>
                  <span className="il-vendor-mobile-card__tags">
                    {vendor.category ? (
                      <span className="il-vendor-mobile-card__category">{vendor.category}</span>
                    ) : null}
                    <span className={`il-vendor-status is-${entry.status}`}>
                      {EVENT_VENDOR_STATUS_LABELS[entry.status] || entry.status}
                    </span>
                  </span>
                </div>
                <strong className="il-vendor-mobile-card__price">
                  {formatIls(isCoupleView ? agreed : revenue)}
                </strong>
              </div>

              <div className="il-vendor-mobile-card__meta">
                <span>{vendor.contactName || "—"}</span>
                <span dir="ltr">{vendor.phone || "—"}</span>
                {!isCoupleView ? <span>עלות ספק {formatIls(cost)} · רווח {formatIls(profit)}</span> : null}
                {isCoupleView && (entry.eventNotes || entry.attachmentUrl) ? (
                  <span className="il-vendor-mobile-card__notes">
                    {entry.eventNotes || entry.attachmentUrl}
                  </span>
                ) : null}
              </div>

              <div className="il-vendor-mobile-card__actions">
                {wa ? (
                  <a className="il-vendor-mobile-card__action is-whatsapp" href={wa} target="_blank" rel="noreferrer" aria-label="וואטסאפ">
                    <WhatsAppIcon size={18} />
                  </a>
                ) : (
                  <span className="il-vendor-mobile-card__action is-disabled" aria-hidden="true">
                    <WhatsAppIcon size={18} />
                  </span>
                )}
                {tel ? (
                  <a className="il-vendor-mobile-card__action" href={tel} aria-label="חיוג">
                    <Phone size={16} />
                  </a>
                ) : (
                  <span className="il-vendor-mobile-card__action is-disabled" aria-hidden="true">
                    <Phone size={16} />
                  </span>
                )}
                <button type="button" className="il-vendor-mobile-card__action" onClick={() => openEdit(entry)} aria-label="עריכה">
                  <Pencil size={16} />
                </button>
                <button
                  type="button"
                  className="il-vendor-mobile-card__action is-danger"
                  onClick={() => removeEntry(entry)}
                  aria-label="מחיקה"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </article>
          );
        })}
      </div>

      {showAssign ? (
        <div className="us-modal-backdrop" role="presentation">
          <form className="us-modal-card" onSubmit={submitAssign} dir="rtl">
            <h2 className="us-modal-title">הוספת ספק לאירוע</h2>
            {isCoupleView ? null : (
              <div className="us-admin-field">
                <label className="us-admin-field-label">מקור ספק</label>
                <select
                  className="us-admin-field-input"
                  value={assignForm.mode}
                  onChange={(e) => setAssignForm((prev) => ({ ...prev, mode: e.target.value }))}
                >
                  <option value="existing">מהמאגר</option>
                  <option value="new">ספק חדש</option>
                </select>
              </div>
            )}
            {!isCoupleView && assignForm.mode === "existing" ? (
              <div className="us-admin-field">
                <label className="us-admin-field-label">ספק</label>
                <select
                  className="us-admin-field-input"
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
              </div>
            ) : (
              <>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">שם ספק</label>
                  <input
                    className="us-admin-field-input"
                    value={assignForm.createVendor.name}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, name: e.target.value }
                      }))
                    }
                    required
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">קטגוריה</label>
                  <select
                    className="us-admin-field-input"
                    value={vendorCategorySelectValue(assignForm.createVendor.category)}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: {
                          ...prev.createVendor,
                          category: e.target.value,
                          customCategory:
                            e.target.value === "אחר" ? prev.createVendor.customCategory : ""
                        }
                      }))
                    }
                  >
                    {VENDOR_CATEGORIES.map((category) => (
                      <option key={category} value={category}>
                        {category}
                      </option>
                    ))}
                  </select>
                </div>
                {vendorCategorySelectValue(assignForm.createVendor.category) === "אחר" ? (
                  <div className="us-admin-field">
                    <label className="us-admin-field-label">קטגוריה חופשית</label>
                    <input
                      className="us-admin-field-input"
                      placeholder="לדוגמה: רב, הפעלת ילדים…"
                      value={assignForm.createVendor.customCategory}
                      onChange={(e) =>
                        setAssignForm((prev) => ({
                          ...prev,
                          createVendor: { ...prev.createVendor, customCategory: e.target.value }
                        }))
                      }
                    />
                  </div>
                ) : null}
                <div className="us-admin-field">
                  <label className="us-admin-field-label">טלפון</label>
                  <input
                    className="us-admin-field-input"
                    value={assignForm.createVendor.phone}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        createVendor: { ...prev.createVendor, phone: e.target.value }
                      }))
                    }
                  />
                </div>
              </>
            )}
            {isCoupleView ? (
              <div className="us-admin-field">
                <label className="us-admin-field-label">מחיר מוסכם / תקציב</label>
                <input
                  className="us-admin-field-input il-money-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={assignForm.agreedPrice}
                  onChange={(e) =>
                    setAssignForm((prev) => ({
                      ...prev,
                      agreedPrice: normalizeMoneyInput(e.target.value)
                    }))
                  }
                />
              </div>
            ) : (
              <>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">הצעת מחיר ספק (עלות)</label>
                  <input
                    className="us-admin-field-input il-money-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={assignForm.vendorQuoteAmount}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        vendorQuoteAmount: normalizeMoneyInput(e.target.value)
                      }))
                    }
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">הצעת מחיר לזוג (הכנסה)</label>
                  <input
                    className="us-admin-field-input il-money-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={assignForm.couplePrice}
                    onChange={(e) =>
                      setAssignForm((prev) => ({
                        ...prev,
                        couplePrice: normalizeMoneyInput(e.target.value)
                      }))
                    }
                  />
                </div>
                <p>
                  רווח מחושב: <strong>{formatIls(assignProfit)}</strong>
                </p>
                {finance.targetCoupleBudget > 0 &&
                summary.totalRevenue + moneyToNumber(assignForm.couplePrice) > finance.targetCoupleBudget ? (
                  <p className="il-budget-warning">חריגה מתקציב היעד</p>
                ) : null}
              </>
            )}
            <div className="us-admin-field">
              <label className="us-admin-field-label">סטטוס</label>
              <select
                className="us-admin-field-input"
                value={assignForm.status}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, status: e.target.value }))}
              >
                {EVENT_VENDOR_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="us-admin-field">
              <label className="us-admin-field-label">הערות / חוזה</label>
              <textarea
                className="us-admin-field-input"
                rows={2}
                value={assignForm.eventNotes}
                onChange={(e) => setAssignForm((prev) => ({ ...prev, eventNotes: e.target.value }))}
              />
            </div>
            <div className="us-modal-actions">
              <button className="us-btn us-btn--primary" type="submit" disabled={saving}>
                {saving ? "שומר…" : "הוספה"}
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
          <form className="us-modal-card" onSubmit={saveEdit} dir="rtl">
            <h2 className="us-modal-title">{isCoupleView ? "עריכת ספק" : "עריכת הצעת מחיר"}</h2>
            {isCoupleView ? (
              <div className="us-admin-field">
                <label className="us-admin-field-label">מחיר מוסכם / תקציב</label>
                <input
                  className="us-admin-field-input il-money-input"
                  type="text"
                  inputMode="decimal"
                  autoComplete="off"
                  placeholder="0"
                  value={editing.agreedPrice}
                  onChange={(e) =>
                    setEditing((prev) => ({
                      ...prev,
                      agreedPrice: normalizeMoneyInput(e.target.value)
                    }))
                  }
                />
              </div>
            ) : (
              <>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">הצעת מחיר ספק (עלות)</label>
                  <input
                    className="us-admin-field-input il-money-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={editing.vendorQuoteAmount}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        vendorQuoteAmount: normalizeMoneyInput(e.target.value)
                      }))
                    }
                  />
                </div>
                <div className="us-admin-field">
                  <label className="us-admin-field-label">הצעת מחיר לזוג (הכנסה)</label>
                  <input
                    className="us-admin-field-input il-money-input"
                    type="text"
                    inputMode="decimal"
                    autoComplete="off"
                    placeholder="0"
                    value={editing.couplePrice}
                    onChange={(e) =>
                      setEditing((prev) => ({
                        ...prev,
                        couplePrice: normalizeMoneyInput(e.target.value)
                      }))
                    }
                  />
                </div>
                <p>
                  רווח מחושב: <strong>{formatIls(editProfit)}</strong>
                </p>
              </>
            )}
            <div className="us-admin-field">
              <label className="us-admin-field-label">סטטוס</label>
              <select
                className="us-admin-field-input"
                value={editing.status}
                onChange={(e) => setEditing((prev) => ({ ...prev, status: e.target.value }))}
              >
                {EVENT_VENDOR_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="us-admin-field">
              <label className="us-admin-field-label">הערות / חוזה</label>
              <textarea
                className="us-admin-field-input"
                rows={2}
                value={editing.eventNotes}
                onChange={(e) => setEditing((prev) => ({ ...prev, eventNotes: e.target.value }))}
              />
            </div>
            <div className="us-modal-actions">
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

  if (isCoupleView) {
    return (
      <div className="il-client-portal us-dashboard" dir="rtl" lang="he">
        {pageBody}
      </div>
    );
  }

  return pageBody;
}
