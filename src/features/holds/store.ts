import { defineStore } from "pinia";
import { ref } from "vue";

/**
 * Reactive holds state — the count of academic/financial holds on the
 * student's account. Use useHolds() composable at the app root to populate it.
 */
export const useHoldsStore = defineStore("holds", () => {
  /** Number of active holds; null means the data hasn't loaded or is unknown. */
  const count = ref<number | null>(null);
  /** True while a holds fetch is in flight. */
  const loading = ref(false);

  function setCount(value: number | null): void {
    count.value = value;
  }

  function setLoading(value: boolean): void {
    loading.value = value;
  }

  function reset(): void {
    count.value = null;
    loading.value = false;
  }

  return { count, loading, setCount, setLoading, reset };
});
