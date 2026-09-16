/**
 * Icon action control with accessible floating tooltip.
 * Works as button or anchor via `as`.
 */
export default function IconActionButton({
  as = "button",
  tooltip,
  className = "",
  children,
  type,
  "aria-label": ariaLabel,
  ...rest
}) {
  const Comp = as;
  const classes = ["il-icon-action", className].filter(Boolean).join(" ");
  const buttonType = Comp === "button" ? type || "button" : undefined;
  const accessibleName = ariaLabel || tooltip;

  return (
    <Comp
      className={classes}
      type={buttonType}
      aria-label={accessibleName}
      data-tooltip={tooltip || undefined}
      {...rest}
    >
      {children}
      {tooltip ? (
        <span className="il-icon-action__tooltip" aria-hidden="true">
          {tooltip}
        </span>
      ) : null}
    </Comp>
  );
}
