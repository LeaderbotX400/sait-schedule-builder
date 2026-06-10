<script setup lang="ts">
/**
 * Floating popover button for switching themes. Place once in the app
 * header; reads and writes via useThemeStore so all other consumers
 * stay in sync.
 */

import { storeToRefs } from "pinia";
import { useThemeStore } from "./store";
import { THEMES } from "./themes";
import type { ThemeChoice } from "./store";
import Popover from "@/ui/Popover.vue";

const store = useThemeStore();
const { choice } = storeToRefs(store);

const options: { key: ThemeChoice; label: string; swatches?: [string, string, string] }[] = [
  { key: "auto", label: "Auto (system)" },
  ...THEMES.map((t) => ({ key: t.id as ThemeChoice, label: t.label, swatches: t.swatches })),
];
</script>

<template>
  <Popover align="right" widthClass="w-52">
    <template #trigger>
      <button
        type="button"
        aria-label="Change theme"
        class="px-2 py-1 text-xs rounded-md border border-edge bg-surface text-fg hover:bg-surface-hover hover:border-edge-hover transition-colors"
        title="Change theme"
      >
        <span class="text-sm leading-none" aria-hidden="true">&#9680;</span>
      </button>
    </template>

    <template #default="{ close }">
      <div class="space-y-1">
        <p class="text-[0.625rem] font-semibold uppercase tracking-widest text-fg-faint mb-2">
          Theme
        </p>
        <button
          v-for="o in options"
          :key="o.key"
          type="button"
          @click="() => { store.setTheme(o.key); close(); }"
          :aria-label="`${o.label} theme${choice === o.key ? ' (current)' : ''}`"
          :aria-pressed="choice === o.key"
          :class="[
            'w-full flex items-center gap-2.5 px-2 py-1.5 rounded-md text-xs transition-colors',
            choice === o.key
              ? 'bg-tint-primary text-tint-primary-fg'
              : 'text-fg-muted hover:bg-surface-hover hover:text-fg',
          ]"
        >
          <span v-if="o.swatches" class="flex gap-0.5 shrink-0">
            <span
              v-for="(color, i) in o.swatches"
              :key="`${o.key}-${i}`"
              class="h-4 w-4 rounded-sm border border-edge/50"
              :style="{ backgroundColor: color }"
            />
          </span>
          <span
            v-else
            class="flex items-center justify-center h-4 w-[3.25rem] shrink-0 text-[0.625rem] text-fg-faint"
          >
            &#9788;/&#9790;
          </span>
          <span>{{ o.label }}</span>
        </button>
      </div>
    </template>
  </Popover>
</template>
