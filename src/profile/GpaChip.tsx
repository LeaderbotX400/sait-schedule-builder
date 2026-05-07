import { useProfileState } from "./state";

const CHIP = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs";

export default function GpaChip() {
  const gpa = useProfileState((s) => s.gpa);
  const busy = useProfileState((s) => s.busy);
  const error = useProfileState((s) => s.error);

  if (busy && !gpa) {
    return (
      <span className={`${CHIP} bg-input/60 text-fg-faint`}>
        <span className="text-[10px] uppercase tracking-wide">GPA</span>
        <span>…</span>
      </span>
    );
  }

  const value = gpa?.overallGpa;
  if (value == null) {
    if (error) {
      return (
        <span className={`${CHIP} bg-input`} title={error}>
          <span className="text-[10px] uppercase tracking-wide text-fg-faint">GPA</span>
          <span className="font-semibold text-caution">⚠</span>
        </span>
      );
    }
    return null;
  }

  const formatted = typeof value === "number" ? value.toFixed(2) : String(value);

  return (
    <span className={`${CHIP} bg-input text-fg-muted`} title="Cumulative GPA">
      <span className="text-[10px] uppercase tracking-wide text-fg-faint">GPA</span>
      <span className="font-semibold text-fg">{formatted}</span>
    </span>
  );
}
