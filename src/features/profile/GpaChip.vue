<script setup lang="ts">
/**
 * Compact GPA badge for the AppHeader. Hidden when profile hasn't
 * loaded a GPA yet; shows a loading dash while the initial fetch is
 * in flight; renders the formatted overall GPA otherwise.
 */
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { useProfileStore } from "./store";

const CHIP = "inline-flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs";

const profileStore = useProfileStore();
const { gpa, loading } = storeToRefs(profileStore);

const value = computed(() => gpa.value?.overallGpa ?? null);
const formatted = computed(() => {
  const v = value.value;
  if (v == null) return null;
  return typeof v === "number" ? v.toFixed(2) : String(v);
});
</script>

<template>
  <span v-if="loading && !gpa" :class="`${CHIP} bg-input/60 text-fg-faint`">
    <span class="text-[0.625rem] uppercase tracking-wide">GPA</span>
    <span>…</span>
  </span>
  <span
    v-else-if="formatted != null"
    :class="`${CHIP} bg-input text-fg-muted`"
    title="Cumulative GPA"
  >
    <span class="text-[0.625rem] uppercase tracking-wide text-fg-faint">GPA</span>
    <span class="font-semibold text-fg">{{ formatted }}</span>
  </span>
</template>
