<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "./auth/store";
import { useAuthInit } from "./auth/useAuthInit";
import { useDemoBootstrap } from "./composables/useDemoBootstrap";
import { useScheduleSync } from "./composables/useScheduleSync";
import { useHolds } from "./holds/useHolds";
import { useIdentity } from "./identity/useIdentity";
import { useExtensionIdListener } from "./lib/extensionIdListener";
import { useProfile } from "./profile/useProfile";
import { useRegistrationStatus } from "./registration-status/useRegistrationStatus";
import AppShell from "./shell/AppShell.vue";
import SignInScreen from "./shell/SignInScreen.vue";
import { useTheme } from "./theme/useTheme";

// Side-effect composables — mounted once at the root.
useExtensionIdListener();
useAuthInit();
useScheduleSync();
useDemoBootstrap();
useTheme();
useIdentity();
useProfile();
useHolds();
useRegistrationStatus();

const auth = useAuthStore();
const authenticated = computed(() => auth.status === "authenticated");
</script>

<template>
  <SignInScreen v-if="!authenticated" />
  <AppShell v-else />
</template>
