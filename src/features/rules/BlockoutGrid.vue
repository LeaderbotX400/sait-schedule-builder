<script setup lang="ts">
/**
 * Paintable week-grid for setting blockout preferences (preferred / blocked /
 * neutral cells). Overlay the active schedule's meetings for context and
 * show ghost blocks for alternative sections not in the current schedule.
 * Bind via v-model:blockout and v-model:blockout-weight.
 */

import { computed, ref } from "vue";
import { storeToRefs } from "pinia";
import { getExpandedMeetings } from "../../domain/scheduler";
import { formatHour, formatTime, timeToMinutes } from "../../domain/time";
import type {
  BlockoutCell,
  BlockoutGrid as BlockoutGridType,
  CourseSection,
  DayOfWeek,
  MeetingBlock,
  Schedule,
  ScheduleRules,
} from "../../domain/types";
import { createEmptyBlockout } from "../../domain/blockout";
import { ALL_DAYS, GRID_HOURS, WEEKDAYS } from "../../domain/types";
import { useThemeStore, getThemeMode } from "@/features/theme/store";
import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  HOUR_HEIGHT,
} from "@/features/schedules/calendarColors";

// ── Props & emits ────────────────────────────────────────────────────────────

const props = defineProps<{
  blockout: BlockoutGridType;
  blockoutWeight: number;
  rules: ScheduleRules;
  schedule: Schedule | null;
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>;
}>();

const emit = defineEmits<{
  "update:blockout": [next: BlockoutGridType];
  "update:blockoutWeight": [weight: number];
}>();

// ── Paint mode (used in the toolbar) ────────────────────────────────────────

type PaintMode = BlockoutCell;
const paintMode = ref<PaintMode>("preferred");
const isPainting = ref(false);

const PAINT_MODES: { value: PaintMode; label: string }[] = [
  { value: "preferred", label: "Classes here" },
  { value: "blocked", label: "No classes" },
  { value: "neutral", label: "Erase" },
];

// ── Hard-blocked helpers ─────────────────────────────────────────────────────

const winStartHour = computed(() => Math.floor(parseInt(props.rules.earliestStart, 10) / 100));
const winEndHour = computed(() => Math.ceil(parseInt(props.rules.latestEnd, 10) / 100));
const hardBlockedDays = computed(() => new Set(props.rules.freeDays));

function isHardBlocked(day: DayOfWeek, hour: number): boolean {
  if (!WEEKDAYS.includes(day)) return true;
  if (hardBlockedDays.value.has(day)) return true;
  if (hour < winStartHour.value || hour >= winEndHour.value) return true;
  return false;
}

// ── Expanded meetings & ghosts ───────────────────────────────────────────────

interface ExpandedMeeting {
  course: CourseSection;
  meeting: MeetingBlock;
  day: DayOfWeek;
}

const expanded = computed<ExpandedMeeting[]>(() =>
  props.schedule ? getExpandedMeetings(props.schedule) : [],
);

const ghosts = computed<ExpandedMeeting[]>(() => {
  const activeCrns = new Set(props.schedule?.courses.map((c) => c.crn) ?? []);
  const out: ExpandedMeeting[] = [];
  for (const subjectCourse of props.selectedCourses) {
    const sections = props.courseGroups.get(subjectCourse) ?? [];
    for (const section of sections) {
      if (activeCrns.has(section.crn)) continue;
      for (const meeting of section.meetings) {
        for (const day of meeting.days) {
          out.push({ course: section, meeting, day });
        }
      }
    }
  }
  return out;
});

// ── Hours range (expand to cover all meetings) ───────────────────────────────

const hours = computed<number[]>(() => {
  let minHour = GRID_HOURS[0] ?? 7;
  let maxHour = (GRID_HOURS[GRID_HOURS.length - 1] ?? 21) + 1;

  function consider(m: MeetingBlock): void {
    const sh = Math.floor(m.startTime / 100);
    const eh = Math.ceil(m.endTime / 100);
    if (sh < minHour) minHour = sh;
    if (eh > maxHour) maxHour = eh;
  }

  for (const { meeting } of expanded.value) consider(meeting);
  for (const { meeting } of ghosts.value) consider(meeting);

  return Array.from({ length: maxHour - minHour }, (_, i) => minHour + i);
});

