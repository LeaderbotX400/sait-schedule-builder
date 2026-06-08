<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "./auth/store";
import { useAuthInit } from "./auth/useAuthInit";
import { useScheduleSync } from "./composables/useScheduleSync";
import { useExtensionIdListener } from "./lib/extensionIdListener";
import AppShell from "./shell/AppShell.vue";
import SignInScreen from "./shell/SignInScreen.vue";
import { useTheme } from "./theme/useTheme";

// Side-effect composables — mounted once at the root.
useExtensionIdListener();
useAuthInit();
useScheduleSync();
useTheme();

const auth = useAuthStore();
const authenticated = computed(() => auth.status === "authenticated");
</script>

<template>
  <SignInScreen v-if="!authenticated" />
  <AppShell v-else />
</template>
