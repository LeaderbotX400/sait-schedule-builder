/**
 * Composable that keeps `document.documentElement[data-theme]` in sync
 * with the resolved theme. Mount this once at the app root; it also
 * wires the OS color-scheme preference so "auto" stays reactive.
 */

import { usePreferredDark } from "@vueuse/core";
import { storeToRefs } from "pinia";
import { watchEffect } from "vue";
import { useThemeStore } from "./store";

export function useTheme() {
  const store = useThemeStore();
  const { choice, resolved } = storeToRefs(store);

  const prefersDark = usePreferredDark();
  watchEffect(() => {
    store.setSystemPrefersDark(prefersDark.value);
    document.documentElement.setAttribute("data-theme", resolved.value);
  });

  return {
    choice,
    resolved,
    setTheme: store.setTheme,
  };
}
