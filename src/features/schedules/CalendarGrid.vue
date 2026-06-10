<script setup lang="ts">
/**
 * Weekly schedule calendar. Layout chrome and positioning math come from
 * the shared WeekGrid; this component renders the course blocks and a
 * hover card per block (Reka HoverCard — portal + positioning for free).
 */

import { useThemeStore } from "@/features/theme/store";
import WeekGrid from "@/ui/week-grid/WeekGrid.vue";
import { useWeekGridLayout, type WeekGridEvent } from "@/ui/week-grid/useWeekGridLayout";
import { Icon } from "@iconify/vue";
import { HoverCardContent, HoverCardPortal, HoverCardRoot, HoverCardTrigger } from "reka-ui";
import { computed } from "vue";
import { getExpandedMeetings } from "@/domain/scheduler";
import { formatTime } from "@/domain/time";
import type { BlockoutGrid, CourseSection, DayOfWeek, MeetingBlock, Schedule } from "@/domain/types";
import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  getThemeMode,
} from "./calendarColors";

const props = defineProps<{
  schedule: Schedule;
  /** Optional: show blockout shading behind the calendar */
  blockout?: BlockoutGrid;
}>();

interface EventMeta {
  course: CourseSection;
  meeting: MeetingBlock;
}

const events = computed<WeekGridEvent<EventMeta>[]>(() =>
  getExpandedMeetings(props.schedule).map(({ course, meeting, day }) => ({
    id: `${course.identifier}-${day}-${meeting.startTime}`,
    day,
    startTime: meeting.startTime,
    endTime: meeting.endTime,
    meta: { course, meeting },
  })),
);

const layout = useWeekGridLayout<EventMeta>({ events, weekendMode: "never" });

const themeStore = useThemeStore();
const themeMode = computed(() => getThemeMode(themeStore.resolved));

const colorMap = computed(() => {
  const courseIds = [...new Set(props.schedule.courses.map((c) => c.identifier))];
  return buildColorMap(courseIds);
});

const warningKeys = computed(() => buildWarningKeys(props.schedule.warnings));
const warnedCourseIds = computed(() => buildWarnedCourseIds(props.schedule.warnings));

function getColor(identifier: string) {
  return (colorMap.value.get(identifier) ?? COURSE_COLORS[0]!)[themeMode.value];
}

function isWarned(identifier: string, day: DayOfWeek, startTime: number): boolean {
  return (
    warningKeys.value.has(`${identifier}|${day}|${startTime}`) ||
    warnedCourseIds.value.has(identifier)
  );
}

function blockoutCellClass(day: DayOfWeek, h: number): string | null {
  const cell = props.blockout?.[day]?.[h];
  if (!cell || cell === "neutral") return null;
  return cell === "preferred" ? "bg-success/8" : "bg-destructive/8";
}

function seatsColor(course: CourseSection): string {
  return course.seatsAvailable > 0 ? "text-success" : "text-destructive";
}
</script>

