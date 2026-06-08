export default function IlScheduleIcon({ name }) {
  if (name === "toast") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <path d="M14 30h20v4H14zM18 10c0-3 2-6 6-6s6 3 6 6v8H18V10z" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 18h24v10c0 4-3 7-7 7H19c-4 0-7-3-7-7V18z" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "rings") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="18" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="30" cy="24" r="8" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "camera") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <rect x="8" y="14" width="32" height="22" rx="3" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <circle cx="24" cy="25" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M18 14l2-4h8l2 4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  if (name === "dinner") {
    return (
      <svg viewBox="0 0 48 48" aria-hidden="true">
        <circle cx="24" cy="26" r="10" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M12 12v14M16 12v14M14 12v14" fill="none" stroke="currentColor" strokeWidth="1.6" />
        <path d="M34 12v20" fill="none" stroke="currentColor" strokeWidth="1.6" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="18" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <circle cx="30" cy="16" r="4" fill="none" stroke="currentColor" strokeWidth="1.6" />
      <path d="M14 34c2-6 6-9 10-9s8 3 10 9" fill="none" stroke="currentColor" strokeWidth="1.6" />
    </svg>
  );
}
