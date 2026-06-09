<script setup lang="ts">
import { useScheduleSync } from "@/composables/useScheduleSync";
import { useAuthStore } from "@/features/auth/store";
import { useAuthInit } from "@/features/auth/useAuthInit";
import { useTheme } from "@/features/theme/useTheme";
import { useExtensionIdListener } from "@/lib/extensionIdListener";
import { computed } from "vue";
import AppShell from "./shell/AppShell.vue";
import SignInScreen from "./shell/SignInScreen.vue";

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
