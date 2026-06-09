<script setup lang="ts">
/**
 * Weekly time grid that absolutely-positions course meeting blocks within
 * day columns. The only interactive surface is the hover tooltip — all
 * selection and editing happens in sibling or parent components.
 */

import { computed, ref } from "vue";
import { getExpandedMeetings } from "../../domain/scheduler";
import { formatTime, timeToMinutes } from "../../domain/time";
import type { BlockoutGrid, DayOfWeek, Schedule } from "../../domain/types";
import { useThemeStore } from "@/features/theme/store";
import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  getThemeMode,
  HOUR_HEIGHT,
} from "./calendarColors";

const props = defineProps<{
  schedule: Schedule;
  /** Optional: show blockout shading behind the calendar */
  blockout?: BlockoutGrid;
}>();

const DISPLAY_DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const TOOLTIP_WIDTH = 240;
const TOOLTIP_HEIGHT = 170;
const ARROW_SIZE = 8;
const TOOLTIP_PADDING = 8;

interface HoveredEvent {
  course: Schedule["courses"][number];
  meeting: Schedule["courses"][number]["meetings"][number];
  blockTop: number;
  blockBottom: number;
  blockCenterX: number;
}

const hoveredEvent = ref<HoveredEvent | null>(null);
const containerRef = ref<HTMLDivElement | null>(null);

const themeStore = useThemeStore();
const themeMode = computed(() => getThemeMode(themeStore.resolved));

const expanded = computed(() => getExpandedMeetings(props.schedule));

const timeRange = computed(() => {
  let minTime = 2400;
  let maxTime = 0;
  for (const { meeting } of expanded.value) {
    if (meeting.startTime < minTime) minTime = meeting.startTime;
    if (meeting.endTime > maxTime) maxTime = meeting.endTime;
  }
  const startHour = expanded.value.length > 0 ? Math.floor(minTime / 100) : 8;
  const endHour = expanded.value.length > 0 ? Math.ceil(maxTime / 100) : 21;
  return { startHour, endHour };
});

const hours = computed(() => {
  const { startHour, endHour } = timeRange.value;
  return Array.from({ length: endHour - startHour }, (_, i) => startHour + i);
});

const gridStartMinutes = computed(() => timeRange.value.startHour * 60);
const totalHeight = computed(() => hours.value.length * HOUR_HEIGHT);

const colorMap = computed(() => {
  const courseIds = [...new Set(props.schedule.courses.map((c) => c.identifier))];
  return buildColorMap(courseIds);
});

const warningKeys = computed(() => buildWarningKeys(props.schedule.warnings));
const warnedCourseIds = computed(() => buildWarnedCourseIds(props.schedule.warnings));

const dayEvents = computed(() => {
  const map = new Map<DayOfWeek, typeof expanded.value>();
  for (const entry of expanded.value) {
    if (!DISPLAY_DAYS.includes(entry.day)) continue;
    const existing = map.get(entry.day) ?? [];
    existing.push(entry);
    map.set(entry.day, existing);
  }
  return map;
});

function getEventsForDay(day: DayOfWeek) {
  return dayEvents.value.get(day) ?? [];
}

function eventStyle(
  meeting: Schedule["courses"][number]["meetings"][number],
): Record<string, string> {
  const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes.value;
  const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes.value;
  const top = (startMin / 60) * HOUR_HEIGHT;
  const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
  return { top: `${top}px`, height: `${height}px` };
}

function eventHeight(meeting: Schedule["courses"][number]["meetings"][number]): number {
  const startMin = timeToMinutes(meeting.startTime) - gridStartMinutes.value;
  const endMin = timeToMinutes(meeting.endTime) - gridStartMinutes.value;
  return ((endMin - startMin) / 60) * HOUR_HEIGHT;
}

function getColor(
  identifier: string,
): NonNullable<ReturnType<typeof colorMap.value.get>> {
  return colorMap.value.get(identifier) ?? COURSE_COLORS[0]!;
}

function isEventWarned(
  identifier: string,
  day: DayOfWeek,
  startTime: number,
): boolean {
  const blockKey = `${identifier}|${day}|${startTime}`;
  return warningKeys.value.has(blockKey) || warnedCourseIds.value.has(identifier);
}

function blockoutCellClass(day: DayOfWeek, h: number): string | null {
  const cell = props.blockout?.[day]?.[h];
  if (!cell || cell === "neutral") return null;
  return cell === "preferred" ? "bg-success/8" : "bg-destructive/8";
}

