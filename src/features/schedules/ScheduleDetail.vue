<script setup lang="ts">
/**
 * Full detail pane for a single generated schedule. Pairs with ScheduleStrip
 * to form the two-level schedule browser: strip selects, this pane explains.
 */

import { computed, ref } from "vue";
import { formatTime } from "../../domain/time";
import type { Schedule, ScheduleRules, ScheduleWarning } from "../../domain/types";
import CalendarGrid from "./CalendarGrid.vue";
import { useSavedStore } from "@/features/saved/store";
import UiButton from "@/ui/Button.vue";

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
    icon: "&#x23F0;",
    color: "text-tint-caution-fg",
    bg: "bg-tint-caution",
    border: "border-tint-caution-bd",
  },
  travel_gap: {
    icon: "&#x1F697;",
    color: "text-tint-danger-fg",
    bg: "bg-tint-danger",
    border: "border-tint-danger-bd",
  },
  campus_days: {
    icon: "&#x1F3EB;",
    color: "text-tint-warning-fg",
    bg: "bg-tint-warning",
    border: "border-tint-warning-bd",
  },
  large_gap: {
    icon: "&#x23F3;",
    color: "text-tint-caution-fg",
    bg: "bg-tint-caution",
    border: "border-tint-caution-bd",
  },
  partial: {
    icon: "&#x2702;",
    color: "text-tint-warning-fg",
    bg: "bg-tint-warning",
    border: "border-tint-warning-bd",
  },
  blockout_conflict: {
    icon: "&#x1F6AB;",
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
  setTimeout(() => { saved.value = false; }, 1500);
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
        <UiButton
          variant="ghost"
          size="sm"
          :disabled="saved"
          @click="remember"
        >
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
    <CalendarGrid
      :schedule="schedule"
      :blockout="rules?.blockout"
    />

    <!-- Warnings -->
    <div v-if="dedupedWarnings.length > 0" class="space-y-1.5">
      <div
        v-for="(w, i) in dedupedWarnings"
        :key="i"
        class="rounded-lg border px-3 py-2 flex items-start gap-2"
        :class="[getWarningStyle(w.kind).bg, getWarningStyle(w.kind).border]"
      >
        <span class="text-sm mt-0.5" v-html="getWarningStyle(w.kind).icon" />
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
              >&#x26A0;</span>
              {{ course.identifier }}
            </span>
            <span class="text-xs text-fg-faint">CRN: {{ course.crn }}</span>
          </div>
          <div class="text-sm text-fg-muted">{{ course.title }}</div>
          <div class="text-xs text-fg-faint">
            {{ course.instructor }} &middot; {{ course.instructionalMethod }}
          </div>
          <div class="text-xs text-fg-faint">
            {{ course.seatsAvailable }}/{{ course.maximumEnrollment }} seats available
          </div>
          <div class="mt-1 space-y-0.5">
            <div
              v-for="(m, mi) in course.meetings"
              :key="mi"
              class="text-xs text-fg-muted"
            >
              {{ m.days.join(", ") }} {{ formatTime(m.startTime) }}-{{ formatTime(m.endTime) }}
              <span class="text-fg-faint ml-1">{{ m.building }} {{ m.room }}</span>
            </div>
          </div>
          <!-- Per-course warnings -->
          <div
            v-if="courseWarnings.get(course.identifier)?.length"
            class="mt-1.5 space-y-0.5"
          >
            <div
              v-for="(w, wi) in courseWarnings.get(course.identifier)"
              :key="wi"
              class="text-[10px]"
              :class="getWarningStyle(w.kind).color"
            >
              <span v-html="getWarningStyle(w.kind).icon" />
              {{ w.message }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
