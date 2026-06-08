<script setup lang="ts">
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { useAuth } from "../auth/useAuth";
import CurrentScheduleEditor from "../features/current/CurrentScheduleEditor.vue";
import BlockoutGrid from "../features/rules/BlockoutGrid.vue";
import RulesPanel from "../features/rules/RulesPanel.vue";
import ScheduleDetail from "../features/schedule/ScheduleDetail.vue";
import ScheduleStrip from "../features/schedule/ScheduleStrip.vue";
import { useCoursesStore } from "../stores/courses";
import { useCurrentRegStore } from "../stores/currentReg";
import { useRulesStore } from "../stores/rules";
import { useSchedulesStore } from "../stores/schedules";
import { useSelectionStore } from "../stores/selection";
import { useUiStore } from "../stores/ui";
import UiButton from "../ui/Button.vue";
import EmptyState from "../ui/EmptyState.vue";
import Spinner from "../ui/Spinner.vue";

/**
 * Main content area for the authenticated app. Hosts:
 *   - the schedule strip (when generated schedules exist)
 *   - the planner/current tabs (only when current registrations exist)
 *   - the RulesPanel sidebar + BlockoutGrid + ScheduleDetail
 *
 * The "current schedule" editor will land in a follow-up; today the
 * Current tab shows a placeholder.
 */

type Tab = "current" | "browse";

const coursesStore = useCoursesStore();
const { courseGroups } = storeToRefs(coursesStore);

const selectionStore = useSelectionStore();
const { selectedCourses } = storeToRefs(selectionStore);

const currentRegStore = useCurrentRegStore();
const { currentRegistrations, sectionOverrides, includedCourses } =
  storeToRefs(currentRegStore);

const schedulesStore = useSchedulesStore();
const { schedules, activeScheduleIndex, generationStatus } = storeToRefs(schedulesStore);
const activeSchedule = computed(
  () => schedules.value[activeScheduleIndex.value] ?? null,
);

const rulesStore = useRulesStore();
const { rules } = storeToRefs(rulesStore);

const uiStore = useUiStore();
const { registrationsLoading, loadError, authRequired } = storeToRefs(uiStore);

const { status: authStatus, reauth } = useAuth();
const isLoggedIn = computed(() => authStatus.value === "authenticated");
const hasData = computed(() => courseGroups.value.size > 0);

// Default to "current" if the user has registrations, else "browse".
const activeTab = ref<Tab>(currentRegistrations.value.size > 0 ? "current" : "browse");

async function onReauth(): Promise<void> {
  await reauth();
}
</script>

<template>
  <ScheduleStrip
    :schedules="schedules"
    :active-index="activeScheduleIndex"
    @select="schedulesStore.setActiveScheduleIndex"
  />

  <div
    v-if="currentRegistrations.size > 0"
    class="flex gap-2 sm:gap-3 mb-4 border-b border-edge overflow-x-auto"
  >
    <button
      type="button"
      :class="[
        'px-3 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0',
        activeTab === 'current'
          ? 'text-fg border-b-2 border-indicator'
          : 'text-fg-muted hover:text-fg',
      ]"
      @click="activeTab = 'current'"
    >
      <span class="hidden sm:inline">Current Schedule</span>
      <span class="sm:hidden">Current</span>
    </button>
    <button
      type="button"
      :class="[
        'px-3 sm:px-4 py-2 text-sm font-medium transition-colors shrink-0',
        activeTab === 'browse'
          ? 'text-fg border-b-2 border-indicator'
          : 'text-fg-muted hover:text-fg',
      ]"
      @click="activeTab = 'browse'"
    >
      Planner
    </button>
  </div>

  <div v-if="hasData" class="flex gap-6 items-start">
    <aside class="hidden lg:block shrink-0">
      <p
        class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint mb-2"
      >
        Rules
      </p>
      <RulesPanel
        :rules="rules"
        @update:rules="rulesStore.setRules"
      />
    </aside>

    <div class="flex-1 min-w-0 space-y-4">
      <CurrentScheduleEditor
        v-if="activeTab === 'current' && currentRegistrations.size > 0"
        :current-registrations="currentRegistrations"
        :course-groups="courseGroups"
        :included-courses="includedCourses"
        :section-overrides="sectionOverrides"
        @swap-section="currentRegStore.swapSection"
        @toggle-course="currentRegStore.toggleCurrentCourse"
      />
      <template v-else>
      <BlockoutGrid
        :blockout="rules.blockout"
        :blockout-weight="rules.blockoutWeight"
        :rules="rules"
        :schedule="activeSchedule"
        :course-groups="courseGroups"
        :selected-courses="selectedCourses"
        @update:blockout="(b) => rulesStore.patchRules({ blockout: b })"
        @update:blockout-weight="(w) => rulesStore.patchRules({ blockoutWeight: w })"
      />

      <ScheduleDetail
        v-if="activeSchedule"
        :schedule="activeSchedule"
        :rules="rules"
      />
      <EmptyState
        v-else-if="generationStatus.kind === 'empty'"
        tone="warn"
        title="No valid schedules found"
      >
        <template #icon>!</template>
        <template #description>{{ generationStatus.reason }}</template>
      </EmptyState>
      <EmptyState
        v-else-if="generationStatus.kind === 'error'"
        tone="danger"
        title="Generation failed"
      >
        <template #icon>x</template>
        <template #description>
          <span class="block">{{ generationStatus.message }}</span>
          <span class="block text-xs text-fg-faint mt-2">
            Try adjusting your rules or course selection, then generate again.
          </span>
        </template>
      </EmptyState>
      <div
        v-else-if="generationStatus.kind === 'generating'"
        class="flex items-center justify-center h-64"
      >
        <div class="text-center">
          <Spinner size="lg" color="text-primary" />
          <p class="mt-3 text-sm text-fg-muted">Generating schedules…</p>
        </div>
      </div>
      <div
        v-else
        class="flex flex-col items-center justify-center gap-2 py-10 text-center"
      >
        <p class="text-sm text-fg-muted">
          {{
            selectedCourses.size === 0
              ? "Select at least one course to generate."
              : `${selectedCourses.size} course${selectedCourses.size !== 1 ? "s" : ""} ready.`
          }}
        </p>
        <UiButton
          variant="primary"
          size="md"
          :disabled="selectedCourses.size === 0"
          @click="schedulesStore.generate"
        >
          Generate Schedules
        </UiButton>
      </div>
      </template>
    </div>
  </div>

  <div
    v-else-if="isLoggedIn && registrationsLoading"
    class="flex items-center justify-center h-64"
  >
    <div class="text-center">
      <Spinner size="lg" color="text-primary" />
      <p class="mt-3 text-sm text-fg-muted">Loading your registered courses…</p>
    </div>
  </div>
  <div
    v-else-if="isLoggedIn && authRequired"
    class="flex items-center justify-center h-64"
  >
    <div class="max-w-sm text-center space-y-3">
      <p class="text-sm text-destructive">
        {{ loadError || "Banner session expired. Please sign in again." }}
      </p>
      <UiButton variant="primary" size="sm" @click="onReauth">
        Sign in again
      </UiButton>
    </div>
  </div>
  <div
    v-else-if="isLoggedIn && loadError"
    class="flex items-center justify-center h-64"
  >
    <p class="text-sm text-destructive max-w-sm text-center">{{ loadError }}</p>
  </div>
  <div v-else-if="isLoggedIn" class="flex items-center justify-center h-64">
    <p class="text-sm text-fg-faint">
      No registered courses found — search above to add courses.
    </p>
  </div>
</template>
