import { useProfileState } from "./state";

export default function GpaChip() {
  const gpa = useProfileState((s) => s.gpa);
  const busy = useProfileState((s) => s.busy);

  if (busy && !gpa) {
    return <span className="text-xs text-gray-500">GPA…</span>;
  }
  const value = gpa?.overallGpa;
  if (value == null) return null;

  const formatted =
    typeof value === "number" ? value.toFixed(2) : String(value);

  return (
    <span
      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-gray-800 text-xs text-gray-300"
      title="Cumulative GPA"
    >
      <span className="text-[10px] uppercase tracking-wide text-gray-500">GPA</span>
      <span className="font-semibold text-gray-100">{formatted}</span>
    </span>
  );
}