<template>
  <div class="overflow-x-auto relative">
    <WeekGrid :layout="layout" :min-day-width-rem="6.25">
      <template #cell="{ day, hour, topRem }">
        <div
          v-if="blockoutCellClass(day, hour)"
          class="absolute w-full"
          :class="blockoutCellClass(day, hour)!"
          :style="{ top: `${topRem}rem`, height: `${layout.hourHeightRem}rem` }"
        />
      </template>

      <template #day="{ day }">
        <HoverCardRoot
          v-for="ev in layout.eventsByDay.value.get(day) ?? []"
          :key="ev.id"
          :open-delay="150"
          :close-delay="0"
        >
          <HoverCardTrigger as-child>
            <div
              class="absolute left-0.5 right-0.5 border-l-3 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5 cursor-default transition-colors"
              :class="[
                isWarned(ev.meta.course.identifier, day, ev.startTime)
                  ? `${getColor(ev.meta.course.identifier).bgWarn} ${getColor(ev.meta.course.identifier).borderWarn}`
                  : `${getColor(ev.meta.course.identifier).bg} ${getColor(ev.meta.course.identifier).border}`,
              ]"
              :style="layout.blockStyle(ev)"
            >
              <div class="flex items-center gap-1">
                <Icon
                  v-if="isWarned(ev.meta.course.identifier, day, ev.startTime)"
                  icon="mdi:alert"
                  class="text-[0.625rem] text-destructive shrink-0"
                  role="img"
                  aria-label="Scheduling conflict"
                />
                <span
                  class="text-xs font-semibold truncate leading-tight"
                  :class="getColor(ev.meta.course.identifier).text"
                >
                  {{ ev.meta.course.identifier }}
                </span>
              </div>
              <div
                v-if="layout.heightRem(ev.startTime, ev.endTime) > 2.1875"
                class="text-[0.625rem] text-fg-muted truncate leading-tight"
              >
                {{ ev.meta.meeting.building }} {{ ev.meta.meeting.room }}
              </div>
              <div
                v-if="layout.heightRem(ev.startTime, ev.endTime) > 3.125"
                class="text-[0.625rem] text-fg-faint truncate leading-tight"
              >
                {{ formatTime(ev.startTime) }}-{{ formatTime(ev.endTime) }}
              </div>
            </div>
          </HoverCardTrigger>
          <HoverCardPortal>
            <HoverCardContent
              :side-offset="6"
              :collision-padding="8"
              class="z-40 w-60 pointer-events-none rounded-lg border border-edge bg-surface/95 shadow-xl backdrop-blur-sm p-2.5"
            >
              <div class="flex items-start justify-between gap-2">
                <span class="font-mono font-semibold text-sm text-fg leading-tight">
                  {{ ev.meta.course.identifier }}
                </span>
                <span class="text-[0.625rem] text-fg-faint font-mono shrink-0 mt-0.5">
                  CRN {{ ev.meta.course.crn }}
                </span>
              </div>
              <div class="text-xs text-fg-muted mt-0.5 leading-snug">
                {{ ev.meta.course.title }}
              </div>

              <div class="border-t border-edge-subtle my-1.5" />

              <div class="flex items-center gap-1.5 text-xs text-fg">
                <Icon icon="mdi:clock-outline" class="text-fg-faint" aria-hidden="true" />
                {{ formatTime(ev.startTime) }} &ndash; {{ formatTime(ev.endTime) }}
              </div>
              <div class="flex items-center gap-1.5 text-xs text-fg mt-0.5">
                <Icon icon="mdi:map-marker" class="text-fg-faint" aria-hidden="true" />
                <span v-if="ev.meta.meeting.isOnline">Online</span>
                <span v-else>{{ ev.meta.meeting.building }} {{ ev.meta.meeting.room }}</span>
              </div>
              <div class="text-xs text-fg-muted mt-0.5 truncate">
                {{ ev.meta.course.instructor }}
              </div>

              <div class="border-t border-edge-subtle my-1.5" />

              <div class="grid grid-cols-3 gap-x-2">
                <div>
                  <div class="text-[0.5625rem] text-fg-faint uppercase tracking-wide">Method</div>
                  <div class="text-xs text-fg font-medium truncate">
                    {{ ev.meta.course.instructionalMethod }}
                  </div>
                </div>
                <div>
                  <div class="text-[0.5625rem] text-fg-faint uppercase tracking-wide">Seats</div>
                  <div class="text-xs font-medium" :class="seatsColor(ev.meta.course)">
                    {{ ev.meta.course.seatsAvailable }}/{{ ev.meta.course.maximumEnrollment }}
                  </div>
                </div>
                <div>
                  <div class="text-[0.5625rem] text-fg-faint uppercase tracking-wide">Credits</div>
                  <div class="text-xs text-fg font-medium">
                    {{ ev.meta.course.creditHours ?? "&mdash;" }}
                  </div>
                </div>
              </div>
            </HoverCardContent>
          </HoverCardPortal>
        </HoverCardRoot>
      </template>
    </WeekGrid>
  </div>
</template>
