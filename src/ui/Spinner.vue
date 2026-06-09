<script setup lang="ts">
/**
 * Use Spinner to indicate an async operation in progress.
 * Renders inline — wrap in a flex container to center it.
 */

import { computed } from "vue";

type SpinnerSize = "xs" | "sm" | "md" | "lg";

const props = withDefaults(
  defineProps<{
    size?: SpinnerSize;
    color?: string;
  }>(),
  {
    size: "md",
    color: "text-current",
  },
);

const SIZE: Record<SpinnerSize, string> = {
  xs: "h-3 w-3 border-2",
  sm: "h-3.5 w-3.5 border-2",
  md: "h-4 w-4 border-2",
  lg: "h-8 w-8 border-4",
};

const classes = computed(
  () =>
    `inline-block animate-spin rounded-full border-current border-r-transparent ${SIZE[props.size!]} ${props.color}`,
);
</script>

<template>
  <span :class="classes" role="status" aria-label="Loading" />
</template>
