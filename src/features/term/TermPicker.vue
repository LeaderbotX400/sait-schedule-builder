<script setup lang="ts">
/**
 * The term picker — the only UI allowed to switch the active term.
 * Goes through `planner.switchTerm` so the cascade (schedule wipe,
 * transient reset, Banner re-sync) always runs.
 */

import { storeToRefs } from "pinia";
import { computed } from "vue";
import { switchTerm } from "@/features/planner/actions";
import UiSelect from "@/ui/Select.vue";
import { useTermStore } from "./store";

const { term, termOptions } = storeToRefs(useTermStore());

const options = computed(() =>
  termOptions.value.map((t) => ({ value: t.code, label: t.description })),
);

const model = computed({
  get: () => term.value,
  set: (next: string | undefined) => {
    if (next) void switchTerm(next);
  },
});
</script>

<template>
  <label class="flex items-center gap-1.5">
    <span class="text-[0.625rem] font-semibold uppercase tracking-widest text-fg-faint">
      Term
    </span>
    <UiSelect v-model="model" :options="options" aria-label="Active term" />
  </label>
</template>
