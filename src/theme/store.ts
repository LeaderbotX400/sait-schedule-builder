/**
 * Pinia store for theme selection. Persists the user's choice to
 * localStorage under `sait-sb-theme` and tracks the OS color-scheme
 * preference so `resolved` stays reactive when `choice === "auto"`.
 */

import { computed, ref } from "vue";
import { defineStore } from "pinia";

export type ThemeId =
  | "dark"
  | "light"
  | "plum-dark"
  | "plum-light"
  | "mono-dark"
  | "mono-light";

/** What the user picks — either a concrete theme or "auto" (follow OS). */
export type ThemeChoice = ThemeId | "auto";

export type ThemeMode = "light" | "dark";

const STORAGE_KEY = "sait-sb-theme";

const AUTO_LIGHT: ThemeId = "light";
const AUTO_DARK: ThemeId = "dark";

function readPersistedChoice(): ThemeChoice {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === "auto" || raw === null) return "auto";
    // Validate it's a known ThemeId
    const known: ThemeId[] = [
      "dark",
      "light",
      "plum-dark",
      "plum-light",
      "mono-dark",
      "mono-light",
    ];
    return (known as string[]).includes(raw) ? (raw as ThemeId) : "auto";
  } catch {
    return "auto";
  }
}

export const useThemeStore = defineStore("theme", () => {
  // Hydrate from localStorage once at store init.
  const initialChoice = readPersistedChoice();

  const choice = ref<ThemeChoice>(initialChoice);

  // Tracks OS preference so `resolved` reacts to system changes.
  const systemPrefersDark = ref(
    typeof window !== "undefined"
      ? window.matchMedia("(prefers-color-scheme: dark)").matches
      : false,
  );

  const resolved = computed<ThemeId>(() => {
    if (choice.value !== "auto") return choice.value;
    return systemPrefersDark.value ? AUTO_DARK : AUTO_LIGHT;
  });

  function setTheme(next: ThemeChoice): void {
    choice.value = next;
    try {
      localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Storage may be unavailable in private browsing.
    }
  }

  /** Called by the `useTheme` composable's matchMedia listener. */
  function setSystemPrefersDark(dark: boolean): void {
    systemPrefersDark.value = dark;
  }

  return { choice, resolved, setTheme, setSystemPrefersDark };
});

export function getThemeMode(id: ThemeId): ThemeMode {
  return id === "light" || id.endsWith("-light") ? "light" : "dark";
}
