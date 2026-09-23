const HEBREW_BY_CODE = {
  21211: "מספר יעד לא תקין",
  21614: "מספר טלפון לא תקין",
  30008: "שגיאת מסירה לא ידועה אצל הספק",
  63003: "ערוץ וואטסאפ לא נמצא",
  63007: "מספר השולח לא מאומת לוואטסאפ",
  63013: "תוכן ההודעה נדחה",
  63015: "סוג הודעה לא נתמך",
  63016: "נדרשת תבנית מאושרת — חלון השיחה סגור",
  63018: "חריגה ממגבלת שליחה",
  63021: "הנמען חסם את המספר / ביטל הרשמה",
  63024: "משתמש לא קיים",
  63028: "מספר המשתנים לא תואם לתבנית המאושרת",
  63032: "מספר לא פעיל / לא רשום בוואטסאפ",
  63049: "נמען לא זמין / חסם הודעות עסקיות"
};

export function translateWhatsAppError({ errorCode, errorMessage } = {}) {
  const code = String(errorCode || "").trim();
  const english = String(errorMessage || "").trim();
  const hebrew = HEBREW_BY_CODE[code] || (english ? "שגיאת מסירה" : "ההודעה לא נמסרה");
  return {
    errorCode: code,
    errorMessage: english,
    errorMessageHe: hebrew
  };
}
