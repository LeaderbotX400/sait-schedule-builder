<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAuth } from "../auth/useAuth";
import ThemePicker from "../features/theme/ThemePicker.vue";
import { useTermStore } from "../stores/term";
import UiButton from "../ui/Button.vue";
import StatusDot from "../ui/StatusDot.vue";

/**
 * Sticky top bar. Houses the term picker, session indicator, theme
 * picker, and the panel toggle button driven by AppShell.
 */
defineProps<{ panelOpen: boolean }>();
const emit = defineEmits<{ "toggle-panel": [] }>();

const { isStale, sessionAgeSeconds, disconnect, reauth } = useAuth();

const termStore = useTermStore();
const { term, termOptions } = storeToRefs(termStore);

function onTermChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  termStore.setTerm(target.value);
}

async function onReauth(): Promise<void> {
  await reauth();
}

function formatAge(seconds: number): string {
  if (seconds < 60) return `${seconds}s`;
  const minutes = Math.floor(seconds / 60);
  return `${minutes}m`;
}
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-edge bg-surface/95 backdrop-blur-sm"
  >
    <div
      class="max-w-screen-2xl mx-auto px-3 sm:px-4 h-12 flex items-center gap-3"
    >
      <h1 class="text-sm font-semibold text-fg shrink-0">
        SAIT Schedule Builder
      </h1>

      <button
        type="button"
        class="flex items-center gap-1.5 text-xs px-2 py-1 rounded-md border border-edge bg-surface text-fg hover:bg-surface-hover hover:border-edge-hover transition-colors"
        :aria-expanded="panelOpen"
        @click="emit('toggle-panel')"
      >
        <StatusDot :tone="panelOpen ? 'info' : 'neutral'" />
        <span>Courses</span>
      </button>

      <label class="flex items-center gap-2 ml-auto">
        <span
          class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint"
        >
          Term
        </span>
        <select
          :value="term"
          class="text-xs bg-input border border-edge rounded-md px-2 py-1 text-fg"
          @change="onTermChange"
        >
          <option v-for="t in termOptions" :key="t.code" :value="t.code">
            {{ t.description }}
          </option>
        </select>
      </label>

      <div
        class="flex items-center gap-1.5 text-xs text-fg-muted"
        :title="`Session age ${formatAge(sessionAgeSeconds)}`"
      >
        <StatusDot :tone="isStale ? 'warn' : 'ok'" />
        <span>{{ formatAge(sessionAgeSeconds) }}</span>
      </div>

      <UiButton v-if="isStale" variant="outline" size="xs" @click="onReauth">
        Reauth
      </UiButton>
      <UiButton variant="ghost" size="xs" @click="() => disconnect()">
        Sign out
      </UiButton>
      <ThemePicker />
    </div>
  </header>
</template>
