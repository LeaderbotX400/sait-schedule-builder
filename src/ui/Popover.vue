<script setup lang="ts">
/**
 * Use Popover for floating contextual panels anchored to a trigger element.
 * Bind the #trigger slot to your button; the default slot receives { close }.
 */

import { ref, watch, onUnmounted, nextTick } from "vue";

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
const containerRef = ref<HTMLElement | null>(null);

function toggle() {
  open.value = !open.value;
}

function close() {
  open.value = false;
}

function onMousedown(event: MouseEvent) {
  if (!open.value) return;
  if (
    containerRef.value &&
    !containerRef.value.contains(event.target as Node)
  ) {
    close();
  }
}

function onKeydown(event: KeyboardEvent) {
  if (open.value && event.key === "Escape") {
    close();
  }
}

watch(open, async (isOpen) => {
  if (isOpen) {
    await nextTick();
    document.addEventListener("mousedown", onMousedown);
    document.addEventListener("keydown", onKeydown);
  } else {
    document.removeEventListener("mousedown", onMousedown);
    document.removeEventListener("keydown", onKeydown);
  }
});

onUnmounted(() => {
  document.removeEventListener("mousedown", onMousedown);
  document.removeEventListener("keydown", onKeydown);
});

const bodyClasses = [
  "absolute mt-1.5 max-w-[calc(100vw-1rem)] rounded-lg border border-edge bg-overlay shadow-xl p-3 z-30",
];
</script>

<template>
  <div class="relative" ref="containerRef">
    <slot name="trigger" :toggle="toggle" :expanded="open" />
    <div
      v-if="open"
      :class="[...bodyClasses, widthClass, align === 'right' ? 'right-0' : 'left-0']"
      role="dialog"
    >
      <slot :close="close" />
    </div>
  </div>
</template>
