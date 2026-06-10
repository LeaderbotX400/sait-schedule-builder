<script setup lang="ts">
/**
 * Connected-pill in the AppHeader. Shows term + loading badge inline; on
 * click opens a session menu with the age, a Reauth button, and a
 * Disconnect button. Tinted warn when the credentials are stale.
 */
import { useAuth } from "./useAuth";
import Popover from "@/ui/Popover.vue";
import StatusDot from "@/ui/StatusDot.vue";

defineProps<{
  termLabel?: string | null;
  loading?: boolean;
}>();

const { busy, error, isStale, sessionAgeSeconds, reauth, disconnect } = useAuth();

function ageLabel(s: number): string {
  const minutes = Math.floor(s / 60);
  return minutes < 1 ? "just now" : `${minutes}m ago`;
}

async function handleReauth(close: () => void): Promise<void> {
  const result = await reauth();
  if (result.ok) close();
}

async function handleDisconnect(close: () => void): Promise<void> {
  await disconnect();
  close();
}
</script>

<template>
  <Popover align="right" width-class="w-60">
    <template #trigger>
      <button
        type="button"
        :aria-label="`Connected to Banner${termLabel ? `, ${termLabel}` : ''}${loading ? ', loading' : ''} — open session menu`"
        :class="[
          'flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors',
          isStale
            ? 'bg-tint-warning/90 border border-tint-warning-bd text-tint-warning-fg hover:bg-tint-warning'
            : 'bg-tint-success/90 border border-tint-success-bd text-tint-success-fg hover:bg-tint-success',
        ]"
      >
        <StatusDot :tone="isStale ? 'warn' : 'ok'" />
        <span class="hidden sm:inline">Connected</span>
        <template v-if="termLabel">
          <span class="hidden sm:inline">·&nbsp;</span>
          <span>{{ termLabel }}</span>
        </template>
        <span v-if="loading" class="italic">· Loading…</span>
      </button>
    </template>
    <template #default="{ close }">
      <div class="space-y-2">
        <div class="flex items-center justify-between text-xs">
          <span class="text-fg-muted">Session age</span>
          <span :class="isStale ? 'text-warning' : 'text-fg'">
            {{ ageLabel(sessionAgeSeconds) }}
          </span>
        </div>
        <p v-if="isStale" class="text-[0.6875rem] text-warning">
          Session may have expired. Reauth to refresh.
        </p>
        <button
          type="button"
          :disabled="busy"
          class="w-full rounded-md border border-edge px-2.5 py-1.5 text-xs text-fg-muted hover:text-fg hover:border-edge-hover disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          @click="handleReauth(close)"
        >
          {{ busy ? "Waiting for SAIT login…" : "Force Reauth" }}
        </button>
        <button
          type="button"
          class="w-full rounded-md border border-tint-danger-bd bg-tint-danger px-2.5 py-1.5 text-xs text-tint-danger-fg hover:bg-destructive hover:text-destructive-fg hover:border-destructive transition-colors"
          @click="handleDisconnect(close)"
        >
          Disconnect
        </button>
        <p v-if="error" class="text-[0.6875rem] text-destructive">{{ error }}</p>
      </div>
    </template>
  </Popover>
</template>
