export default function IlEditorField({ label, htmlFor, children, className = "" }) {
  return (
    <label className={`il-editor-field ${className}`.trim()} htmlFor={htmlFor}>
      <span className="il-editor-label">{label}</span>
      {children}
    </label>
  );
}

export const ilEditorInputClass = "il-editor-input";
export const ilEditorSelectClass = "il-editor-select";
