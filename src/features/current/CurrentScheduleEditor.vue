<script setup lang="ts">
/**
 * Displays the student's currently-registered sections on a calendar and lets
 * them swap any course to a different section or toggle the course off the
 * calendar entirely. Placed on the Current tab in MainArea.
 */

import { computed } from "vue";
import { resolveCurrentSection } from "../../domain/conflicts";
import { formatTimeCompact } from "../../domain/time";
import type { CourseSection, CurrentRegistration, Schedule } from "../../domain/types";
import Card from "../../ui/Card.vue";
import CalendarGrid from "@/features/schedules/CalendarGrid.vue";

const props = defineProps<{
  currentRegistrations: Map<string, CurrentRegistration>;
  courseGroups: Map<string, CourseSection[]>;
  includedCourses: Set<string>;
  sectionOverrides: Map<string, string>;
}>();

const emit = defineEmits<{
  "swap-section": [subjectCourse: string, newSectionId: string];
  "toggle-course": [subjectCourse: string];
}>();

/** Build a Schedule-shaped object from the current registrations for CalendarGrid. */
const schedule = computed<Schedule>(() => {
  const courses: CourseSection[] = [];
  for (const subjectCourse of props.currentRegistrations.keys()) {
    if (!props.includedCourses.has(subjectCourse)) continue;
    const section = resolveCurrentSection(
      subjectCourse,
      props.currentRegistrations,
      props.sectionOverrides,
      props.courseGroups,
    );
    if (section) courses.push(section);
  }
  return {
    id: 0,
    qualityScore: 0,
    warnings: [],
    courses,
    daysUsed: [],
    daysCount: 0,
    onCampusDays: [],
    onCampusDaysCount: 0,
    onCampusPerDay: {},
    earlyMorningPenalty: 0,
    travelTimePenalty: 0,
    isPartial: false,
    omittedCourses: [],
    blockoutFitScore: 0,
  };
});

function getActiveSectionId(subjectCourse: string): string {
  const override = props.sectionOverrides.get(subjectCourse);
  if (override !== undefined) return override;
  const reg = props.currentRegistrations.get(subjectCourse);
  return reg?.currentSection.identifier ?? "";
}

function meetingSummary(section: CourseSection): string {
  return section.meetings
    .map((m) => `${m.days.join("")} ${formatTimeCompact(m.startTime)}–${formatTimeCompact(m.endTime)}`)
    .join(", ");
}

function onSelectChange(subjectCourse: string, event: Event): void {
  const target = event.target as HTMLSelectElement;
  emit("swap-section", subjectCourse, target.value);
}
</script>

<template>
  <div class="space-y-4">
    <!-- Calendar overview -->
    <CalendarGrid :schedule="schedule" />

    <!-- Per-course cards -->
    <div
      v-if="currentRegistrations.size > 0"
      class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3"
    >
      <Card
        v-for="[subjectCourse, reg] in currentRegistrations.entries()"
        :key="subjectCourse"
        padding="p-3"
        :class="includedCourses.has(subjectCourse) ? '' : 'opacity-60'"
      >
        <!-- Header: identifier + include toggle -->
        <div class="flex items-center gap-2 mb-2">
          <input
            type="checkbox"
            :checked="includedCourses.has(subjectCourse)"
            :aria-label="`Include ${subjectCourse} on calendar`"
            class="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0 shrink-0"
            @change="emit('toggle-course', subjectCourse)"
          />
          <span class="font-mono font-semibold text-sm text-fg leading-tight">
            {{ subjectCourse }}
          </span>
          <span class="text-xs text-fg-faint truncate flex-1 min-w-0">
            {{ reg.currentSection.title }}
          </span>
        </div>

        <!-- Section selector -->
        <div class="mb-2">
          <label :for="`section-select-${subjectCourse}`" class="sr-only">
            Section for {{ subjectCourse }}
          </label>
          <select
            :id="`section-select-${subjectCourse}`"
            :value="getActiveSectionId(subjectCourse)"
            class="w-full rounded-md border border-edge bg-surface px-2 py-1 text-xs text-fg focus:outline-none focus:ring-1 focus:ring-ring"
            @change="onSelectChange(subjectCourse, $event)"
          >
            <option
              v-for="section in courseGroups.get(subjectCourse) ?? []"
              :key="section.identifier"
              :value="section.identifier"
            >
              {{ section.identifier }}
            </option>
          </select>
        </div>

        <!-- Meeting summary for the active section -->
        <template
          v-for="section in [resolveCurrentSection(subjectCourse, currentRegistrations, sectionOverrides, courseGroups)]"
          :key="section?.identifier ?? `none-${subjectCourse}`"
        >
          <p v-if="section" class="text-[11px] text-fg-faint leading-snug">
            {{ meetingSummary(section) }}
          </p>
          <p v-else class="text-[11px] text-fg-faint italic">
            Section not found
          </p>
        </template>
      </Card>
    </div>

    <p v-else class="text-sm text-fg-faint text-center py-6">
      No registered courses found.
    </p>
  </div>
</template>