const gridStartMinutes = computed(() => (hours.value[0] ?? 7) * 60);
const totalHeight = computed(() => hours.value.length * HOUR_HEIGHT);

// ── Display days (add Sat/Sun only when meetings fall on them) ───────────────

const displayDays = computed<DayOfWeek[]>(() => {
  const hasSat =
    expanded.value.some((e) => e.day === "Sat") || ghosts.value.some((g) => g.day === "Sat");
  const hasSun =
    expanded.value.some((e) => e.day === "Sun") || ghosts.value.some((g) => g.day === "Sun");
  return [
    ...WEEKDAYS,
    ...(hasSat ? (["Sat"] as DayOfWeek[]) : []),
    ...(hasSun ? (["Sun"] as DayOfWeek[]) : []),
  ];
});

// ── Color map for schedule meetings ─────────────────────────────────────────

const themeStore = useThemeStore();
const { resolved: resolvedTheme } = storeToRefs(themeStore);

const courseIds = computed(() => [
  ...new Set(props.schedule?.courses.map((c) => c.identifier) ?? []),
]);
const colorMap = computed(() => buildColorMap(courseIds.value));
const warningKeys = computed(() => buildWarningKeys(props.schedule?.warnings ?? []));
const warnedCourseIds = computed(() => buildWarnedCourseIds(props.schedule?.warnings ?? []));

// ── Per-day event/ghost maps ─────────────────────────────────────────────────

const dayEvents = computed(() => {
  const m = new Map<DayOfWeek, ExpandedMeeting[]>();
  for (const entry of expanded.value) {
    if (!displayDays.value.includes(entry.day)) continue;
    const existing = m.get(entry.day) ?? [];
    existing.push(entry);
    m.set(entry.day, existing);
  }
  return m;
});

const dayGhosts = computed(() => {
  const m = new Map<DayOfWeek, ExpandedMeeting[]>();
  for (const entry of ghosts.value) {
    if (!displayDays.value.includes(entry.day)) continue;
    const existing = m.get(entry.day) ?? [];
    existing.push(entry);
    m.set(entry.day, existing);
  }
  return m;
});

// ── Painting ─────────────────────────────────────────────────────────────────

function paint(day: DayOfWeek, hour: number): void {
  if (isHardBlocked(day, hour)) return;
  const next: BlockoutGridType = { ...props.blockout };
  next[day] = { ...next[day], [hour]: paintMode.value };
  emit("update:blockout", next);
}

function handleMouseDown(day: DayOfWeek, hour: number): void {
  if (isHardBlocked(day, hour)) return;
  isPainting.value = true;
  paint(day, hour);
}

function handleMouseEnter(day: DayOfWeek, hour: number): void {
  if (isPainting.value) paint(day, hour);
}

function handleMouseUp(): void {
  isPainting.value = false;
}

// ── Cell style helpers ────────────────────────────────────────────────────────

const HARD_BLOCKED_BG_IMAGE =
  "repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.035) 3px, rgba(255,255,255,0.035) 6px)";

function cellClass(day: DayOfWeek, hour: number): string {
  if (isHardBlocked(day, hour)) return "";
  const cell: BlockoutCell = props.blockout[day]?.[hour] ?? "neutral";
  if (cell === "preferred") return "bg-success/20";
  if (cell === "blocked") return "bg-destructive/20";
  return "";
}

function cellStyle(day: DayOfWeek, hour: number, rowIndex: number): Record<string, string> {
  const base: Record<string, string> = {
    top: `${rowIndex * HOUR_HEIGHT}px`,
    height: `${HOUR_HEIGHT}px`,
    zIndex: "0",
    cursor: isHardBlocked(day, hour) ? "not-allowed" : "crosshair",
  };
  if (isHardBlocked(day, hour)) {
    base["backgroundImage"] = HARD_BLOCKED_BG_IMAGE;
    base["backgroundColor"] = "rgba(0,0,0,0.32)";
  }
  return base;
}

function fitBadgeClass(score: number): string {
  if (score >= 80) return "bg-tint-success text-tint-success-fg border border-tint-success-bd";
  if (score >= 60) return "bg-tint-caution text-tint-caution-fg border border-tint-caution-bd";
  return "bg-tint-danger text-tint-danger-fg border border-tint-danger-bd";
}