function onMouseEnter(
  event: MouseEvent,
  course: Schedule["courses"][number],
  meeting: Schedule["courses"][number]["meetings"][number],
): void {
  if (!containerRef.value) return;
  const el = event.currentTarget as HTMLElement;
  const br = el.getBoundingClientRect();
  const cr = containerRef.value.getBoundingClientRect();
  const sl = containerRef.value.scrollLeft;
  hoveredEvent.value = {
    course,
    meeting,
    blockTop: br.top - cr.top + containerRef.value.scrollTop,
    blockBottom: br.bottom - cr.top + containerRef.value.scrollTop,
    blockCenterX: br.left - cr.left + sl + br.width / 2,
  };
}

function onMouseLeave(): void {
  hoveredEvent.value = null;
}

function onScroll(): void {
  hoveredEvent.value = null;
}

// Tooltip positioning
const tooltipStyle = computed<Record<string, string>>(() => {
  const ev = hoveredEvent.value;
  if (!ev) return {} as Record<string, string>;
  const showAbove = ev.blockTop >= TOOLTIP_HEIGHT + ARROW_SIZE + TOOLTIP_PADDING;
  const top = showAbove
    ? ev.blockTop - TOOLTIP_HEIGHT - ARROW_SIZE
    : ev.blockBottom + ARROW_SIZE;
  const containerWidth = containerRef.value?.scrollWidth ?? 800;
  const rawLeft = ev.blockCenterX - TOOLTIP_WIDTH / 2;
  const left = Math.max(
    TOOLTIP_PADDING,
    Math.min(rawLeft, containerWidth - TOOLTIP_WIDTH - TOOLTIP_PADDING),
  );
  return {
    top: `${top}px`,
    left: `${left}px`,
    width: `${TOOLTIP_WIDTH}px`,
  };
});

const tooltipArrowStyle = computed<Record<string, string | undefined>>(() => {
  const ev = hoveredEvent.value;
  if (!ev) return {};
  const showAbove = ev.blockTop >= TOOLTIP_HEIGHT + ARROW_SIZE + TOOLTIP_PADDING;
  const containerWidth = containerRef.value?.scrollWidth ?? 800;
  const rawLeft = ev.blockCenterX - TOOLTIP_WIDTH / 2;
  const clampedLeft = Math.max(
    TOOLTIP_PADDING,
    Math.min(rawLeft, containerWidth - TOOLTIP_WIDTH - TOOLTIP_PADDING),
  );
  const arrowLeft = ev.blockCenterX - clampedLeft - ARROW_SIZE;

  if (showAbove) {
    return {
      bottom: `-${ARROW_SIZE}px`,
      left: `${arrowLeft}px`,
      borderWidth: `${ARROW_SIZE}px ${ARROW_SIZE}px 0`,
      borderTopColor: "var(--color-edge)",
    };
  }
  return {
    top: `-${ARROW_SIZE}px`,
    left: `${arrowLeft}px`,
    borderWidth: `0 ${ARROW_SIZE}px ${ARROW_SIZE}px`,
    borderBottomColor: "var(--color-edge)",
  };
});

const seatsColor = computed(() => {
  const course = hoveredEvent.value?.course;
  if (!course) return "";
  return course.seatsAvailable > 0 ? "text-success" : "text-destructive";
});
</script>

