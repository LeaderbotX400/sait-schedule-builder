<script setup lang="ts">
/**
 * Full detail pane for a single generated schedule. Pairs with ScheduleStrip
 * to form the two-level schedule browser: strip selects, this pane explains.
 */

import { useCoursesStore } from "@/features/courses/store";
import { useSavedStore } from "@/features/saved/store";
import UiButton from "@/ui/Button.vue";
import { computed, ref } from "vue";
import { formatTime } from "../../domain/time";
import type { CourseSection, Schedule, ScheduleRules, ScheduleWarning } from "../../domain/types";
import CalendarGrid from "./CalendarGrid.vue";
import { usePinnedSectionsStore } from "./pinnedSections";

import { Icon } from "@iconify/vue";

const props = defineProps<{
  schedule: Schedule;
  rules?: ScheduleRules;
}>();

interface WarningStyle {
  icon: string;
  color: string;
  bg: string;
  border: string;
}

const WARNING_STYLES: Record<string, WarningStyle> = {
  early_morning: {
    icon: "mdi:alarm",
    color: "text-tint-caution-fg",
    bg: "bg-tint-caution",
    border: "border-tint-caution-bd",
  },
  travel_gap: {
    icon: "mdi:car",
    color: "text-tint-danger-fg",
    bg: "bg-tint-danger",
    border: "border-tint-danger-bd",
  },
  campus_days: {
    icon: "mdi:school",
    color: "text-tint-warning-fg",
    bg: "bg-tint-warning",
    border: "border-tint-warning-bd",
  },
  large_gap: {
    icon: "mdi:timer-sand",
    color: "text-tint-caution-fg",
    bg: "bg-tint-caution",
    border: "border-tint-caution-bd",
  },
  partial: {
    icon: "mdi:content-cut",
    color: "text-tint-warning-fg",
    bg: "bg-tint-warning",
    border: "border-tint-warning-bd",
  },
  blockout_conflict: {
    icon: "mdi:cancel",
    color: "text-tint-danger-fg",
    bg: "bg-tint-danger",
    border: "border-tint-danger-bd",
  },
};

const FALLBACK_STYLE: WarningStyle = WARNING_STYLES["partial"]!;

function getWarningStyle(kind: string): WarningStyle {
  return WARNING_STYLES[kind] ?? FALLBACK_STYLE;
}

/** Group blockout_conflict warnings so the same course+day isn't repeated per hour. */
function dedupeBlockoutWarnings(warnings: ScheduleWarning[]): ScheduleWarning[] {
  const seen = new Set<string>();
  const result: ScheduleWarning[] = [];
  for (const w of warnings) {
    if (w.kind === "blockout_conflict") {
      const key = `${w.courseIds.join(",")}-${w.days.join(",")}`;
      if (seen.has(key)) continue;
      seen.add(key);
      result.push({
        ...w,
        message: `${w.courseIds[0] ?? ""} on ${w.days[0] ?? ""} overlaps with blocked time`,
      });
    } else {
      result.push(w);
    }
  }
  return result;
}

const dedupedWarnings = computed(() => dedupeBlockoutWarnings(props.schedule.warnings));

const courseWarnings = computed(() => {
  const map = new Map<string, ScheduleWarning[]>();
  for (const w of dedupedWarnings.value) {
    for (const id of w.courseIds) {
      const existing = map.get(id) ?? [];
      existing.push(w);
      map.set(id, existing);
    }
  }
  return map;
});

function qualityScoreColor(score: number): string {
  if (score >= 80) return "text-success";
  if (score >= 60) return "text-warning";
  if (score >= 40) return "text-caution";
  return "text-destructive";
}

const savedStore = useSavedStore();
const saved = ref(false);

function remember(): void {
  savedStore.saveSchedule(props.schedule);
  saved.value = true;
  setTimeout(() => {
    saved.value = false;
  }, 1500);
}

const pinnedStore = usePinnedSectionsStore();
const coursesStore = useCoursesStore();

function isSectionPinned(course: CourseSection): boolean {
  return pinnedStore.pinnedSections.get(course.subjectCourse) === course.crn;
}

function togglePin(course: CourseSection): void {
  if (isSectionPinned(course)) {
    pinnedStore.unpin(course.subjectCourse);
  } else {
    pinnedStore.pin(course.subjectCourse, course.crn);
  }
}

