import { useEffect, useState } from "react";
import api from "../api";
import { FEATURE_CHECKBOXES, emptyFeatures, randomCoupleCredentials } from "../utils/agentFeatures.js";
import { isCoupleEventType } from "../utils/eventTypeWording";

const EVENT_TYPES = ["חתונה", "חינה", "אירוסין", "ברית", "בת מצווה", "אחר"];

function initialForm() {
  const creds = randomCoupleCredentials();
  return {
    username: creds.username,
    password: creds.password,
    contactPhone: "",
    eventType: "חתונה",
    groomName: "",
    brideName: "",
    batMitzvahName: "",
    parentName1: "",
    parentName2: "",
    venueName: "",
    eventDate: "",
    eventTime: "",
    packageDescription: "",
    packagePrice: "",
    supplierCost: "",
    agentNotes: "",
    includedFeatures: emptyFeatures()
  };
}

export default function AgentDashboardPage() {
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [form, setForm] = useState(initialForm);

  const loadClients = () => {
    setLoading(true);
    api
      .get("/agent/clients")
      .then((response) => setClients(response.data?.clients || []))
      .catch((loadError) => setError(loadError.response?.data?.message || "טעינת לקוחות נכשלה"))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadClients();
  }, []);

  const setField = (key, value) => setForm((prev) => ({ ...prev, [key]: value }));

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
          eventDate: form.eventDate,
          eventTime: form.eventTime
        },
        deal: {
          packageDescription: form.packageDescription.trim(),
          packagePrice: form.packagePrice === "" ? null : Number(form.packagePrice),
          supplierCost: form.supplierCost === "" ? null : Number(form.supplierCost),
          agentNotes: form.agentNotes.trim(),
          includedFeatures: form.includedFeatures
        }
      };

      const response = await api.post("/agent/create-client", payload);
      const wa = response.data?.welcomeWhatsApp;
      setSuccess(
        wa?.sent
          ? "הלקוח נוצר ונשלחה הודעת Welcome בוואטסאפ (פרטי גישה יתוזמנו בהמשך)."
          : `הלקוח נוצר. WhatsApp: ${wa?.reason || "לא נשלח"}`
      );
      setForm(initialForm());
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
        <p>פתיחת לקוח חדש וניהול חבילות — בלי ברירות מחדל לפיצ׳רים</p>
      </header>

      <section className="agent-panel">
        <h2 className="agent-panel__title">יצירת לקוח / אירוע</h2>
        <form className="agent-form" onSubmit={onSubmit} noValidate>
          <div className="agent-form__grid">
            <label className="agent-field">
              <span>שם משתמש (לקוח)</span>
              <input
                className="agent-field-input"
                value={form.username}
                onChange={(e) => setField("username", e.target.value)}
                required
              />
            </label>
            <label className="agent-field">
              <span>סיסמה (לקוח)</span>
              <input
                className="agent-field-input"
                value={form.password}
                onChange={(e) => setField("password", e.target.value)}
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
            <label className="agent-field">
              <span>אולם / מקום</span>
              <input
                className="agent-field-input"
                value={form.venueName}
                onChange={(e) => setField("venueName", e.target.value)}
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
          </div>

          <fieldset className="agent-features">
            <legend>פיצ׳רים ללקוח (סמנו ידנית — אין ברירת מחדל)</legend>
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
            <label className="agent-field">
              <span>עלות ספק / מערכת</span>
              <input
                className="agent-field-input"
                type="number"
                min="0"
                step="1"
                value={form.supplierCost}
                onChange={(e) => setField("supplierCost", e.target.value)}
              />
            </label>
            <label className="agent-field">
              <span>קוד קופון (קריאה בלבד — נערך באדמין)</span>
              <input className="agent-field-input" value="" readOnly placeholder="יוגדר ע״י אדמין" />
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
          {success ? <p className="agent-success">{success}</p> : null}

          <button className="agent-btn agent-btn--primary" type="submit" disabled={saving}>
            {saving ? "יוצר…" : "צור משתמש"}
          </button>
        </form>
      </section>

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
                  <dd>{client.packagePrice != null ? `₪${client.packagePrice}` : "—"}</dd>
                </div>
                <div>
                  <dt>פירוט חבילה</dt>
                  <dd>{client.packageDescription || "—"}</dd>
                </div>
                <div>
                  <dt>תשלום לספק</dt>
                  <dd>{client.supplierCost != null ? `₪${client.supplierCost}` : "—"}</dd>
                </div>
                <div>
                  <dt>קוד קופון</dt>
                  <dd>{client.couponCode || "—"}</dd>
                </div>
              </dl>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
