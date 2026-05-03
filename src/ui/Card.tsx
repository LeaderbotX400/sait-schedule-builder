import type { HTMLAttributes, ReactNode } from "react";

interface Props extends HTMLAttributes<HTMLDivElement> {
  /** Override default padding (e.g. for the cart card that wraps a calendar). */
  padding?: string;
  /** Stretches/centers the card; useful for the SignInScreen card. */
  size?: "sm" | "md" | "full";
  children: ReactNode;
}

const SIZE: Record<NonNullable<Props["size"]>, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  full: "w-full",
};

/**
 * Standard rounded-xl card with the bg-gray-900/60 + border-gray-800
 * styling shared by SignInScreen, ScheduleStrip, and BlockoutGrid.
 */
export default function Card({
  padding = "p-4 sm:p-6",
  size = "full",
  className,
  children,
  ...rest
}: Props) {
  return (
    <div
      className={`rounded-xl border border-gray-800/80 bg-gray-900/60 shadow-lg ${SIZE[size]} ${padding} ${className ?? ""}`}
      {...rest}
    >
      {children}
    </div>
  );
}
