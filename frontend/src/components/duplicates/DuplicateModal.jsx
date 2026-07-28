import { useEffect } from "react";
import { AlertTriangle, Check, Database, Sparkles, User, X } from "lucide-react";
import "../../il/duplicate-modals.css";

function ModalShell({ labels, onCancel, busy, wide, children, footer }) {
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  return (
    <div className="il-dup-modal-backdrop" role="presentation" dir="rtl" lang="he">
      <div
        className={`il-dup-modal${wide ? " il-dup-modal--wide" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-label={labels.title}
      >
        <div className="il-dup-modal__head">
          <span className="il-dup-modal__icon" aria-hidden="true">
            <AlertTriangle size={20} />
          </span>
          <div className="il-dup-modal__head-text">
            <h3 className="il-dup-modal__title">{labels.title}</h3>
            {labels.description ? <p className="il-dup-modal__desc">{labels.description}</p> : null}
          </div>
          <button
            type="button"
            className="il-dup-modal__close"
            onClick={onCancel}
            disabled={busy}
            aria-label={labels.cancel}
          >
            <X size={20} aria-hidden="true" />
          </button>
        </div>

        {children}

        <div className="il-dup-modal__footer">{footer}</div>
      </div>
    </div>
  );
}

function PartyPanel({ tag, tagIcon, party, incoming = false }) {
  return (
    <div className={`il-dup-panel${incoming ? " il-dup-panel--incoming" : ""}`}>
      <span className={`il-dup-panel__tag${incoming ? " il-dup-panel__tag--accent" : ""}`}>
        {tagIcon}
        {tag}
      </span>
      <p className="il-dup-panel__name">
        <User size={16} aria-hidden="true" />
        {party.name}
      </p>
      {party.lines.map((line, index) => (
        <p key={index} className="il-dup-panel__line">
          {line}
        </p>
      ))}
    </div>
  );
}

function ChoiceOption({ selected, onSelect, tag, icon, party, tone, disabled }) {
  return (
    <button
      type="button"
      className={`il-dup-choice is-${tone}${selected ? " is-selected" : ""}`}
      onClick={onSelect}
      disabled={disabled}
      aria-pressed={selected}
    >
      <div className="il-dup-choice__top">
        <span className="il-dup-choice__tag">
          {icon}
          {tag}
        </span>
        {selected ? (
          <span className="il-dup-choice__check" aria-hidden="true">
            <Check size={12} />
          </span>
        ) : null}
      </div>
      <p className="il-dup-panel__name">
        <User size={16} aria-hidden="true" />
        {party.name}
      </p>
      {party.lines.map((line, index) => (
        <p key={index} className="il-dup-panel__line">
          {line}
        </p>
      ))}
    </button>
  );
}

export function SingleDuplicateModal({
  open,
  busy = false,
  labels,
  conflict,
  onCancel,
  onConfirm
}) {
  if (!open || !conflict) return null;

  return (
    <ModalShell
      labels={labels}
      onCancel={onCancel}
      busy={busy}
      footer={
        <>
          <button type="button" className="il-dup-btn il-dup-btn--outline" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </button>
          <button type="button" className="il-dup-btn il-dup-btn--primary" onClick={onConfirm} disabled={busy}>
            <Check size={16} aria-hidden="true" />
            {busy ? labels.confirmBusy : labels.confirm}
          </button>
        </>
      }
    >
      <div className="il-dup-modal__body il-dup-modal__body-spaced">
        <div className="il-dup-modal__phone">{conflict.phone}</div>
        <div className="il-dup-modal__compare">
          <PartyPanel
            tag={labels.keepTag}
            tagIcon={<Database size={14} aria-hidden="true" />}
            party={conflict.existing}
          />
          <PartyPanel
            tag={labels.replaceTag}
            tagIcon={<Sparkles size={14} aria-hidden="true" />}
            party={conflict.incoming}
            incoming
          />
        </div>
      </div>
    </ModalShell>
  );
}

export function ListDuplicateModal({
  open,
  busy = false,
  labels,
  conflicts = [],
  choices = {},
  onChoiceChange,
  keepValue,
  replaceValue,
  keepIcon,
  replaceIcon,
  onCancel,
  onConfirm
}) {
  if (!open || !conflicts.length) return null;

  return (
    <ModalShell
      labels={labels}
      onCancel={onCancel}
      busy={busy}
      wide
      footer={
        <>
          <button type="button" className="il-dup-btn il-dup-btn--outline" onClick={onCancel} disabled={busy}>
            {labels.cancel}
          </button>
          <button type="button" className="il-dup-btn il-dup-btn--primary" onClick={onConfirm} disabled={busy}>
            <Check size={16} aria-hidden="true" />
            {busy ? labels.confirmBusy : labels.confirm}
          </button>
        </>
      }
    >
      <div className="il-dup-modal__body il-dup-modal__body--scroll">
        {labels.extraNote ? <p className="il-dup-note">{labels.extraNote}</p> : null}
        {conflicts.map((conflict) => {
          const choice = choices[conflict.id] ?? keepValue;
          return (
            <div key={conflict.id} className="il-dup-conflict">
              <div className="il-dup-conflict__meta">
                <span className="il-dup-modal__phone">{conflict.phone}</span>
                {conflict.rowLabel ? <span className="il-dup-conflict__row">{conflict.rowLabel}</span> : null}
              </div>
              <div className="il-dup-conflict__choices">
                <ChoiceOption
                  selected={choice === keepValue}
                  onSelect={() => onChoiceChange(conflict.id, keepValue)}
                  tag={labels.keepTag}
                  icon={keepIcon}
                  party={conflict.existing}
                  tone="keep"
                  disabled={busy}
                />
                <ChoiceOption
                  selected={choice === replaceValue}
                  onSelect={() => onChoiceChange(conflict.id, replaceValue)}
                  tag={labels.replaceTag}
                  icon={replaceIcon}
                  party={conflict.incoming}
                  tone="replace"
                  disabled={busy}
                />
              </div>
            </div>
          );
        })}
      </div>
    </ModalShell>
  );
}