// ── Meeting block position helpers ───────────────────────────────────────────

function meetingTop(meeting: MeetingBlock): number {
  return ((timeToMinutes(meeting.startTime) - gridStartMinutes.value) / 60) * HOUR_HEIGHT;
}

function meetingHeight(meeting: MeetingBlock): number {
  const startMin = timeToMinutes(meeting.startTime);
  const endMin = timeToMinutes(meeting.endTime);
  return ((endMin - startMin) / 60) * HOUR_HEIGHT;
}

// ── Suppress unused import warning — ALL_DAYS imported for potential callers ──
void ALL_DAYS;
</script>

<template>
  <div class="rounded-xl bg-surface/60 border border-edge overflow-hidden">
    <!-- Toolbar -->
    <div
      class="flex items-center gap-3 px-4 py-2.5 border-b border-edge bg-surface/40 flex-wrap gap-y-2"
    >
      <!-- Paint mode buttons -->
      <div class="flex rounded-lg overflow-hidden border border-edge-subtle text-xs font-medium shrink-0">
        <button
          v-for="(mode, i) in PAINT_MODES"
          :key="mode.value"
          type="button"
          :class="[
            'px-3 py-1.5 transition-colors',
            i > 0 ? 'border-l border-edge-subtle' : '',
            paintMode === mode.value
              ? mode.value === 'preferred'
                ? 'bg-success text-success-fg'
                : mode.value === 'blocked'
                  ? 'bg-destructive text-destructive-fg'
                  : 'bg-fg-faint text-page'
              : 'bg-input/80 text-fg-muted hover:text-fg hover:bg-surface-hover/60',
          ]"
          @click="paintMode = mode.value"
        >
          {{ mode.label }}
        </button>
      </div>

      <button
        type="button"
        class="text-xs text-fg-faint hover:text-fg-muted transition-colors shrink-0"
        @click="emit('update:blockout', createEmptyBlockout())"
      >
        Clear
      </button>

      <div class="flex-1" />

      <!-- Blockout weight slider -->
      <div class="flex items-center gap-2 shrink-0">
        <span class="text-xs text-fg-faint hidden sm:block">Shape influence</span>
        <input
          type="range"
          min="0"
          max="100"
          step="5"
          :value="blockoutWeight"
          class="w-20 accent-primary"
          @input="emit('update:blockoutWeight', parseInt(($event.target as HTMLInputElement).value, 10))"
        />
        <span class="text-xs font-medium text-fg-muted tabular-nums w-8">{{ blockoutWeight }}%</span>
      </div>

      <!-- Fit score badge -->
      <div
        v-if="schedule"
        :class="[
          'shrink-0 flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold',
          fitBadgeClass(schedule.blockoutFitScore),
        ]"
      >
        <span>Shape match</span>
        <span>{{ schedule.blockoutFitScore }}%</span>
      </div>
    </div>

    <!-- Grid -->
    <div class="overflow-x-auto overflow-y-auto max-h-[calc(100vh-300px)]">
      <div
        class="flex min-w-[560px] select-none"
        @mouseup="handleMouseUp"
        @mouseleave="handleMouseUp"
      >
        <!-- Time labels column -->
        <div class="w-14 shrink-0">
          <div class="h-8" />
          <div class="relative" :style="{ height: `${totalHeight}px` }">
            <div
              v-for="(h, i) in hours"
              :key="h"
              class="absolute right-2 text-[10px] text-fg-faint leading-none"
              :style="{ top: `${i * HOUR_HEIGHT - 6}px` }"
            >
              {{ formatHour(h) }}
            </div>
          </div>
        </div>

        <!-- Day columns -->
        <div
          v-for="day in displayDays"
          :key="day"
          class="flex-1 min-w-[80px]"
        >
          <!-- Day header -->
          <div
            :class="[
              'h-8 flex flex-col items-center justify-center border-b border-edge-subtle',
              hardBlockedDays.has(day) || !WEEKDAYS.includes(day) ? 'opacity-40' : '',
            ]"
          >
            <span class="text-xs font-medium text-fg-muted">{{ day }}</span>
            <span v-if="hardBlockedDays.has(day)" class="text-[8px] text-destructive leading-none">
              day off
            </span>
          </div>

          <!-- Cell column -->
          <div
            class="relative border-l border-edge-subtle"
            :style="{ height: `${totalHeight}px` }"
          >
            <!-- Blockout cells -->
            <div
              v-for="(h, i) in hours"
              :key="`cell-${h}`"
              :class="['absolute w-full border-b border-edge-subtle', cellClass(day, h)]"
              :style="cellStyle(day, h, i)"
              @mousedown="handleMouseDown(day, h)"
              @mouseenter="handleMouseEnter(day, h)"
            />

            <!-- Ghost (alternative section) blocks -->
            <div
              v-for="({ course, meeting }, idx) in (dayGhosts.get(day) ?? [])"
              :key="`ghost-${course.crn}-${day}-${meeting.startTime}-${idx}`"
              class="absolute left-0.5 right-0.5 bg-surface-hover/25 border border-dashed border-edge-hover/50 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5"
              :style="{ top: `${meetingTop(meeting)}px`, height: `${meetingHeight(meeting)}px`, zIndex: 1, pointerEvents: 'none' }"
              :title="`Alternative: ${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`"
            >
              <span class="text-[10px] font-medium text-fg-muted truncate leading-tight italic">
                {{ course.identifier }}
              </span>
              <div
                v-if="meetingHeight(meeting) > 35"
                class="text-[9px] text-fg-faint truncate leading-tight"
              >
                {{ formatTime(meeting.startTime) }}&ndash;{{ formatTime(meeting.endTime) }}
              </div>
            </div>

            <!-- Active schedule meeting blocks -->
            <template v-if="schedule">
              <div
                v-for="({ course, meeting }) in (dayEvents.get(day) ?? [])"
                :key="`${course.crn}-${day}-${meeting.startTime}`"
                :class="[
                  'absolute left-0.5 right-0.5 border-l-[3px] rounded-r-md overflow-hidden flex flex-col justify-center px-1.5',
                  (() => {
                    const colorSlot = colorMap.get(course.identifier) ?? COURSE_COLORS[0];
                    if (!colorSlot) return '';
                    const mode = getThemeMode(resolvedTheme);
                    const color = mode === 'light' ? colorSlot.light : colorSlot.dark;
                    const isWarned = warningKeys.has(`${course.identifier}|${day}|${meeting.startTime}`) || warnedCourseIds.has(course.identifier);
                    return `${isWarned ? color.bgWarn : color.bg} ${isWarned ? color.borderWarn : color.border} ${color.text}`;
                  })(),
                ]"
                :style="{ top: `${meetingTop(meeting)}px`, height: `${meetingHeight(meeting)}px`, zIndex: 2, pointerEvents: 'none' }"
                :title="`${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`"
              >
                <div class="flex items-center gap-1">
                  <span
                    v-if="warningKeys.has(`${course.identifier}|${day}|${meeting.startTime}`) || warnedCourseIds.has(course.identifier)"
                    class="text-[10px] text-destructive shrink-0"
                  >&#x26A0;</span>
                  <span class="text-xs font-semibold truncate leading-tight">
                    {{ course.identifier }}
                  </span>
                </div>
                <div
                  v-if="meetingHeight(meeting) > 35"
                  class="text-[10px] text-fg-muted truncate leading-tight"
                >
                  {{ meeting.building }} {{ meeting.room }}
                </div>
                <div
                  v-if="meetingHeight(meeting) > 50"
                  class="text-[10px] text-fg-faint truncate leading-tight"
                >
                  {{ formatTime(meeting.startTime) }}&ndash;{{ formatTime(meeting.endTime) }}
                </div>
              </div>
            </template>
          </div>
        </div>
      </div>
    </div>

    <!-- Legend -->
    <div class="flex items-center gap-4 px-4 py-2 border-t border-edge-subtle text-[10px] text-fg-faint">
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-success/20 border border-success/40" />
        Preferred
      </span>
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/40" />
        Blocked
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="inline-block w-3 h-3 rounded-sm"
          :style="{
            backgroundImage: 'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.06) 3px, rgba(255,255,255,0.06) 6px)',
            backgroundColor: 'rgba(0,0,0,0.32)',
          }"
        />
        Outside time window / day off
      </span>
      <span v-if="ghosts.length > 0" class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-surface-hover/40 border border-dashed border-edge-hover/60" />
        Alternative section
      </span>
    </div>
  </div>
</template>
