<script setup lang="ts">
import { useAuth } from "../auth/useAuth";
import ExtensionIdSettings from "../features/auth/ExtensionIdSettings.vue";
import ThemePicker from "../features/theme/ThemePicker.vue";
import Card from "../ui/Card.vue";
import UiButton from "../ui/Button.vue";

const { busy, error, login, cancelLogin } = useAuth();

async function handleLogin(): Promise<void> {
  await login();
}
</script>

<template>
  <div class="flex items-center justify-center min-h-screen bg-page text-fg p-4">
    <Card size="sm">
      <div class="flex items-center justify-between mb-3">
        <h1 class="text-sm font-medium text-fg-muted">Connect to SAIT Banner</h1>
        <ThemePicker />
      </div>
      <p class="text-xs text-fg-faint mb-4">
        A SAIT login window will open. Sign in and it will close automatically.
      </p>
      <UiButton
        variant="primary"
        size="md"
        :disabled="busy"
        class="w-full"
        @click="handleLogin"
      >
        {{ busy ? "Waiting for SAIT login…" : "Sign in with SAIT" }}
      </UiButton>
      <UiButton
        v-if="busy"
        variant="outline"
        size="xs"
        class="mt-2 w-full"
        @click="cancelLogin"
      >
        Cancel
      </UiButton>
      <p v-if="error" class="mt-3 text-xs text-destructive">{{ error }}</p>
      <ExtensionIdSettings />
    </Card>
  </div>
</template>
