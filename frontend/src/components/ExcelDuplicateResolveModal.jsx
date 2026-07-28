import { Database, Sparkles } from "lucide-react";
import { buildExcelDuplicateConflicts } from "../utils/duplicateModalData.js";
import { ListDuplicateModal } from "./duplicates/DuplicateModal.jsx";

export default function ExcelDuplicateResolveModal({
  conflicts = [],
  choices = {},
  onChoiceChange,
  onConfirm,
  onCancel,
  submitting = false,
  pendingNewCount = 0,
  sourceLabel
}) {
  if (!conflicts.length) return null;

  const items = buildExcelDuplicateConflicts(conflicts, sourceLabel);

  return (
    <ListDuplicateModal
      open
      busy={submitting}
      conflicts={items}
      choices={choices}
      onChoiceChange={onChoiceChange}
      keepValue="keep_existing"
      replaceValue="use_excel"
      keepIcon={<Database size={14} aria-hidden="true" />}
      replaceIcon={<Sparkles size={14} aria-hidden="true" />}
      labels={{
        title: "נמצאו מוזמנים עם מספר טלפון קיים",
        description: `זוהו ${conflicts.length} רשומות חופפות. בחרו לכל רשומה האם להשאיר את הקיים או לעדכן לפי האקסל. לאחר מכן לחצו "אשר והמשך שמירה".`,
        extraNote:
          pendingNewCount > 0
            ? `בנוסף, ${pendingNewCount} מוזמנים חדשים יתווספו אוטומטית עם האישור.`
            : undefined,
        keepTag: "השאר את הקיים",
        replaceTag: "עדכן לפי האקסל",
        confirm: "אשר והמשך שמירה",
        confirmBusy: "שומר…",
        cancel: "ביטול"
      }}
      onCancel={onCancel}
      onConfirm={onConfirm}
    />
  );
}
