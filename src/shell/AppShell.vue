<script setup lang="ts">
import { storeToRefs } from "pinia";
import AppHeader from "./AppHeader.vue";
import { useUiStore } from "../stores/ui";
import Spinner from "../ui/Spinner.vue";

const ui = useUiStore();
const { loadError, registrationsLoading } = storeToRefs(ui);
</script>

<template>
  <div class="min-h-screen bg-page text-fg">
    <AppHeader />
    <main class="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4">
      <div v-if="registrationsLoading" class="flex items-center justify-center h-64">
        <div class="text-center">
          <Spinner size="lg" color="text-primary" />
          <p class="mt-3 text-sm text-fg-muted">Loading your registered courses…</p>
        </div>
      </div>
      <div v-else-if="loadError" class="flex items-center justify-center h-64">
        <p class="text-sm text-destructive max-w-sm text-center">{{ loadError }}</p>
      </div>
      <div v-else class="text-sm text-fg-faint text-center py-16">
        Planner UI lands in the next wave. Stores, auth, and sync are live.
      </div>
    </main>
  </div>
</template>
