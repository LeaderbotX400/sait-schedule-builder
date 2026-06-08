<script setup lang="ts">
/**
 * Use Button for interactive actions. Pick a variant to communicate intent:
 * primary = main CTA, outline = secondary, ghost = low-emphasis, danger = destructive.
 */

import { computed } from "vue";

type Variant = "primary" | "outline" | "ghost" | "danger";
type Size = "xs" | "sm" | "md";
type ButtonType = "button" | "submit" | "reset";

const props = withDefaults(
  defineProps<{
    variant?: Variant;
    size?: Size;
    type?: ButtonType;
    disabled?: boolean;
  }>(),
  {
    variant: "outline",
    size: "sm",
    type: "button",
    disabled: false,
  },
);

const emit = defineEmits<{
  click: [event: MouseEvent];
}>();

const VARIANT: Record<Variant, string> = {
  primary: "bg-primary text-primary-fg font-semibold hover:bg-primary-hover",
  outline:
    "border border-edge bg-surface text-fg hover:bg-surface-hover hover:border-edge-hover",
  ghost: "text-fg-faint hover:text-fg-muted",
  danger:
    "bg-destructive text-destructive-fg font-semibold hover:bg-destructive-hover",
};

const SIZE: Record<Size, string> = {
  xs: "px-2 py-0.5 text-xs",
  sm: "px-2.5 py-1 text-xs",
  md: "px-3 py-1 text-xs",
};

const BASE =
  "rounded-md transition-colors disabled:opacity-40 disabled:cursor-not-allowed";

const classes = computed(
  () => `${BASE} ${VARIANT[props.variant!]} ${SIZE[props.size!]}`,
);
</script>

<template>
  <button
    :type="type"
    :disabled="disabled"
    :class="classes"
    v-bind="$attrs"
    @click="emit('click', $event)"
  >
    <slot />
  </button>
</template>