/** All sections available for a course this term, sorted by sequence number. */
function sectionsForCourse(subjectCourse: string): CourseSection[] {
  const sections = coursesStore.courseGroups.get(subjectCourse) ?? [];
  return sections.slice().sort((a, b) => a.sequenceNumber.localeCompare(b.sequenceNumber));
}

/** Pick a section by CRN — pins it so the next regeneration uses it. Picking
 * the currently-displayed section unpins instead (back to "any section"). */
function onSelectSection(course: CourseSection, crn: string): void {
  if (!crn || crn === course.crn) {
    pinnedStore.unpin(course.subjectCourse);
    return;
  }
  pinnedStore.pin(course.subjectCourse, crn);
}

/** Short summary of a section for the dropdown option label. */
function sectionOptionLabel(section: CourseSection): string {
  const first = section.meetings[0];
  const time = first ? `${formatTime(first.startTime)}–${formatTime(first.endTime)}` : "";
  const days = first?.days.join("") ?? "";
  const instructor = section.instructor ? ` · ${section.instructor}` : "";
  const seats = section.seatsAvailable > 0 ? "" : " (full)";
  return [section.identifier, days && time ? `${days} ${time}` : ""]
    .filter(Boolean)
    .join(" — ")
    .concat(instructor, seats);
}

const qualityTooltip = computed(() => {
  const s = props.schedule;
  return [
    `Quality score: ${s.qualityScore}/100`,
    `Days used: ${s.daysCount}`,
    `On-campus days: ${s.onCampusDaysCount}`,
    s.earlyMorningPenalty ? `Early-morning penalty: −${s.earlyMorningPenalty}` : null,
    s.travelTimePenalty ? `Travel-gap penalty: −${s.travelTimePenalty}` : null,
    s.blockoutFitScore < 100 ? `Blockout match: ${s.blockoutFitScore}%` : null,
    s.isPartial ? "Partial schedule (some courses dropped)" : null,
  ]
    .filter(Boolean)
    .join(" • ");
});
</script>

