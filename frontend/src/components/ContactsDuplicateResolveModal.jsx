import { Contact, Database } from "lucide-react";
import { buildContactsDuplicateConflicts } from "../utils/duplicateModalData.js";
import { ListDuplicateModal } from "./duplicates/DuplicateModal.jsx";

export default function ContactsDuplicateResolveModal({
  conflicts = [],
  choices = {},
  onChoiceChange,
  onConfirm,
  onCancel,
  submitting = false
}) {
  if (!conflicts.length) return null;

  const items = buildContactsDuplicateConflicts(conflicts);

  return (
    <ListDuplicateModal
      open
      busy={submitting}
      conflicts={items}
      choices={choices}
      onChoiceChange={onChoiceChange}
      keepValue="skip"
      replaceValue="replace"
      keepIcon={<Database size={14} aria-hidden="true" />}
      replaceIcon={<Contact size={14} aria-hidden="true" />}
      labels={{
        title: "המוזמן כבר קיים במערכת",
        description: `נמצאו ${conflicts.length} אנשי קשר עם מספר טלפון שכבר קיים במערכת. בחרו לכל אחד האם להחליף או לדלג.`,
        keepTag: "דלג — השאר את הקיים",
        replaceTag: "אישור החלפה",
        confirm: "המשך ייבוא",
        confirmBusy: "מייבא…",
        cancel: "ביטול"
      }}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
