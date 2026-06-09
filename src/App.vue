<script setup lang="ts">
import { computed } from "vue";
import { useAuthStore } from "@/features/auth/store";
import { useAuthInit } from "@/features/auth/useAuthInit";
import { useDemoBootstrap } from "@/composables/useDemoBootstrap";
import { useScheduleSync } from "@/composables/useScheduleSync";
import { useHolds } from "@/features/holds/useHolds";
import { useIdentity } from "@/features/identity/useIdentity";
import { useExtensionIdListener } from "@/lib/extensionIdListener";
import { useProfile } from "@/features/profile/useProfile";
import { useRegistrationStatus } from "@/features/registration-status/useRegistrationStatus";
import AppShell from "@/shell/AppShell.vue";
import SignInScreen from "@/shell/SignInScreen.vue";
import { useTheme } from "@/features/theme/useTheme";

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
