import { create } from "zustand";
import { persist } from "zustand/middleware";

export type ThemeId = "dark" | "light" | "plum-dark" | "plum-light" | "mono-dark" | "mono-light";

/** What the user picks — either a concrete theme or "auto" (follow OS). */
export type ThemeChoice = ThemeId | "auto";

export type ThemeMode = "light" | "dark";

/** The pair auto resolves to based on prefers-color-scheme. */
const AUTO_LIGHT: ThemeId = "light";
const AUTO_DARK: ThemeId = "dark";

function getOsMode(): ThemeMode {
  return window.matchMedia("(prefers-color-scheme: light)").matches ? "light" : "dark";
}

function resolveTheme(choice: ThemeChoice): ThemeId {
  if (choice !== "auto") return choice;
  return getOsMode() === "light" ? AUTO_LIGHT : AUTO_DARK;
}

interface ThemeStore {
  /** What the user chose (persisted). */
  choice: ThemeChoice;
  /** The concrete theme currently applied to the DOM. */
  resolved: ThemeId;
  setTheme: (choice: ThemeChoice) => void;
}

function applyTheme(id: ThemeId) {
  document.documentElement.setAttribute("data-theme", id);
}

export const useTheme = create<ThemeStore>()(
  persist(
    (set) => ({
      choice: "auto",
      resolved: resolveTheme("auto"),
      setTheme: (choice) => {
        const resolved = resolveTheme(choice);
        applyTheme(resolved);
        set({ choice, resolved });
      },
    }),
    {
      name: "sait-sb-theme",
      partialize: ({ choice }) => ({ choice }),
      merge: (persisted, current) => {
        const p = persisted as { choice?: ThemeChoice } | undefined;
        const choice = p?.choice ?? current.choice;
        // Migrate: old store had `theme` instead of `choice`
        const legacy = persisted as { theme?: ThemeId } | undefined;
        const final = legacy?.theme && !p?.choice ? legacy.theme : choice;
        const resolved = resolveTheme(final);
        return { ...current, choice: final, resolved };
      },
    },
  ),
);

// Apply persisted theme on module load (before first render).
applyTheme(useTheme.getState().resolved);

// Listen for OS color-scheme changes — update if the user is on "auto".
window.matchMedia("(prefers-color-scheme: light)").addEventListener("change", () => {
  const { choice, setTheme } = useTheme.getState();
  if (choice === "auto") setTheme("auto");
});

export function getThemeMode(id: ThemeId): ThemeMode {
  return id === "light" || id.endsWith("-light") ? "light" : "dark";
}
