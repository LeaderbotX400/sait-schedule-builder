<script setup lang="ts">
/**
 * Styled single-value select built on Reka's headless Select —
 * keyboard navigation, typeahead, portal positioning and ARIA for free.
 */

import {
  SelectContent,
  SelectItem,
  SelectItemIndicator,
  SelectItemText,
  SelectPortal,
  SelectRoot,
  SelectTrigger,
  SelectValue,
  SelectViewport,
} from "reka-ui";

export interface SelectOption {
  value: string;
  label: string;
}

defineProps<{
  options: SelectOption[];
  ariaLabel?: string;
  placeholder?: string;
}>();

const model = defineModel<string>();
</script>

<template>
  <SelectRoot v-model="model">
    <SelectTrigger
      :aria-label="ariaLabel"
      class="inline-flex items-center gap-1.5 text-xs bg-input border border-edge rounded-md px-2 py-1 text-fg hover:border-edge-hover transition-colors data-[state=open]:border-edge-hover"
    >
      <SelectValue :placeholder="placeholder ?? 'Select…'" />
      <span aria-hidden="true" class="text-fg-faint text-[0.625rem]">▾</span>
    </SelectTrigger>
    <SelectPortal>
      <SelectContent
        position="popper"
        :side-offset="4"
        :collision-padding="8"
        class="z-40 min-w-[var(--reka-select-trigger-width)] rounded-lg border border-edge bg-overlay shadow-xl p-1"
      >
        <SelectViewport>
          <SelectItem
            v-for="o in options"
            :key="o.value"
            :value="o.value"
            class="flex items-center gap-1.5 px-2 py-1.5 text-xs rounded-md text-fg-muted cursor-pointer outline-none data-[highlighted]:bg-surface-hover data-[highlighted]:text-fg data-[state=checked]:text-fg"
          >
            <SelectItemIndicator class="text-[0.625rem] text-fg-faint">✓</SelectItemIndicator>
            <SelectItemText>{{ o.label }}</SelectItemText>
          </SelectItem>
        </SelectViewport>
      </SelectContent>
    </SelectPortal>
  </SelectRoot>
</template>
