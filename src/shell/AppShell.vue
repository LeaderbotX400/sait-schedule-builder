<script setup lang="ts">
import { ref } from "vue";
import AppHeader from "./AppHeader.vue";
import CoursesPanel from "./CoursesPanel.vue";
import MainArea from "./MainArea.vue";

/**
 * Authenticated layout. Owns the courses-panel open/closed state and
 * composes the four shell pieces: header, panel, main area.
 */
const panelOpen = ref(true);
</script>

<template>
  <div class="min-h-screen bg-page text-fg">
    <AppHeader :panel-open="panelOpen" @toggle-panel="panelOpen = !panelOpen" />
    <CoursesPanel :open="panelOpen" />
    <main class="max-w-screen-2xl mx-auto px-3 sm:px-4 py-4">
      <MainArea />
    </main>
  </div>
</template>
