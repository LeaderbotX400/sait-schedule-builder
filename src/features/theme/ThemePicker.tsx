import { THEMES } from "../../theme/themes";
import type { ThemeChoice } from "../../theme/useTheme";
import { useTheme } from "../../theme/useTheme";
import Popover from "../../ui/Popover";

export default function ThemePicker() {
  const choice = useTheme((s) => s.choice);
  const setTheme = useTheme((s) => s.setTheme);

  const options: { key: ThemeChoice; label: string; swatches?: [string, string, string] }[] = [
    { key: "auto", label: "Auto (system)" },
    ...THEMES.map((t) => ({ key: t.id as ThemeChoice, label: t.label, swatches: t.swatches })),
  ];

  return (
    <Popover
      align="right"
      widthClass="w-52"
      trigger={({ onClick, "aria-expanded": expanded }) => (
        <button
          type="button"
          onClick={onClick}
          aria-expanded={expanded}
          className="px-2 py-1 text-xs rounded-md border border-edge text-fg-muted hover:text-fg hover:border-edge-hover transition-colors"
          title="Change theme"
        >
          <span className="text-sm leading-none" aria-hidden>
            &#9680;
          </span>
        </button>
      )}
    >
      {(close) => (
        <div className="space-y-1">
          <p className="text-[10px] font-semibold uppercase tracking-widest text-fg-faint mb-2">
            Theme
          </p>
          {options.map((o) => (
            <button
              key={o.key}
              type="button"
              onClick={() => {
                setTheme(o.key);
                close();
              }}
              className={`w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors ${
                choice === o.key
                  ? "bg-tint-primary text-tint-primary-fg"
                  : "text-fg-muted hover:bg-surface-hover hover:text-fg"
              }`}
            >
              {o.swatches ? (
                <span className="flex gap-0.5 shrink-0">
                  {o.swatches.map((color, i) => (
                    <span
                      key={`${o.key}-${i}`}
                      className="h-4 w-4 rounded-sm border border-edge/50"
                      style={{ backgroundColor: color }}
                    />
                  ))}
                </span>
              ) : (
                <span className="flex items-center justify-center h-4 w-[3.25rem] shrink-0 text-[10px] text-fg-faint">
                  &#9788;/&#9790;
                </span>
              )}
              <span>{o.label}</span>
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}
