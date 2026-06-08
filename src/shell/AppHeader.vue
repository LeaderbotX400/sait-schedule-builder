<script setup lang="ts">
import { storeToRefs } from "pinia";
import { useAuth } from "../auth/useAuth";
import { useTermStore } from "../stores/term";
import StatusDot from "../ui/StatusDot.vue";
import UiButton from "../ui/Button.vue";

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
  <header class="sticky top-0 z-20 border-b border-edge bg-surface/95 backdrop-blur-sm">
    <div class="max-w-screen-2xl mx-auto px-3 sm:px-4 h-12 flex items-center gap-3">
      <h1 class="text-sm font-semibold text-fg">SAIT Schedule Builder</h1>

      <label class="flex items-center gap-2 ml-auto">
        <span class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">Term</span>
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

      <div class="flex items-center gap-1.5 text-xs text-fg-muted" :title="`Session age ${formatAge(sessionAgeSeconds)}`">
        <StatusDot :tone="isStale ? 'warn' : 'ok'" />
        <span>{{ formatAge(sessionAgeSeconds) }}</span>
      </div>

      <UiButton v-if="isStale" variant="outline" size="xs" @click="onReauth">Reauth</UiButton>
      <UiButton variant="ghost" size="xs" @click="() => disconnect()">Sign out</UiButton>
    </div>
  </header>
</template>
