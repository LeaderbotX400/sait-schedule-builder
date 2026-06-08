<script setup lang="ts">
/**
 * Use EmptyState when a list or panel has no content to show.
 * Provide #icon, #description, and/or #action slots as needed.
 */

import { computed, useSlots } from "vue";

type Tone = "neutral" | "warn" | "danger";

const props = withDefaults(
  defineProps<{
    title: string;
    tone?: Tone;
  }>(),
  {
    tone: "neutral",
  },
);

const slots = useSlots();

const ICON_BG: Record<Tone, string> = {
  neutral: "bg-surface/40 border border-edge text-fg-muted",
  warn: "bg-tint-warning border border-tint-warning-bd text-tint-warning-fg",
  danger: "bg-tint-danger border border-tint-danger-bd text-tint-danger-fg",
};

const DESC_COLOR: Record<Tone, string> = {
  neutral: "text-fg-muted",
  warn: "text-fg-muted",
  danger: "text-destructive",
};

const iconBg = computed(() => ICON_BG[props.tone!]);
const descColor = computed(() => DESC_COLOR[props.tone!]);
</script>

<template>
  <div class="flex items-center justify-center py-8">
    <div class="max-w-md text-center space-y-2">
      <div
        v-if="slots.icon"
        :class="`inline-flex items-center justify-center h-10 w-10 rounded-full ${iconBg}`"
      >
        <span class="text-lg"><slot name="icon" /></span>
      </div>
      <h2 class="text-base font-semibold text-fg">{{ title }}</h2>
      <p v-if="slots.description" :class="`text-sm ${descColor}`">
        <slot name="description" />
      </p>
      <div v-if="slots.action" class="pt-1">
        <slot name="action" />
      </div>
    </div>
  </div>
</template>
