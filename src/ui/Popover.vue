<script setup lang="ts">
/**
 * Floating contextual panel anchored to a trigger element, built on
 * Reka's headless Popover (portal, focus management, outside-click and
 * Escape dismissal, ARIA wiring — all handled).
 *
 * The #trigger slot renders the trigger element itself (`as-child`):
 * Reka attaches the click handler and aria attributes, so don't bind
 * your own. The default slot receives { close }.
 */

import { PopoverContent, PopoverPortal, PopoverRoot, PopoverTrigger } from "reka-ui";
import { ref } from "vue";

withDefaults(
  defineProps<{
    align?: "left" | "right";
    widthClass?: string;
  }>(),
  {
    align: "right",
    widthClass: "w-60",
  },
);

const open = ref(false);

function close(): void {
  open.value = false;
}
</script>

<template>
  <PopoverRoot v-model:open="open">
    <PopoverTrigger as-child>
      <slot name="trigger" :expanded="open" />
    </PopoverTrigger>
    <PopoverPortal>
      <PopoverContent
        :align="align === 'right' ? 'end' : 'start'"
        :side-offset="6"
        :collision-padding="8"
        :class="[
          'max-w-[calc(100vw-1rem)] rounded-lg border border-edge bg-overlay shadow-xl p-3 z-30',
          widthClass,
        ]"
      >
        <slot :close="close" />
      </PopoverContent>
    </PopoverPortal>
  </PopoverRoot>
</template>
