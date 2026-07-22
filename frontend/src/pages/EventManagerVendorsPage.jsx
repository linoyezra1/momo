import { useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Pencil, Phone, Plus, Search, Trash2, X } from "lucide-react";
import api from "../api";
import IconActionButton from "../components/IconActionButton.jsx";
import WhatsAppIcon from "../components/WhatsAppIcon";
import {
  EVENT_VENDOR_STATUS_LABELS,
  VENDOR_CATEGORIES,
  buildTelHref,
  buildWhatsAppHref,
  formatIls
} from "../utils/vendors.js";
import "../us/admin-portal.css";
import "../il/vendors.css";
import "../il/manager-event.css";

const emptyVendorForm = {
  name: "",
  category: "אחר",
  contactName: "",
  phone: "",
  email: "",
  notes: ""
};

export default function EventManagerVendorsPage() {
  const [vendors, setVendors] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [saving, setSaving] = useState(false);

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState("");
  const [form, setForm] = useState(emptyVendorForm);

  const [drawerVendorId, setDrawerVendorId] = useState("");
  const [drawer, setDrawer] = useState(null);
  const [drawerLoading, setDrawerLoading] = useState(false);

  const loadVendors = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const { data } = await api.get("/manager/vendors", {
        params: {
          q: search.trim() || undefined,
          category: category === "all" ? undefined : category
        }
      });
      setVendors(data.vendors || []);
    } catch (loadError) {
      setError(loadError.response?.data?.message || "טעינת מאגר הספקים נכשלה");
    } finally {
      setLoading(false);
    }
  }, [category, search]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadVendors();
    }, 180);
    return () => window.clearTimeout(timer);
  }, [loadVendors]);

  const openCreate = () => {
    setEditingId("");
    setForm(emptyVendorForm);
    setShowForm(true);
  };

  const openEdit = (vendor) => {
    setEditingId(vendor.id);
    setForm({
      name: vendor.name || "",
      category: vendor.category || "אחר",
      contactName: vendor.contactName || "",
      phone: vendor.phone || "",
      email: vendor.email || "",
      notes: vendor.notes || ""
    });
    setShowForm(true);
  };

  const saveVendor = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError("");
    try {
      if (editingId) {
        await api.patch(`/manager/vendors/${editingId}`, form);
      } else {
        await api.post("/manager/vendors", form);
      }
      setShowForm(false);
      await loadVendors();
    } catch (saveError) {
      setError(saveError.response?.data?.message || "שמירת הספק נכשלה");
    } finally {
      setSaving(false);
    }
  };

  const deleteVendor = async (vendor) => {
    if (!window.confirm(`למחוק את הספק "${vendor.name}"? שיוכים לאירועים יימחקו גם כן.`)) return;
    try {
      await api.delete(`/manager/vendors/${vendor.id}`);
      if (drawerVendorId === vendor.id) {
        setDrawerVendorId("");
        setDrawer(null);
      }
      await loadVendors();
    } catch (deleteError) {
      setError(deleteError.response?.data?.message || "מחיקת הספק נכשלה");
    }
  };

  const openDrawer = async (vendorId) => {
    setDrawerVendorId(vendorId);
    setDrawerLoading(true);
    setError("");
    try {
      const { data } = await api.get(`/manager/vendors/${vendorId}`);
      setDrawer(data);
    } catch (drawerError) {
      setError(drawerError.response?.data?.message || "טעינת כרטיס הספק נכשלה");
      setDrawer(null);
    } finally {
      setDrawerLoading(false);
    }
  };

  const categoryPills = useMemo(() => ["all", ...VENDOR_CATEGORIES], []);

  return (
    <div className="us-admin-portal us-admin-shell" dir="rtl" lang="he">
      <div className="us-admin-container">
        <header className="us-admin-header">
          <div>
            <Link className="il-vendor-back" to="/manager">
              ← חזרה לניהול אירועים
            </Link>
            <h1>מאגר ספקים</h1>
            <p>ספריית ספקים גלובלית לכל האירועים שבניהולך</p>
          </div>
          <div className="us-admin-toolbar">
            <button className="us-admin-btn us-admin-btn--primary" type="button" onClick={openCreate}>
              <Plus size={16} aria-hidden="true" />
              ספק חדש
            </button>
          </div>
        </header>

        {error ? <p className="us-admin-message us-admin-message--error">{error}</p> : null}

        <div className="il-vendor-toolbar">
          <label className="il-vendor-search">
            <Search size={15} aria-hidden="true" />
            <input
              type="search"
              placeholder="חיפוש שם, איש קשר או טלפון…"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </label>
          <div className="il-vendor-pills" role="group" aria-label="סינון לפי קטגוריה">
            {categoryPills.map((item) => (
              <button
                key={item}
                type="button"
                className={`il-vendor-pill${category === item ? " is-active" : ""}`}
                onClick={() => setCategory(item)}
              >
                {item === "all" ? "הכל" : item}
              </button>
            ))}
          </div>
        </div>

        <div className="us-admin-card">
          <div className="us-admin-card-body">
            {loading ? <p>טוען ספקים…</p> : null}
            {!loading && !vendors.length ? <p>לא נמצאו ספקים. הוסיפו ספק ראשון למאגר.</p> : null}
            {!loading && vendors.length ? (
              <div className="il-vendor-grid">
                {vendors.map((vendor) => {
                  const tel = buildTelHref(vendor.phone);
                  const wa = buildWhatsAppHref(vendor.phone);
                  return (
                    <article key={vendor.id} className="il-vendor-card">
                      <button type="button" className="il-vendor-card__main" onClick={() => openDrawer(vendor.id)}>
                        <span className="il-vendor-card__category">{vendor.category}</span>
                        <strong>{vendor.name}</strong>
                        <span>{vendor.contactName || "ללא איש קשר"}</span>
                        <span dir="ltr">{vendor.phone || "—"}</span>
                      </button>
                      <div className="il-vendor-card__actions il-guest-actions">
                        {wa ? (
                          <IconActionButton
                            as="a"
                            className="il-icon-action--whatsapp"
                            href={wa}
                            target="_blank"
                            rel="noreferrer"
                            tooltip="וואטסאפ"
                          >
                            <WhatsAppIcon size={16} />
                          </IconActionButton>
                        ) : null}
                        {tel ? (
                          <IconActionButton as="a" className="il-icon-action--phone" href={tel} tooltip="חיוג">
                            <Phone size={14} />
                          </IconActionButton>
                        ) : null}
                        <IconActionButton tooltip="עריכה" onClick={() => openEdit(vendor)}>
                          <Pencil size={14} />
                        </IconActionButton>
                        <IconActionButton
                          className="il-icon-action--danger"
                          tooltip="מחיקה"
                          onClick={() => deleteVendor(vendor)}
                        >
                          <Trash2 size={14} />
                        </IconActionButton>
                      </div>
                    </article>
                  );
                })}
              </div>
            ) : null}
          </div>
        </div>
      </div>

      {showForm ? (
        <div className="us-admin-modal-backdrop" role="presentation">
          <form className="us-admin-modal" onSubmit={saveVendor} dir="rtl">
            <div className="us-admin-modal-header">
              <h2>{editingId ? "עריכת ספק" : "ספק חדש במאגר"}</h2>
              <button type="button" className="us-admin-btn us-admin-btn--xs" onClick={() => setShowForm(false)}>
                <X size={16} />
              </button>
            </div>
            <div className="us-admin-modal-body il-vendor-form-grid">
              <label>
                <span>שם ספק</span>
                <input required value={form.name} onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
              </label>
              <label>
                <span>קטגוריה</span>
                <select value={form.category} onChange={(e) => setForm((p) => ({ ...p, category: e.target.value }))}>
                  {VENDOR_CATEGORIES.map((item) => (
                    <option key={item} value={item}>
                      {item}
                    </option>
                  ))}
                </select>
              </label>
              <label>
                <span>איש קשר</span>
                <input value={form.contactName} onChange={(e) => setForm((p) => ({ ...p, contactName: e.target.value }))} />
              </label>
              <label>
                <span>טלפון</span>
                <input dir="ltr" value={form.phone} onChange={(e) => setForm((p) => ({ ...p, phone: e.target.value }))} />
              </label>
              <label className="il-vendor-form-span">
                <span>אימייל</span>
                <input dir="ltr" type="email" value={form.email} onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
              </label>
              <label className="il-vendor-form-span">
                <span>הערות</span>
                <textarea rows={3} value={form.notes} onChange={(e) => setForm((p) => ({ ...p, notes: e.target.value }))} />
              </label>
            </div>
            <div className="us-admin-form-actions">
              <button className="us-admin-btn us-admin-btn--primary" type="submit" disabled={saving}>
                {saving ? "שומר…" : "שמירה"}
              </button>
              <button className="us-admin-btn" type="button" onClick={() => setShowForm(false)}>
                ביטול
              </button>
            </div>
          </form>
        </div>
      ) : null}

      {drawerVendorId ? (
        <div className="il-vendor-drawer-backdrop" role="presentation" onClick={() => setDrawerVendorId("")}>
          <aside
            className="il-vendor-drawer"
            dir="rtl"
            role="dialog"
            aria-modal="true"
            aria-label="כרטיס ספק"
            onClick={(event) => event.stopPropagation()}
          >
            <header className="il-vendor-drawer__header">
              <div>
                <p className="il-vendor-card__category">{drawer?.vendor?.category || "…"}</p>
                <h2>{drawer?.vendor?.name || "טוען…"}</h2>
              </div>
              <button type="button" className="us-admin-btn us-admin-btn--xs" onClick={() => setDrawerVendorId("")}>
                <X size={16} />
              </button>
            </header>

            {drawerLoading ? <p>טוען פרטים…</p> : null}

            {drawer?.vendor ? (
              <>
                <div className="il-vendor-drawer__profile">
                  <p>
                    <strong>איש קשר:</strong> {drawer.vendor.contactName || "—"}
                  </p>
                  <p>
                    <strong>טלפון:</strong> <span dir="ltr">{drawer.vendor.phone || "—"}</span>
                  </p>
                  <p>
                    <strong>אימייל:</strong> <span dir="ltr">{drawer.vendor.email || "—"}</span>
                  </p>
                  <p>
                    <strong>הערות:</strong> {drawer.vendor.notes || "—"}
                  </p>
                </div>

                <div className="il-vendor-drawer__summary">
                  <div>
                    <span>סה״כ הצעות</span>
                    <strong>{formatIls(drawer.summary?.totalProposed)}</strong>
                  </div>
                  <div>
                    <span>נסגרו</span>
                    <strong>{formatIls(drawer.summary?.totalBooked)}</strong>
                  </div>
                </div>

                <h3>היסטוריית הצעות מחיר</h3>
                {!drawer.history?.length ? <p className="il-vendor-muted">עדיין אין הצעות לאירועים.</p> : null}
                <div className="il-vendor-history">
                  {(drawer.history || []).map((item) => (
                    <article key={item.id} className="il-vendor-history__item">
                      <div>
                        <strong>{item.eventLabel}</strong>
                        <span>{item.username}</span>
                      </div>
                      <div>
                        <span className={`il-vendor-status is-${item.status}`}>
                          {EVENT_VENDOR_STATUS_LABELS[item.status] || item.status}
                        </span>
                        <strong>{formatIls(item.quoteAmount)}</strong>
                      </div>
                      {item.eventNotes ? <p>{item.eventNotes}</p> : null}
                    </article>
                  ))}
                </div>
              </>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
