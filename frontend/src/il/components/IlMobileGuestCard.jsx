import { ChevronDown, ChevronUp, Gift, Pencil, Phone, Send, Trash2, Users } from "lucide-react";
import WhatsAppIcon from "../../components/WhatsAppIcon.jsx";

function statusClass(status) {
  if (status === "מגיע" || status === "הגיע לאירוע") return "il-guest-card__status--coming";
  if (status === "אולי") return "il-guest-card__status--maybe";
  if (status === "לא מגיע") return "il-guest-card__status--declined";
  return "il-guest-card__status--unknown";
}

function reminderLabel(round) {
  const value = Number(round) || 0;
  if (value <= 0) return "טרם נשלח";
  return `סבב ${value} נשלח`;
}

export default function IlMobileGuestCard({
  guest,
  selected,
  onToggleSelect,
  expanded,
  onToggleExpand,
  whatsappHref,
  telHref,
  sourceText,
  onEdit,
  onDelete,
  isEditing,
  editFields,
  editActions,
  editError,
  detailPanels
}) {
  const round = Number(guest?.reminderRound) || 0;

  return (
    <article className={`il-guest-card${expanded ? " is-expanded" : ""}`}>
      <div className="il-guest-card__row">
        <div className="il-guest-card__start">
          <label className="il-guest-card__check" onClick={(event) => event.stopPropagation()}>
            <input
              type="checkbox"
              aria-label={`בחירת ${guest.fullName}`}
              checked={selected}
              onChange={onToggleSelect}
            />
          </label>

          <button
            type="button"
            className="il-guest-card__main"
            onClick={onToggleExpand}
            aria-expanded={expanded}
          >
            <strong className="il-guest-card__name">{guest.fullName}</strong>
            <span className="il-guest-card__tags">
              {!String(guest.phone || "").trim() ? (
                <span className="il-missing-phone-badge">חסר מספר טלפון</span>
              ) : null}
              <span className="il-guest-card__attendees" title="כמות מגיעים">
                <Users size={13} aria-hidden="true" />
                {guest.attendeesCount ?? 0}
              </span>
              <span className={`il-guest-card__status ${statusClass(guest.status)}`}>{guest.status}</span>
            </span>
          </button>
        </div>

        <button
          type="button"
          className="il-guest-card__chevron"
          onClick={onToggleExpand}
          aria-expanded={expanded}
          aria-label={expanded ? "סגירת פרטים" : "פתיחת פרטים"}
        >
          {expanded ? <ChevronUp size={20} aria-hidden="true" /> : <ChevronDown size={20} aria-hidden="true" />}
        </button>
      </div>

      {expanded ? (
        <div className="il-guest-card__body">
          {isEditing ? (
            <div className="il-guest-card__edit">
              {editFields}
              {editActions}
            </div>
          ) : (
            <>
              <div className="il-guest-card__meta-grid">
                <div className="il-guest-card__meta-item">
                  <span>טלפון</span>
                  <strong dir="ltr">{guest.phone || "—"}</strong>
                </div>
                <div className="il-guest-card__meta-item">
                  <span>סכום מתנה</span>
                  <strong className="il-guest-card__gift">
                    {guest.giftAmount ? guest.giftAmount : "—"}
                    <Gift size={14} aria-hidden="true" />
                  </strong>
                </div>
                <div className="il-guest-card__meta-item">
                  <span>סבב שליחה</span>
                  <strong className="il-guest-card__round">
                    <Send size={12} aria-hidden="true" />
                    {reminderLabel(round)}
                  </strong>
                </div>
                <div className="il-guest-card__meta-item">
                  <span>מקור</span>
                  <strong>{sourceText}</strong>
                </div>
              </div>

              {detailPanels ? <div className="il-guest-card__history">{detailPanels}</div> : null}

              <div className="il-guest-card__actions">
                <div className="il-guest-card__actions-group">
                  <button
                    type="button"
                    className="il-guest-card__action il-guest-card__action--danger"
                    onClick={onDelete}
                    aria-label={`מחיקת ${guest.fullName}`}
                    title="מחיקה"
                  >
                    <Trash2 size={17} aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="il-guest-card__action"
                    onClick={onEdit}
                    aria-label={`עריכת ${guest.fullName}`}
                    title="עריכה"
                  >
                    <Pencil size={17} aria-hidden="true" />
                  </button>
                </div>
                <div className="il-guest-card__actions-group">
                  {telHref ? (
                    <a
                      className="il-guest-card__action"
                      href={telHref}
                      aria-label={`חיוג ל${guest.fullName}`}
                      title="חיוג"
                    >
                      <Phone size={17} aria-hidden="true" />
                    </a>
                  ) : (
                    <button type="button" className="il-guest-card__action is-disabled" disabled title="אין מספר טלפון">
                      <Phone size={17} aria-hidden="true" />
                    </button>
                  )}
                  <a
                    className="il-guest-card__action il-guest-card__action--whatsapp"
                    href={whatsappHref}
                    target="_blank"
                    rel="noreferrer"
                    aria-label={`וואטסאפ ל${guest.fullName}`}
                    title="וואטסאפ"
                  >
                    <WhatsAppIcon size={18} />
                  </a>
                </div>
              </div>
            </>
          )}
          {editError ? <p className="il-inline-edit-error">{editError}</p> : null}
        </div>
      ) : null}
    </article>
  );
}
