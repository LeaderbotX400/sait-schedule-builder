<script setup lang="ts">
import { useDemoBootstrap } from "@/composables/useDemoBootstrap";
import { useScheduleSync } from "@/composables/useScheduleSync";
import { useAuthStore } from "@/features/auth/store";
import { useAuthInit } from "@/features/auth/useAuthInit";
import { useHolds } from "@/features/holds/useHolds";
import { useIdentity } from "@/features/identity/useIdentity";
import { useProfile } from "@/features/profile/useProfile";
import { useRegistrationStatus } from "@/features/registration-status/useRegistrationStatus";
import { useTheme } from "@/features/theme/useTheme";
import { useExtensionIdListener } from "@/lib/extensionIdListener";
import { computed } from "vue";
import CalendarGrid from "./components/Calendar/CalendarGrid.vue";
// import AppShell from "./shell/AppShell.vue";
// import SignInScreen from "./shell/SignInScreen.vue";

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
  <CalendarGrid />
  <!-- <SignInScreen v-if="!authenticated" />
  <AppShell v-else /> -->
</template>
