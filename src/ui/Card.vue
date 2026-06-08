<script setup lang="ts">
/**
 * Use Card to group related content in a visually distinct surface.
 * Choose size to constrain max-width; use padding to override inner spacing.
 */

import { computed } from "vue";

type CardSize = "sm" | "md" | "full";

const props = withDefaults(
  defineProps<{
    padding?: string;
    size?: CardSize;
  }>(),
  {
    padding: "p-4 sm:p-6",
    size: "full",
  },
);

const SIZE: Record<CardSize, string> = {
  sm: "w-full max-w-sm",
  md: "w-full max-w-md",
  full: "w-full",
};

const classes = computed(
  () =>
    `rounded-xl border border-edge bg-surface/60 shadow-lg ${SIZE[props.size!]} ${props.padding}`,
);
</script>

<template>
  <div :class="classes" v-bind="$attrs">
    <slot />
  </div>
</template>