<template>
  <div class="space-y-4">
    <!-- Header -->
    <div class="flex items-center justify-between">
      <div>
        <h2 class="text-lg font-semibold text-fg">Schedule #{{ schedule.id }}</h2>
        <div class="flex items-center gap-3 text-sm text-fg-muted">
          <span>{{ schedule.courses.length }} courses</span>
          <span>{{ schedule.daysCount }} days</span>
          <span>{{ schedule.onCampusDaysCount }} on-campus</span>
          <span
            v-if="schedule.blockoutFitScore < 100 && schedule.blockoutFitScore > 0"
            class="text-xs text-primary"
          >
            {{ schedule.blockoutFitScore }}% blockout match
          </span>
        </div>
      </div>
      <div class="flex items-center gap-3">
        <UiButton variant="ghost" size="sm" :disabled="saved" @click="remember">
          {{ saved ? "Saved!" : "Remember" }}
        </UiButton>
        <div class="flex items-center gap-2" :title="qualityTooltip">
          <span class="text-2xl font-bold" :class="qualityScoreColor(schedule.qualityScore)">
            {{ schedule.qualityScore }}
          </span>
          <span class="text-xs text-fg-faint">/100</span>
        </div>
      </div>
    </div>

    <!-- Calendar -->
    <CalendarGrid :schedule="schedule" :blockout="rules?.blockout" />

    <!-- Warnings -->
    <div v-if="dedupedWarnings.length > 0" class="space-y-1.5">
      <div
        v-for="(w, i) in dedupedWarnings"
        :key="i"
        class="rounded-lg border px-3 py-2 flex items-start gap-2"
        :class="[getWarningStyle(w.kind).bg, getWarningStyle(w.kind).border]"
      >
        <Icon
          :icon="getWarningStyle(w.kind).icon"
          :class="['text-sm mt-0.5 shrink-0', getWarningStyle(w.kind).color]"
          aria-hidden="true"
        />
        <div class="flex-1 min-w-0">
          <p class="text-xs" :class="getWarningStyle(w.kind).color">{{ w.message }}</p>
          <p v-if="w.courseIds.length > 0" class="text-[10px] text-fg-faint mt-0.5">
            Affects: {{ w.courseIds.join(", ") }}
          </p>
        </div>
      </div>
    </div>

    <!-- Omitted courses -->
    <div
      v-if="schedule.omittedCourses.length > 0"
      class="rounded-lg bg-surface/40 border border-edge px-3 py-2 space-y-1.5"
    >
      <p class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">
        Not included in this schedule
      </p>
      <div
        v-for="o in schedule.omittedCourses"
        :key="o.subjectCourse"
        class="flex items-baseline gap-2 text-xs"
      >
        <span class="font-mono font-semibold text-fg-muted shrink-0">{{ o.subjectCourse }}</span>
        <span class="text-fg-faint">{{ o.reason }}</span>
      </div>
    </div>

    <!-- Course list -->
    <div class="space-y-2">
      <h3 class="text-sm font-medium text-fg-muted">Course Details</h3>
      <div class="grid gap-2 sm:grid-cols-2">
        <div
          v-for="course in schedule.courses"
          :key="course.crn"
          class="rounded-lg px-3 py-2"
          :class="
            courseWarnings.get(course.identifier)?.length
              ? 'bg-tint-danger border border-tint-danger-bd'
              : 'bg-input/50 border border-edge'
          "
        >
          <div class="flex items-center justify-between">
            <span class="font-mono text-sm font-semibold text-fg">
              <span
                v-if="courseWarnings.get(course.identifier)?.length"
                class="text-destructive mr-1"
                role="img"
                aria-label="Has scheduling warning"
              >
                <Icon icon="mdi:alert" aria-hidden="true" />
              </span>
              {{ course.identifier }}
            </span>
            <div class="flex items-center gap-2">
              <span class="text-xs text-fg-faint">CRN: {{ course.crn }}</span>
              <button
                :title="
                  isSectionPinned(course)
                    ? `Unlock ${course.identifier} — allow any section`
                    : `Lock ${course.identifier} — only show schedules with this section`
                "
                :aria-label="
                  isSectionPinned(course)
                    ? `Unlock ${course.identifier}`
                    : `Lock ${course.identifier}`
                "
                :aria-pressed="isSectionPinned(course)"
                class="text-base leading-none transition-colors rounded p-0.5 hover:bg-surface-hover/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                @click="togglePin(course)"
              >
                <Icon
                  :icon="isSectionPinned(course) ? 'mdi:lock' : 'mdi:lock-open-variant'"
                  :class="isSectionPinned(course) ? 'text-destructive' : 'text-success'"
                  aria-hidden="true"
                />
              </button>
            </div>
          </div>
          <div class="text-sm text-fg-muted">{{ course.title }}</div>
          <div class="text-xs text-fg-faint">
            {{ course.instructor }} &middot; {{ course.instructionalMethod }}
          </div>
          <div class="text-xs text-fg-faint">
            {{ course.seatsAvailable }}/{{ course.maximumEnrollment }} seats available
          </div>
          <div class="mt-1 space-y-0.5">
            <div v-for="(m, mi) in course.meetings" :key="mi" class="text-xs text-fg-muted">
              {{ m.days.join(", ") }} {{ formatTime(m.startTime) }}-{{ formatTime(m.endTime) }}
              <span class="text-fg-faint ml-1">{{ m.building }} {{ m.room }}</span>
            </div>
          </div>

          <!-- Section swap dropdown -->
          <div
            v-if="sectionsForCourse(course.subjectCourse).length > 1"
            class="mt-2 flex items-center gap-1.5"
          >
            <label
              :for="`section-swap-${course.subjectCourse}`"
              class="text-[10px] uppercase tracking-widest text-fg-faint shrink-0"
            >
              Swap
            </label>
            <select
              :id="`section-swap-${course.subjectCourse}`"
              :value="course.crn"
              class="flex-1 min-w-0 rounded-md bg-input border border-edge px-1.5 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
              :title="isSectionPinned(course)
                ? `Currently locked to ${course.identifier} — picking another section will lock that one instead`
                : `Pick another section to lock it (only schedules with that section will show)`"
              @change="onSelectSection(course, ($event.target as HTMLSelectElement).value)"
            >
              <option
                v-for="s in sectionsForCourse(course.subjectCourse)"
                :key="s.crn"
                :value="s.crn"
              >
                {{ sectionOptionLabel(s) }}
              </option>
            </select>
          </div>
          <!-- Per-course warnings -->
          <div v-if="courseWarnings.get(course.identifier)?.length" class="mt-1.5 space-y-0.5">
            <div
              v-for="(w, wi) in courseWarnings.get(course.identifier)"
              :key="wi"
              class="text-[10px]"
              :class="getWarningStyle(w.kind).color"
            >
              <Icon
                :icon="getWarningStyle(w.kind).icon"
                class="inline-block align-text-bottom"
                aria-hidden="true"
              />
              {{ w.message }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
