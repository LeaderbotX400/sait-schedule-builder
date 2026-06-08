/**
 * Composable that keeps `document.documentElement[data-theme]` in sync
 * with the resolved theme. Mount this once at the app root; it also
 * wires the OS color-scheme listener so "auto" stays reactive.
 */

import { watchEffect, onMounted, onUnmounted } from "vue";
import { storeToRefs } from "pinia";
import { useThemeStore } from "./store";

export function useTheme() {
  const store = useThemeStore();
  const { choice, resolved } = storeToRefs(store);

  // Apply theme to the DOM whenever resolved changes.
  watchEffect(() => {
    document.documentElement.setAttribute("data-theme", resolved.value);
  });

  let mediaQuery: MediaQueryList | null = null;

  function onColorSchemeChange(e: MediaQueryListEvent) {
    store.setSystemPrefersDark(e.matches);
  }

  onMounted(() => {
    mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    // Sync initial value in case it changed between store init and mount.
    store.setSystemPrefersDark(mediaQuery.matches);
    mediaQuery.addEventListener("change", onColorSchemeChange);
  });

  onUnmounted(() => {
    mediaQuery?.removeEventListener("change", onColorSchemeChange);
  });

  return {
    choice,
    resolved,
    setTheme: store.setTheme,
  };
}
