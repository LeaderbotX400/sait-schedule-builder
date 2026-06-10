/**
 * Pinia store for theme selection. Persisted via the shared persistence
 * plugin (`sait-sb-v2:theme`); tracks the OS color-scheme preference so
 * `resolved` stays reactive when `choice === "auto"`.
 */

import { acceptHMRUpdate, defineStore } from "pinia";
import { computed, ref } from "vue";

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

const KNOWN_THEMES: readonly ThemeId[] = [
  "dark",
  "light",
  "plum-dark",
  "plum-light",
  "mono-dark",
  "mono-light",
];

function isThemeChoice(v: unknown): v is ThemeChoice {
  return v === "auto" || (KNOWN_THEMES as readonly string[]).includes(v as string);
}

const AUTO_LIGHT: ThemeId = "light";
const AUTO_DARK: ThemeId = "dark";

export const useThemeStore = defineStore(
  "theme",
  () => {
    const choice = ref<ThemeChoice>("auto");

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
    }

    /** Called by the `useTheme` composable's matchMedia listener. */
    function setSystemPrefersDark(dark: boolean): void {
      systemPrefersDark.value = dark;
    }

    return { choice, resolved, setTheme, setSystemPrefersDark };
  },
  {
    persist: {
      key: "theme",
      version: 1,
      pick: (store) => store.choice,
      apply: (store, data) => {
        if (isThemeChoice(data)) store.setTheme(data);
      },
    },
  },
);

export function getThemeMode(id: ThemeId): ThemeMode {
  return id === "light" || id.endsWith("-light") ? "light" : "dark";
}

if (import.meta.hot) {
  import.meta.hot.accept(acceptHMRUpdate(useThemeStore, import.meta.hot));
}