<template>
  <div
    class="overflow-x-auto relative"
    ref="containerRef"
    @scroll="onScroll"
  >
    <div class="flex min-w-[640px]">
      <!-- Time labels column -->
      <div class="w-16 shrink-0">
        <div class="h-8" />
        <div class="relative" :style="{ height: `${totalHeight}px` }">
          <div
            v-for="(h, i) in hours"
            :key="h"
            class="absolute right-1 text-xs text-fg-faint"
            :style="{ top: `${i * HOUR_HEIGHT}px` }"
          >
            {{ formatTime(h * 100) }}
          </div>
        </div>
      </div>

      <!-- Day columns -->
      <div
        v-for="day in DISPLAY_DAYS"
        :key="day"
        class="flex-1 min-w-[100px]"
      >
        <div
          class="h-8 flex items-center justify-center text-sm font-medium text-fg-muted border-b border-edge"
        >
          {{ day }}
        </div>
        <div
          class="relative border-l border-edge-subtle"
          :style="{ height: `${totalHeight}px` }"
        >
          <!-- Blockout shading -->
          <template v-if="blockout">
            <template v-for="(h, i) in hours" :key="`bo-${h}`">
              <div
                v-if="blockoutCellClass(day, h)"
                class="absolute w-full"
                :class="blockoutCellClass(day, h)!"
                :style="{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }"
              />
            </template>
          </template>

          <!-- Hour grid lines -->
          <div
            v-for="(_, i) in hours"
            :key="`line-${i}`"
            class="absolute w-full border-b border-edge-subtle"
            :style="{ top: `${i * HOUR_HEIGHT}px`, height: `${HOUR_HEIGHT}px` }"
          />

          <!-- Events -->
          <template v-for="{ course, meeting } in getEventsForDay(day)" :key="`${course.identifier}-${day}-${meeting.startTime}`">
            <div
              class="absolute left-0.5 right-0.5 border-l-3 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5 cursor-default transition-colors"
              :class="[
                isEventWarned(course.identifier, day, meeting.startTime)
                  ? getColor(course.identifier)[themeMode].bgWarn
                  : getColor(course.identifier)[themeMode].bg,
                isEventWarned(course.identifier, day, meeting.startTime)
                  ? getColor(course.identifier)[themeMode].borderWarn
                  : getColor(course.identifier)[themeMode].border,
              ]"
              :style="eventStyle(meeting)"
              @mouseenter="(e) => onMouseEnter(e, course, meeting)"
              @mouseleave="onMouseLeave"
            >
              <div class="flex items-center gap-1">
                <span
                  v-if="isEventWarned(course.identifier, day, meeting.startTime)"
                  class="text-[10px] text-destructive shrink-0"
                  title="This class has a scheduling issue"
                >&#x26A0;</span>
                <span
                  class="text-xs font-semibold truncate leading-tight"
                  :class="getColor(course.identifier)[themeMode].text"
                >
                  {{ course.identifier }}
                </span>
              </div>
              <div
                v-if="eventHeight(meeting) > 35"
                class="text-[10px] text-fg-muted truncate leading-tight"
              >
                {{ meeting.building }} {{ meeting.room }}
              </div>
              <div
                v-if="eventHeight(meeting) > 50"
                class="text-[10px] text-fg-faint truncate leading-tight"
              >
                {{ formatTime(meeting.startTime) }}-{{ formatTime(meeting.endTime) }}
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>

    <!-- Hover tooltip -->
    <div
      v-if="hoveredEvent"
      class="absolute z-50 pointer-events-none rounded-lg border border-edge bg-surface/95 shadow-xl backdrop-blur-sm p-2.5"
      :style="tooltipStyle"
    >
      <!-- Arrow -->
      <div
        class="absolute border-transparent"
        :style="tooltipArrowStyle"
      />
      <!-- Header -->
      <div class="flex items-start justify-between gap-2">
        <span class="font-mono font-semibold text-sm text-fg leading-tight">
          {{ hoveredEvent.course.identifier }}
        </span>
        <span class="text-[10px] text-fg-faint font-mono shrink-0 mt-0.5">
          CRN {{ hoveredEvent.course.crn }}
        </span>
      </div>
      <div class="text-xs text-fg-muted mt-0.5 leading-snug">
        {{ hoveredEvent.course.title }}
      </div>

      <div class="border-t border-edge-subtle my-1.5" />

      <!-- Time -->
      <div class="flex items-center gap-1.5 text-xs text-fg">
        <span class="text-fg-faint text-[10px]">&#x23F1;</span>
        {{ formatTime(hoveredEvent.meeting.startTime) }} &ndash; {{ formatTime(hoveredEvent.meeting.endTime) }}
      </div>
      <!-- Location -->
      <div class="flex items-center gap-1.5 text-xs text-fg mt-0.5">
        <span class="text-fg-faint text-[10px]">&#x1F4CD;</span>
        <span v-if="hoveredEvent.meeting.isOnline">Online</span>
        <span v-else>{{ hoveredEvent.meeting.building }} {{ hoveredEvent.meeting.room }}</span>
      </div>
      <!-- Instructor -->
      <div class="text-xs text-fg-muted mt-0.5 truncate">
        {{ hoveredEvent.course.instructor }}
      </div>

      <div class="border-t border-edge-subtle my-1.5" />

      <!-- Bottom metadata -->
      <div class="grid grid-cols-3 gap-x-2">
        <div>
          <div class="text-[9px] text-fg-faint uppercase tracking-wide">Method</div>
          <div class="text-xs text-fg font-medium truncate">
            {{ hoveredEvent.course.instructionalMethod }}
          </div>
        </div>
        <div>
          <div class="text-[9px] text-fg-faint uppercase tracking-wide">Seats</div>
          <div class="text-xs font-medium" :class="seatsColor">
            {{ hoveredEvent.course.seatsAvailable }}/{{ hoveredEvent.course.maximumEnrollment }}
          </div>
        </div>
        <div>
          <div class="text-[9px] text-fg-faint uppercase tracking-wide">Credits</div>
          <div class="text-xs text-fg font-medium">
            {{ hoveredEvent.course.creditHours ?? '&mdash;' }}
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
