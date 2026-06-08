<script setup lang="ts">
/**
 * Use StatusDot to show a small colored indicator next to status labels.
 * Callers can add extra classes via Vue's attr fallthrough (no className prop needed).
 */

import { computed } from "vue";

type Tone = "neutral" | "ok" | "warn" | "danger" | "info";

const props = defineProps<{
  tone: Tone;
}>();

const COLOR: Record<Tone, string> = {
  neutral: "bg-fg-faint",
  ok: "bg-success",
  warn: "bg-warning",
  danger: "bg-destructive",
  info: "bg-primary",
};

const classes = computed(
  () => `h-1.5 w-1.5 rounded-full shrink-0 ${COLOR[props.tone]}`,
);
</script>

<template>
  <span :class="classes" v-bind="$attrs" />
</template>
