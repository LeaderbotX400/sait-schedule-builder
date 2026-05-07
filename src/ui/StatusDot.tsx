type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

interface Props {
  tone: Tone;
  className?: string;
}

const COLOR: Record<Tone, string> = {
  neutral: "bg-fg-faint",
  ok: "bg-success",
  warn: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
};

/**
 * Tiny coloured status dot. Lifts the `h-1.5 w-1.5 rounded-full
 * bg-{tone}-400` atom shared by ConnectionStatus, AppHeader's Courses
 * toggle, RegistrationStatusInline, and HeaderInput's connected pill.
 */
export default function StatusDot({ tone, className }: Props) {
  return <span className={`h-1.5 w-1.5 rounded-full shrink-0 ${COLOR[tone]} ${className ?? ""}`} />;
}
