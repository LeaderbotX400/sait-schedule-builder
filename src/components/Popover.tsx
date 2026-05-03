import { type ReactNode, useEffect, useRef, useState } from "react";

interface Props {
  /** Element rendered as the trigger; receives `onClick` + `aria-expanded`. */
  trigger: (props: { onClick: () => void; "aria-expanded": boolean }) => ReactNode;
  align?: "left" | "right";
  /** Tailwind width class (e.g. `w-60`, `w-80`). */
  widthClass?: string;
  children: ReactNode | ((close: () => void) => ReactNode);
}

/**
 * Small click-outside-to-dismiss popover. Click the trigger to toggle.
 * Children may be a render-prop receiving a `close()` for nested actions.
 */
export default function Popover({
  trigger,
  align = "right",
  widthClass = "w-60",
  children,
}: Props) {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const close = () => setOpen(false);

  return (
    <div className="relative" ref={containerRef}>
      {trigger({ onClick: () => setOpen((v) => !v), "aria-expanded": open })}
      {open && (
        <div
          className={`absolute mt-1.5 ${widthClass} max-w-[calc(100vw-1rem)] rounded-lg border border-gray-700 bg-gray-900 shadow-xl p-3 z-30 ${
            align === "right" ? "right-0" : "left-0"
          }`}
          role="dialog"
        >
          {typeof children === "function" ? children(close) : children}
        </div>
      )}
    </div>
  );
}
