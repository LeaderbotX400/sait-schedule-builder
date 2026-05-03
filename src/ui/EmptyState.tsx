import type { ReactNode } from "react";

type Tone = "neutral" | "warn" | "danger";

interface Props {
  /** Big icon character / emoji shown inside the colored circle. */
  icon?: ReactNode;
  /** Bold heading line. */
  title: string;
  /** Optional supporting description below the title. */
  description?: ReactNode;
  /** Optional action node (button, etc.) below the description. */
  action?: ReactNode;
  tone?: Tone;
}

const ICON_BG: Record<Tone, string> = {
  neutral: "bg-gray-900/40 border border-gray-800 text-gray-400",
  warn: "bg-yellow-900/30 border border-yellow-800 text-yellow-300",
  danger: "bg-red-900/30 border border-red-800 text-red-300",
};

const DESC_COLOR: Record<Tone, string> = {
  neutral: "text-gray-400",
  warn: "text-gray-400",
  danger: "text-red-400",
};

/**
 * Centered empty / error state with optional icon + heading + description
 * + action. Lifts the repeated `flex items-center justify-center py-X
 * + max-w-md text-center space-y-2 + inline-flex h-10 w-10 rounded-full
 * border bg-...` pattern out of MainArea.
 */
export default function EmptyState({ icon, title, description, action, tone = "neutral" }: Props) {
  return (
    <div className="flex items-center justify-center py-8">
      <div className="max-w-md text-center space-y-2">
        {icon && (
          <div
            className={`inline-flex items-center justify-center h-10 w-10 rounded-full ${ICON_BG[tone]}`}
          >
            <span className="text-lg">{icon}</span>
          </div>
        )}
        <h2 className="text-base font-semibold text-white">{title}</h2>
        {description && <p className={`text-sm ${DESC_COLOR[tone]}`}>{description}</p>}
        {action && <div className="pt-1">{action}</div>}
      </div>
    </div>
  );
}
