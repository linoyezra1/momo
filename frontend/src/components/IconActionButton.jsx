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
  ...rest
}) {
  const Comp = as;
  const classes = ["il-icon-action", className].filter(Boolean).join(" ");
  const buttonType = Comp === "button" ? type || "button" : undefined;

  return (
    <Comp
      className={classes}
      type={buttonType}
      aria-label={tooltip}
      data-tooltip={tooltip}
      title={tooltip}
      {...rest}
    >
      {children}
      <span className="il-icon-action__tooltip" role="tooltip">
        {tooltip}
      </span>
    </Comp>
  );
}
