<script setup lang="ts">
/**
 * Lets the user view or manually paste the chrome extension ID when the app is
 * running outside the extension (dev server, pages.dev). Hidden when running as
 * the extension's own page since the ID is implicit.
 */

import { onMounted, onUnmounted, ref } from "vue";
import {
  getExtensionId,
  isExtensionContext,
  setExtensionId,
  subscribeExtensionId,
} from "../../lib/extensionId";
import UiButton from "../../ui/Button.vue";

const extensionId = ref<string | null>(getExtensionId());
const draft = ref<string>(getExtensionId() ?? "");
const editing = ref(false);
const saved = ref(false);

let unsub: (() => void) | null = null;

onMounted(() => {
  unsub = subscribeExtensionId((id) => {
    extensionId.value = id;
    if (!editing.value) draft.value = id ?? "";
  });
});

onUnmounted(() => {
  unsub?.();
});

const detected = () =>
  extensionId.value !== null && extensionId.value.length > 0;

function save(): void {
  const trimmed = draft.value.trim();
  setExtensionId(trimmed.length > 0 ? trimmed : null);
  editing.value = false;
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 1500);
}

function cancel(): void {
  draft.value = extensionId.value ?? "";
  editing.value = false;
}
</script>

<template>
  <details v-if="!isExtensionContext()" class="mt-4 text-xs">
    <summary class="cursor-pointer text-fg-faint hover:text-fg-muted select-none">
      Extension ID:
      <span v-if="detected()" class="font-mono text-fg-muted">
        {{ extensionId?.slice(0, 8) }}&hellip;{{ extensionId?.slice(-4) }}
      </span>
      <span v-else class="text-destructive">not set</span>
    </summary>

    <div class="mt-2 space-y-2">
      <p class="text-fg-faint">
        Auto-detected from the extension's content script on this page. Override
        below if detection fails (e.g. content script blocked).
      </p>

      <!-- Edit mode -->
      <div v-if="editing" class="flex gap-2">
        <input
          type="text"
          v-model="draft"
          placeholder="abcdefghijklmnopabcdefghijklmnop"
          class="flex-1 rounded-md border border-edge bg-surface px-2 py-1 font-mono text-fg"
          autocomplete="off"
          spellcheck="false"
        />
        <UiButton variant="primary" size="xs" @click="save">Save</UiButton>
        <UiButton variant="outline" size="xs" @click="cancel">Cancel</UiButton>
      </div>

      <!-- View mode -->
      <div v-else class="flex items-center gap-2">
        <UiButton variant="outline" size="xs" @click="editing = true">
          {{ detected() ? "Override" : "Set extension ID" }}
        </UiButton>
        <UiButton
          v-if="detected()"
          variant="ghost"
          size="xs"
          @click="setExtensionId(null)"
        >
          Clear
        </UiButton>
        <span v-if="saved" class="text-success text-[0.6875rem]">Saved</span>
      </div>
    </div>
  </details>
</template>
