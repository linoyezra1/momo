import { useEffect, useMemo, useState } from "react";
import { Plus, X } from "lucide-react";
import api from "../api";
import { FEATURE_CHECKBOXES, emptyFeatures } from "../utils/agentFeatures.js";
import { isCoupleEventType } from "../utils/eventTypeWording";
import { uploadEventCover } from "../utils/eventCover.js";

const EVENT_TYPES = ["חתונה", "חינה", "אירוסין", "ברית", "בת מצווה", "אחר"];

function initialForm() {
  return {
    username: "",
    password: "",
    contactPhone: "",
    eventType: "חתונה",
    groomName: "",
    brideName: "",
    batMitzvahName: "",
    parentName1: "",
    parentName2: "",
    venueName: "",
    city: "",
    streetAndNumber: "",
    eventDate: "",
    eventTime: "",
    packageDescription: "",
    packagePrice: "",
    agentNotes: "",
    coverFile: null,
    coverPreviewUrl: "",
    includedFeatures: emptyFeatures()
  };
}

function formatMoney(value) {
  if (value == null || value === "") return "—";
  return `₪${Number(value).toLocaleString("he-IL", { maximumFractionDigits: 2 })}`;
}

export default function AgentDashboardPage() {
  const [clients, setClients] = useState([]);
  const [supplierCostGrandTotal, setSupplierCostGrandTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [form, setForm] = useState(initialForm);

  const loadClients = () => {
    setLoading(true);
    api
      .get("/agent/clients")
      .then((response) => {
        setClients(response.data?.clients || []);
        setSupplierCostGrandTotal(Number(response.data?.supplierCostGrandTotal) || 0);
      })
      .catch((loadError) => setError(loadError.response?.data?.message || "טעינת לקוחות נכשלה"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const totalRevenue = useMemo(
    () =>
      clients.reduce((sum, client) => {
        const price = Number(client.packagePrice);
        return sum + (Number.isFinite(price) && price > 0 ? price : 0);
      }, 0),
    [clients]
  );
  const netProfit = Math.round((totalRevenue - supplierCostGrandTotal) * 100) / 100;

  useEffect(() => {
    return () => {
      if (form.coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(form.coverPreviewUrl);
      }
    };
  }, [form.coverPreviewUrl]);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

  const openCreateForm = () => {
    setError("");
    setSuccess("");
    setForm(initialForm());
    setShowCreateForm(true);
  };

  const closeCreateForm = () => {
    if (form.coverPreviewUrl?.startsWith("blob:")) {
      URL.revokeObjectURL(form.coverPreviewUrl);
    }
    setShowCreateForm(false);
    setForm(initialForm());
  };

  const onCoverChange = (event) => {
    const file = event.target.files?.[0] || null;
    setForm((prev) => {
      if (prev.coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return {
        ...prev,
        coverFile: file,
        coverPreviewUrl: file ? URL.createObjectURL(file) : ""
      };
    });
  };

  const clearCover = () => {
    setForm((prev) => {
      if (prev.coverPreviewUrl?.startsWith("blob:")) {
        URL.revokeObjectURL(prev.coverPreviewUrl);
      }
      return { ...prev, coverFile: null, coverPreviewUrl: "" };
    });
  };

  const toggleFeature = (key) => {
    setForm((prev) => {
      const nextValue = !prev.includedFeatures?.[key];
      const includedFeatures = { ...prev.includedFeatures, [key]: nextValue };
      if (key === "eventDayTableNumber" || key === "canSendTableWhatsApp") {
        includedFeatures.eventDayTableNumber = nextValue;
        includedFeatures.canSendTableWhatsApp = nextValue;
      }
      return { ...prev, includedFeatures };
    });
  };

  const onSubmit = async (event) => {
    event.preventDefault();
    setError("");
    setSuccess("");

    if (!form.username.trim() || !form.password.trim()) {
      setError("יש למלא שם משתמש וסיסמה ללקוח");
      return;
    }
    if (!form.contactPhone.trim()) {
      setError("יש להזין טלפון איש קשר");
      return;
    }
    if (isCoupleEventType(form.eventType) && (!form.groomName.trim() || !form.brideName.trim())) {
      setError("יש למלא שם חתן ושם כלה");
      return;
    }

    setSaving(true);
    try {
      const payload = {
        username: form.username.trim(),
        password: form.password,
        contactPhone: form.contactPhone.trim(),
        event: {
          eventType: form.eventType,
          groomName: isCoupleEventType(form.eventType) ? form.groomName.trim() : "",
          brideName: isCoupleEventType(form.eventType) ? form.brideName.trim() : "",
          batMitzvahName: form.eventType === "בת מצווה" ? form.batMitzvahName.trim() : "",
          parentName1:
            form.eventType === "ברית" || form.eventType === "בת מצווה" ? form.parentName1.trim() : "",
          parentName2:
            form.eventType === "ברית" || form.eventType === "בת מצווה" ? form.parentName2.trim() : "",
          venueName: form.venueName.trim(),
          city: form.city.trim(),
          streetAndNumber: form.streetAndNumber.trim(),
          eventDate: form.eventDate,
          eventTime: form.eventTime
        },
        deal: {
          packageDescription: form.packageDescription.trim(),
          packagePrice: form.packagePrice === "" ? null : Number(form.packagePrice),
          agentNotes: form.agentNotes.trim(),
          includedFeatures: form.includedFeatures
        }
      };

      const response = await api.post("/agent/create-client", payload);
      const savedUserId = response.data?.userId;

      if (savedUserId && form.coverFile) {
        await uploadEventCover({
          api,
          endpoint: `/agent/clients/${savedUserId}/event/cover`,
          file: form.coverFile
        });
      }

      const wa = response.data?.welcomeWhatsApp;
      setSuccess(
        wa?.sent
          ? "הלקוח נוצר ונשלחה הודעת Welcome בוואטסאפ (פרטי גישה יתוזמנו בהמשך)."
          : `הלקוח נוצר. WhatsApp: ${wa?.reason || "לא נשלח"}`
      );
      closeCreateForm();
      loadClients();
    } catch (submitError) {
      setError(submitError.response?.data?.message || "יצירת לקוח נכשלה");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="agent-container agent-container--wide">
      <header className="agent-header">
        <h1>דשבורד עסקי</h1>
        <p>ניהול לקוחות, חבילות ותשלום לספק לפי קופונים</p>
      </header>

      <div className="agent-dash-summary">
        <div className="agent-dash-summary__card">
          <span>סה״כ הכנסות</span>
          <strong>{formatMoney(totalRevenue)}</strong>
        </div>
        <div className="agent-dash-summary__card">
          <span>סה״כ לתשלום לספק</span>
          <strong>{formatMoney(supplierCostGrandTotal)}</strong>
        </div>
        <div className="agent-dash-summary__card agent-dash-summary__card--profit">
          <span>סה״כ רווח נקי</span>
          <strong>{formatMoney(netProfit)}</strong>
        </div>
        <div className="agent-dash-summary__card">
          <span>לקוחות פעילים</span>
          <strong>{clients.length}</strong>
        </div>
      </div>

      {!showCreateForm ? (
        <div className="agent-create-cta">
          <button type="button" className="agent-btn agent-btn--primary" onClick={openCreateForm}>
            <Plus size={18} aria-hidden="true" />
            יצירת משתמש חדש
          </button>
        </div>
      ) : (
        <section className="agent-panel">
          <div className="agent-panel__head">
            <h2 className="agent-panel__title">יצירת לקוח / אירוע</h2>
            <button type="button" className="agent-icon-btn" onClick={closeCreateForm} aria-label="סגירה">
              <X size={18} />
            </button>
          </div>
          <form className="agent-form" onSubmit={onSubmit} noValidate>
            <div className="agent-form__grid">
              <label className="agent-field">
                <span>שם משתמש (לקוח)</span>
                <input
                  className="agent-field-input"
                  value={form.username}
                  onChange={(e) => setField("username", e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="agent-field">
                <span>סיסמה (לקוח)</span>
                <input
                  className="agent-field-input"
                  type="text"
                  value={form.password}
                  onChange={(e) => setField("password", e.target.value)}
                  autoComplete="off"
                  required
                />
              </label>
              <label className="agent-field">
                <span>טלפון איש קשר</span>
                <input
                  className="agent-field-input"
                  value={form.contactPhone}
                  onChange={(e) => setField("contactPhone", e.target.value)}
                  required
                />
              </label>
              <label className="agent-field">
                <span>סוג אירוע</span>
                <select
                  className="agent-field-input"
                  value={form.eventType}
                  onChange={(e) => setField("eventType", e.target.value)}
                >
                  {EVENT_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {type}
                    </option>
                  ))}
                </select>
              </label>
              {isCoupleEventType(form.eventType) ? (
                <>
                  <label className="agent-field">
                    <span>שם חתן</span>
                    <input
                      className="agent-field-input"
                      value={form.groomName}
                      onChange={(e) => setField("groomName", e.target.value)}
                    />
                  </label>
                  <label className="agent-field">
                    <span>שם כלה</span>
                    <input
                      className="agent-field-input"
                      value={form.brideName}
                      onChange={(e) => setField("brideName", e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              {form.eventType === "בת מצווה" ? (
                <label className="agent-field">
                  <span>שם בת המצווה</span>
                  <input
                    className="agent-field-input"
                    value={form.batMitzvahName}
                    onChange={(e) => setField("batMitzvahName", e.target.value)}
                  />
                </label>
              ) : null}
              {form.eventType === "ברית" || form.eventType === "בת מצווה" ? (
                <>
                  <label className="agent-field">
                    <span>הורה 1</span>
                    <input
                      className="agent-field-input"
                      value={form.parentName1}
                      onChange={(e) => setField("parentName1", e.target.value)}
                    />
                  </label>
                  <label className="agent-field">
                    <span>הורה 2</span>
                    <input
                      className="agent-field-input"
                      value={form.parentName2}
                      onChange={(e) => setField("parentName2", e.target.value)}
                    />
                  </label>
                </>
              ) : null}
              <label className="agent-field">
                <span>אולם / מקום</span>
                <input
                  className="agent-field-input"
                  value={form.venueName}
                  onChange={(e) => setField("venueName", e.target.value)}
                />
              </label>
              <label className="agent-field">
                <span>עיר</span>
                <input
                  className="agent-field-input"
                  value={form.city}
                  onChange={(e) => setField("city", e.target.value)}
                />
              </label>
              <label className="agent-field">
                <span>רחוב ומספר</span>
                <input
                  className="agent-field-input"
                  value={form.streetAndNumber}
                  onChange={(e) => setField("streetAndNumber", e.target.value)}
                />
              </label>
              <label className="agent-field">
                <span>תאריך</span>
                <input
                  className="agent-field-input"
                  type="date"
                  value={form.eventDate}
                  onChange={(e) => setField("eventDate", e.target.value)}
                />
              </label>
              <label className="agent-field">
                <span>שעה</span>
                <input
                  className="agent-field-input"
                  type="time"
                  value={form.eventTime}
                  onChange={(e) => setField("eventTime", e.target.value)}
                />
              </label>
            </div>

            <div className="agent-cover-field">
              <span className="agent-field-label">תמונת הזמנה / קאבר</span>
              <input className="agent-field-input" type="file" accept="image/*" onChange={onCoverChange} />
              {form.coverPreviewUrl ? (
                <div className="agent-cover-preview">
                  <img src={form.coverPreviewUrl} alt="תצוגה מקדימה" />
                  <button type="button" className="agent-btn" onClick={clearCover}>
                    הסרת תמונה
                  </button>
                </div>
              ) : null}
            </div>

            <fieldset className="agent-features">
              <legend>פיצ׳רים ללקוח</legend>
              <div className="agent-features__grid">
                {FEATURE_CHECKBOXES.map((feature) => (
                  <label key={feature.key} className="agent-feature-check">
                    <input
                      type="checkbox"
                      checked={Boolean(form.includedFeatures[feature.key])}
                      onChange={() => toggleFeature(feature.key)}
                    />
                    <span>{feature.label}</span>
                  </label>
                ))}
              </div>
            </fieldset>

            <div className="agent-form__grid">
              <label className="agent-field agent-field--full">
                <span>פירוט חבילה</span>
                <textarea
                  className="agent-field-input"
                  rows={2}
                  value={form.packageDescription}
                  onChange={(e) => setField("packageDescription", e.target.value)}
                />
              </label>
              <label className="agent-field">
                <span>מחיר חבילה (אופציונלי)</span>
                <input
                  className="agent-field-input"
                  type="number"
                  min="0"
                  step="1"
                  value={form.packagePrice}
                  onChange={(e) => setField("packagePrice", e.target.value)}
                />
              </label>
              <label className="agent-field agent-field--full">
                <span>הערות פנימיות</span>
                <textarea
                  className="agent-field-input"
                  rows={2}
                  value={form.agentNotes}
                  onChange={(e) => setField("agentNotes", e.target.value)}
                />
              </label>
            </div>

            {error ? <p className="agent-error">{error}</p> : null}

            <div className="agent-form__actions">
              <button className="agent-btn agent-btn--primary" type="submit" disabled={saving}>
                {saving ? "יוצר…" : "צור משתמש"}
              </button>
              <button className="agent-btn" type="button" onClick={closeCreateForm} disabled={saving}>
                ביטול
              </button>
            </div>
          </form>
        </section>
      )}

      {success ? <p className="agent-success">{success}</p> : null}

      <section className="agent-panel">
        <h2 className="agent-panel__title">הלקוחות שלי</h2>
        {loading ? <p className="agent-muted">טוען…</p> : null}
        {!loading && !clients.length ? <p className="agent-muted">עדיין לא נפתחו לקוחות</p> : null}
        <div className="agent-deal-list">
          {clients.map((client) => (
            <article key={client.userId} className="agent-deal-card">
              <h3>{client.eventLabel}</h3>
              <p className="agent-muted">{client.eventType}</p>
              <dl className="agent-deal-dl">
                <div>
                  <dt>הערות</dt>
                  <dd>{client.agentNotes || "—"}</dd>
                </div>
                <div>
                  <dt>מחיר חבילה</dt>
                  <dd>{formatMoney(client.packagePrice)}</dd>
                </div>
                <div>
                  <dt>פירוט חבילה</dt>
                  <dd>{client.packageDescription || "—"}</dd>
                </div>
                <div>
                  <dt>סה״כ לספק</dt>
                  <dd>{formatMoney(client.supplierCost)}</dd>
                </div>
              </dl>
              {client.coupons?.length ? (
                <div className="agent-coupon-list">
                  <h4>קופונים ותשלום לספק</h4>
                  <ul>
                    {client.coupons.map((coupon) => (
                      <li key={coupon.codeId || coupon.code}>
                        <span className="agent-coupon-list__code">{coupon.code}</span>
                        <span>
                          {coupon.total_credits} הודעות · {formatMoney(coupon.supplierCost)} לספק
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              ) : (
                <p className="agent-muted agent-coupon-empty">אין קופונים עדיין (מוגדרים באדמין)</p>
              )}
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
