import { buildGuestDuplicateMessage } from "../utils/guestDuplicate.js";
import { buildManualDuplicateConflict } from "../utils/duplicateModalData.js";
import { SingleDuplicateModal } from "./duplicates/DuplicateModal.jsx";

export default function GuestDuplicateReplaceModal({
  phone,
  existing,
  incoming,
  onConfirm,
  onCancel,
  submitting = false,
  title = "המוזמן כבר קיים במערכת"
}) {
  if (!existing || !incoming || !phone) return null;

  const conflict = buildManualDuplicateConflict({ phone, existing, incoming });

  return (
    <SingleDuplicateModal
      open
      busy={submitting}
      conflict={conflict}
      labels={{
        title,
        description: buildGuestDuplicateMessage({ existing, incoming }),
        keepTag: "קיים במערכת",
        replaceTag: "חדש",
        confirm: "אישור החלפה",
        confirmBusy: "שומר…",
        cancel: "ביטול"
      }}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
