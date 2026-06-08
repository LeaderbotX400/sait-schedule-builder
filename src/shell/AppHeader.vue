<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed } from "vue";
import { refreshAllData } from "../composables/useScheduleSync";
import { downloadICal } from "../domain/ical";
import ConnectionStatus from "../features/auth/ConnectionStatus.vue";
import ThemePicker from "../features/theme/ThemePicker.vue";
import { describeTerm } from "../lib/terms";
import GpaChip from "../profile/GpaChip.vue";
import { useCoursesStore } from "../stores/courses";
import { useSchedulesStore } from "../stores/schedules";
import { useSelectionStore } from "../stores/selection";
import { useTermStore } from "../stores/term";
import { useUiStore } from "../stores/ui";
import UiButton from "../ui/Button.vue";
import StatusDot from "../ui/StatusDot.vue";

/**
 * Sticky top bar with the courses toggle, term-aware connection pill,
 * GPA chip, and the planner's primary actions (refresh, clear, export,
 * generate). Term picker stays inline since changing terms is the most
 * common header interaction.
 */
defineProps<{ panelOpen: boolean }>();
const emit = defineEmits<{ "toggle-panel": [] }>();

const termStore = useTermStore();
const { term, termOptions } = storeToRefs(termStore);
const termLabel = computed(() => describeTerm(term.value, termOptions.value));

const coursesStore = useCoursesStore();
const { courseGroups } = storeToRefs(coursesStore);

const selectionStore = useSelectionStore();
const { selectedCourses } = storeToRefs(selectionStore);

const schedulesStore = useSchedulesStore();
const { schedules, activeScheduleIndex, generationStatus } =
  storeToRefs(schedulesStore);
const activeSchedule = computed(
  () => schedules.value[activeScheduleIndex.value] ?? null,
);
const generating = computed(() => generationStatus.value.kind === "generating");

const uiStore = useUiStore();
const { registrationsLoading } = storeToRefs(uiStore);

const hasData = computed(() => courseGroups.value.size > 0);
const canGenerate = computed(
  () => hasData.value && selectedCourses.value.size > 0 && !generating.value,
);

function onTermChange(event: Event): void {
  const target = event.target as HTMLSelectElement;
  termStore.setTerm(target.value);
}

function onExport(): void {
  if (activeSchedule.value) downloadICal(activeSchedule.value);
}
</script>

<template>
  <header
    class="sticky top-0 z-20 border-b border-edge bg-surface/80 backdrop-blur-sm"
  >
    <div
      class="max-w-screen-2xl mx-auto px-3 sm:px-4 min-h-12 flex flex-wrap items-center gap-x-3 gap-y-1.5 py-1.5"
    >
      <h1 class="text-sm font-semibold text-fg shrink-0 tracking-tight">
        SAIT <span class="hidden sm:inline">Schedule </span>Builder
      </h1>

      <button
        type="button"
        :class="[
          'flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md transition-colors',
          panelOpen
            ? 'bg-input text-fg'
            : 'text-fg-muted hover:text-fg hover:bg-input/60',
        ]"
        :aria-expanded="panelOpen"
        @click="emit('toggle-panel')"
      >
        <StatusDot :tone="panelOpen ? 'info' : 'neutral'" />
        Courses
        <span
          v-if="courseGroups.size > 0"
          class="text-[10px] font-bold px-1.5 py-0.5 rounded-full bg-surface-hover text-fg-muted"
        >
          {{ courseGroups.size }}
        </span>
      </button>

      <div class="flex-1 min-w-0" />

      <div class="flex flex-wrap items-center gap-2 ml-auto">
        <label class="flex items-center gap-1.5">
          <span
            class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint"
          >
            Term
          </span>
          <select
            :value="term"
            class="text-xs bg-input border border-edge rounded-md px-2 py-1 text-fg"
            @change="onTermChange"
          >
            <option v-for="t in termOptions" :key="t.code" :value="t.code">
              {{ t.description }}
            </option>
          </select>
        </label>

        <UiButton
          :disabled="registrationsLoading"
          title="Reload data from Banner"
          class="!px-2"
          @click="() => refreshAllData()"
        >
          <span
            :class="[
              'inline-block text-sm leading-none',
              registrationsLoading ? 'animate-spin' : '',
            ]"
          >
            ↻
          </span>
        </UiButton>

        <GpaChip />

        <ConnectionStatus :term-label="termLabel" :loading="registrationsLoading" />

        <UiButton v-if="hasData" @click="coursesStore.clearCourses">
          Clear
        </UiButton>

        <UiButton
          v-if="activeSchedule"
          title="Export this schedule as .ics"
          @click="onExport"
        >
          <span class="hidden sm:inline">Export </span>.ics
        </UiButton>

        <UiButton
          v-if="hasData"
          variant="primary"
          size="md"
          :disabled="!canGenerate"
          @click="schedulesStore.generate"
        >
          {{ generating ? "Generating…" : "Generate" }}
        </UiButton>

        <ThemePicker />
      </div>
    </div>
  </header>
</template>
