<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "./auth/store";
import { useAuthInit } from "./auth/useAuthInit";
import { useExtensionIdListener } from "./lib/extensionIdListener";
import { useScheduleSync } from "./composables/useScheduleSync";
import SignInScreen from "./shell/SignInScreen.vue";
import AppShell from "./shell/AppShell.vue";

// Side-effect composables — mounted once at the root.
useExtensionIdListener();
useAuthInit();
useScheduleSync();

const auth = useAuthStore();
const authenticated = computed(() => auth.status === "authenticated");
</script>

<template>
  <SignInScreen v-if="!authenticated" />
  <AppShell v-else />
</template>
