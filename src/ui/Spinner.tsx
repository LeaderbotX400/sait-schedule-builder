interface Props {
  /** Visual size + matching border weight. */
  size?: "xs" | "sm" | "md" | "lg";
  /** Tailwind text-color class for the visible arc, e.g. "text-blue-400". */
  color?: string;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  xs: "h-3 w-3 border-2",
  sm: "h-3.5 w-3.5 border-2",
  md: "h-4 w-4 border-2",
  lg: "h-8 w-8 border-4",
};

/**
 * Inline spinning ring. Replaces the inline `h-X w-X animate-spin
 * rounded-full border-X border-{color} border-r-transparent` pattern
 * scattered across HeaderInput, ConnectionStatus, MainArea, and
 * RegistrationButton.
 *
 * Pass `color` as a Tailwind text-* class (e.g. "text-blue-400"); the
 * arc inherits via `currentColor` while the trailing edge stays
 * transparent.
 */
export default function Spinner({ size = "md", color = "text-current" }: Props) {
  return (
    <span
      className={`inline-block animate-spin rounded-full border-current border-r-transparent ${SIZE[size]} ${color}`}
      role="status"
      aria-label="Loading"
    />
  );
}
