import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "../../lib/utils.js";

export default function BottomSheet({
  open,
  onClose,
  title,
  children,
  className = "",
  labelledBy = "bottom-sheet-title"
}) {
  useEffect(() => {
    if (!open) return undefined;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    function onKeyDown(event) {
      if (event.key === "Escape") onClose?.();
    }
    window.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow || "";
      window.removeEventListener("keydown", onKeyDown);
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="momo-bottom-sheet" role="presentation" onClick={onClose}>
      <div
        className={cn("momo-bottom-sheet__panel", className)}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? labelledBy : undefined}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="momo-bottom-sheet__handle" aria-hidden="true" />
        {title ? (
          <header className="momo-bottom-sheet__header">
            <h2 id={labelledBy}>{title}</h2>
            <button type="button" className="momo-bottom-sheet__close" onClick={onClose} aria-label="סגירה">
              <X size={18} aria-hidden="true" />
            </button>
          </header>
        ) : null}
        <div className="momo-bottom-sheet__body">{children}</div>
      </div>
    </div>
  );
}
