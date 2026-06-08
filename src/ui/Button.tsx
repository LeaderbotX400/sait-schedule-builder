import type { ButtonHTMLAttributes } from "react";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";

interface Props extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
}

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg font-semibold hover:bg-primary-hover",
  outline: "border border-edge bg-surface text-fg hover:bg-surface-hover hover:border-edge-hover",
  ghost: "text-fg-faint hover:text-fg-muted",
  danger: "bg-destructive text-destructive-fg font-semibold hover:bg-destructive-hover",
};

const SIZE: Record<Size, string> = {
  xs: "px-2 py-0.5 text-xs",
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1 text-xs",
};

const BASE = "rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

/**
 * Standard button with shared focus/disabled/transition styling.
 *
 * Variants:
 *   - `primary`  — blue background, white text (main CTAs like
 *     Generate, Sign in)
 *   - `outline`  — transparent + grey border (refresh, clear, export
 *     header actions)
 *   - `ghost`    — text-only (dismiss links)
 *   - `danger`   — red background (destructive actions)
 *
 * Sizes match the patterns scattered across the codebase. Pass extra
 * className to layer on layout (flex / gap / etc.) without rewriting
 * the variant defaults.
 */
export default function Button({
  variant = "outline",
  size = "sm",
  className,
  type = "button",
  ...rest
}: Props) {
  const classes = `${BASE} ${VARIANT[variant]} ${SIZE[size]} ${className ?? ""}`.trim();
  return <button type={type} className={classes} {...rest} />;
}
