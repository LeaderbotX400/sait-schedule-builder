<script setup lang="ts">
/**
 * Paintable week-grid for setting blockout preferences (preferred / blocked /
 * neutral cells). Overlay the active schedule's meetings for context and
 * show ghost blocks for alternative sections not in the current schedule.
 * Bind via v-model:blockout and v-model:blockout-weight.
 */

import {
  buildColorMap,
  buildWarnedCourseIds,
  buildWarningKeys,
  COURSE_COLORS,
  HOUR_HEIGHT,
} from "@/features/schedules/calendarColors";
import { usePinnedSectionsStore } from "@/features/schedules/pinnedSections";
import { getThemeMode, useThemeStore } from "@/features/theme/store";
import Popover from "@/ui/Popover.vue";
import { Icon } from "@iconify/vue";
import { storeToRefs } from "pinia";
import { computed, ref } from "vue";
import { createEmptyBlockout } from "../../domain/blockout";
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
import { ALL_DAYS, GRID_HOURS, WEEKDAYS } from "../../domain/types";

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

// ── Horizontal zoom (widens day columns so narrow tiles become readable) ────

const ZOOM_OPTIONS: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
const ZOOM_MIN = 1;
const ZOOM_MAX = 10;
const zoom = ref<number>(1);

function zoomOut(): void {
  const idx = ZOOM_OPTIONS.indexOf(zoom.value);
  const next = idx > 0 ? ZOOM_OPTIONS[idx - 1] : ZOOM_MIN;
  if (next !== undefined) zoom.value = next;
}

function zoomIn(): void {
  const idx = ZOOM_OPTIONS.indexOf(zoom.value);
  const next = idx >= 0 && idx < ZOOM_OPTIONS.length - 1 ? ZOOM_OPTIONS[idx + 1] : ZOOM_MAX;
  if (next !== undefined) zoom.value = next;
}

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
  const allowedPrefixes = props.rules.sectionPrefixes
    .split(",")
    .map((s) => s.trim().toUpperCase())
    .filter((s) => s.length > 0);
  const out: ExpandedMeeting[] = [];
  for (const subjectCourse of props.selectedCourses) {
    const sections = props.courseGroups.get(subjectCourse) ?? [];
    for (const section of sections) {
      if (activeCrns.has(section.crn)) continue;
      if (allowedPrefixes.length > 0) {
        const seq = section.sequenceNumber.toUpperCase();
        if (seq.length > 1 && !allowedPrefixes.some((p) => seq.startsWith(p))) continue;
      }
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

/**
 * Locked ghost meetings rendered at their TRUE meeting time as full-height
 * blocks — not tiled. Only appears when a locked section isn't in the active
 * schedule (e.g. schedule generation failed to fit it); a locked section that
 * IS in the active schedule renders via dayEvents.
 */
const dayLockedGhosts = computed(() => {
  const m = new Map<DayOfWeek, ExpandedMeeting[]>();
  for (const day of displayDays.value) {
    m.set(
      day,
      (dayGhosts.value.get(day) ?? []).filter((e) => isSectionPinned(e.course)),
    );
  }
  return m;
});

/** First 3 overlapping ghosts each get their own column; the 4th column is
 * always the overflow popover when N>=5. So 4 visible columns total at most. */
const MAX_VISIBLE_TILES = 3;
const MAX_TILE_COLUMNS = 4;

interface SingleTile {
  kind: "single";
  meeting: ExpandedMeeting;
  column: number;
  totalColumns: number;
}

interface OverflowTile {
  kind: "overflow";
  members: ExpandedMeeting[];
  startTime: number;
  endTime: number;
  column: number;
  totalColumns: number;
  day: DayOfWeek;
}

type GhostTile = SingleTile | OverflowTile;

/**
 * Horizontal-tile layout for unlocked ghost meetings (Google Calendar style).
 * Sort by start time, walk through them; if the next meeting starts before
 * the current overlap group ends, it joins the group and gets the next column.
 * Singletons keep full width. At N>=5 the 4th column collapses into a popover.
 */
const dayGhostTiles = computed(() => {
  const result = new Map<DayOfWeek, GhostTile[]>();
  for (const day of displayDays.value) {
    const meetings = (dayGhosts.value.get(day) ?? [])
      .filter((e) => !isSectionPinned(e.course))
      .slice()
      .sort(
        (a, b) =>
          a.meeting.startTime - b.meeting.startTime || b.meeting.endTime - a.meeting.endTime,
      );

    // Group into overlap components (transitive: A∩B, B∩C ⇒ all one group).
    const groups: ExpandedMeeting[][] = [];
    let groupEnd = -1;
    for (const entry of meetings) {
      if (groups.length === 0 || entry.meeting.startTime >= groupEnd) {
        groups.push([entry]);
        groupEnd = entry.meeting.endTime;
      } else {
        groups[groups.length - 1]!.push(entry);
        if (entry.meeting.endTime > groupEnd) groupEnd = entry.meeting.endTime;
      }
    }

    const tiles: GhostTile[] = [];
    for (const group of groups) {
      const n = group.length;
      if (n <= MAX_TILE_COLUMNS) {
        for (let i = 0; i < n; i++) {
          tiles.push({ kind: "single", meeting: group[i]!, column: i, totalColumns: n });
        }
      } else {
        for (let i = 0; i < MAX_VISIBLE_TILES; i++) {
          tiles.push({
            kind: "single",
            meeting: group[i]!,
            column: i,
            totalColumns: MAX_TILE_COLUMNS,
          });
        }
        const overflow = group.slice(MAX_VISIBLE_TILES);
        let start = overflow[0]!.meeting.startTime;
        let end = overflow[0]!.meeting.endTime;
        for (const m of overflow) {
          if (m.meeting.startTime < start) start = m.meeting.startTime;
          if (m.meeting.endTime > end) end = m.meeting.endTime;
        }
        tiles.push({
          kind: "overflow",
          members: overflow,
          startTime: start,
          endTime: end,
          column: MAX_VISIBLE_TILES,
          totalColumns: MAX_TILE_COLUMNS,
          day,
        });
      }
    }
    result.set(day, tiles);
  }
  return result;
});

/** Position helpers for an interval [startTime, endTime] (HHMM). */
function rangeTop(startTime: number): number {
  return ((timeToMinutes(startTime) - gridStartMinutes.value) / 60) * HOUR_HEIGHT;
}

function rangeHeight(startTime: number, endTime: number): number {
  return ((timeToMinutes(endTime) - timeToMinutes(startTime)) / 60) * HOUR_HEIGHT;
}

function tileLeftPct(tile: GhostTile): string {
  return `${(tile.column / tile.totalColumns) * 100}%`;
}

function tileWidthPct(tile: GhostTile): string {
  return `${(1 / tile.totalColumns) * 100}%`;
}

/** Anchor popover to the right edge for late-week columns so it grows leftward
 * and doesn't clip against the viewport. */
function popoverAlignForDay(day: DayOfWeek): "left" | "right" {
  const idx = displayDays.value.indexOf(day);
  const half = Math.floor(displayDays.value.length / 2);
  return idx > half ? "right" : "left";
}

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

// ── Pinned sections ──────────────────────────────────────────────────────────

const pinnedStore = usePinnedSectionsStore();

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
</script>

<template>
  <div class="rounded-xl bg-surface/60 border border-edge overflow-hidden">
    <!-- Toolbar -->
    <div
      class="flex items-center gap-3 px-4 py-2.5 border-b border-edge bg-surface/40 flex-wrap gap-y-2"
    >
      <!-- Paint mode buttons -->
      <div
        class="flex rounded-lg overflow-hidden border border-edge-subtle text-xs font-medium shrink-0"
      >
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

      <!-- Horizontal zoom -->
      <div
        class="flex items-center rounded-lg border border-edge-subtle overflow-hidden shrink-0"
        role="group"
        aria-label="Horizontal zoom"
      >
        <button
          type="button"
          class="px-2 py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover/60 disabled:opacity-30 transition-colors"
          :disabled="zoom <= ZOOM_MIN"
          aria-label="Zoom out"
          title="Zoom out"
          @click="zoomOut"
        >
          <Icon icon="mdi:magnify-minus-outline" aria-hidden="true" />
        </button>
        <span
          class="px-2 text-[11px] font-medium text-fg-muted tabular-nums border-x border-edge-subtle"
          aria-live="polite"
          :aria-label="`Zoom level ${zoom} times`"
          >{{ zoom }}&times;</span
        >
        <button
          type="button"
          class="px-2 py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-surface-hover/60 disabled:opacity-30 transition-colors"
          :disabled="zoom >= ZOOM_MAX"
          aria-label="Zoom in"
          title="Zoom in"
          @click="zoomIn"
        >
          <Icon icon="mdi:magnify-plus-outline" aria-hidden="true" />
        </button>
      </div>

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
          @input="
            emit('update:blockoutWeight', parseInt(($event.target as HTMLInputElement).value, 10))
          "
        />
        <span class="text-xs font-medium text-fg-muted tabular-nums w-8"
          >{{ blockoutWeight }}%</span
        >
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
        class="flex select-none"
        :style="{ minWidth: `${560 * zoom}px` }"
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
        <div v-for="day in displayDays" :key="day" class="flex-1 min-w-[80px]">
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
          <div class="relative border-l border-edge-subtle" :style="{ height: `${totalHeight}px` }">
            <!-- Blockout cells -->
            <div
              v-for="(h, i) in hours"
              :key="`cell-${h}`"
              :class="['absolute w-full border-b border-edge-subtle', cellClass(day, h)]"
              :style="cellStyle(day, h, i)"
              @mousedown="handleMouseDown(day, h)"
              @mouseenter="handleMouseEnter(day, h)"
            />

            <!-- Locked ghosts — render at full meeting time, always visible -->
            <button
              v-for="({ course, meeting }, idx) in dayLockedGhosts.get(day) ?? []"
              :key="`locked-${course.crn}-${day}-${meeting.startTime}-${idx}`"
              type="button"
              class="absolute left-0.5 right-0.5 rounded-r-md overflow-hidden flex flex-col justify-center px-1.5 cursor-pointer transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-tint-danger/60 border-l-[3px] border-l-destructive border border-tint-danger-bd hover:bg-tint-danger/80"
              :style="{
                top: `${meetingTop(meeting)}px`,
                height: `${meetingHeight(meeting)}px`,
                zIndex: 2,
              }"
              :title="`Locked: ${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}\nClick to unlock`"
              :aria-label="`Unlock ${course.identifier}`"
              :aria-pressed="true"
              @mousedown.stop
              @click.stop="togglePin(course)"
            >
              <div class="flex items-center gap-1 min-w-0">
                <Icon
                  icon="mdi:lock"
                  class="w-3 h-3 shrink-0 text-destructive"
                  aria-hidden="true"
                />
                <span class="text-xs font-semibold truncate leading-tight text-tint-danger-fg">
                  {{ course.identifier }}
                </span>
              </div>
              <div
                v-if="meetingHeight(meeting) > 35"
                class="text-[10px] text-tint-danger-fg/80 truncate leading-tight"
              >
                {{ meeting.building }} {{ meeting.room }}
              </div>
              <div
                v-if="meetingHeight(meeting) > 50"
                class="text-[10px] text-tint-danger-fg/70 truncate leading-tight"
              >
                {{ formatTime(meeting.startTime) }}&ndash;{{ formatTime(meeting.endTime) }}
              </div>
            </button>

            <!-- Ghost tiles (alternative sections) — tile horizontally; overflow popover at 5+ -->
            <template v-for="(tile, idx) in dayGhostTiles.get(day) ?? []">
              <!-- Single section tile -->
              <button
                v-if="tile.kind === 'single'"
                :key="`gtile-${tile.meeting.course.crn}-${day}-${tile.meeting.meeting.startTime}-${idx}`"
                type="button"
                class="absolute rounded-r-md overflow-hidden flex flex-col justify-center px-1 cursor-pointer transition-colors text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-surface-hover/25 border border-dashed border-edge-hover/50 hover:bg-tint-success/30 hover:border-tint-success-bd"
                :style="{
                  top: `${rangeTop(tile.meeting.meeting.startTime)}px`,
                  height: `${rangeHeight(tile.meeting.meeting.startTime, tile.meeting.meeting.endTime)}px`,
                  left: `calc(${tileLeftPct(tile)} + 2px)`,
                  width: `calc(${tileWidthPct(tile)} - 4px)`,
                  zIndex: 1,
                }"
                :title="`Alternative: ${tile.meeting.course.identifier} - ${tile.meeting.course.title}\n${tile.meeting.course.instructor}\n${tile.meeting.meeting.building} ${tile.meeting.meeting.room}\n${formatTime(tile.meeting.meeting.startTime)} - ${formatTime(tile.meeting.meeting.endTime)}\nClick to lock`"
                :aria-label="`Lock ${tile.meeting.course.identifier} from ${formatTime(tile.meeting.meeting.startTime)} to ${formatTime(tile.meeting.meeting.endTime)}`"
                :aria-pressed="false"
                @mousedown.stop
                @click.stop="togglePin(tile.meeting.course)"
              >
                <div class="flex items-center gap-0.5 min-w-0">
                  <Icon
                    icon="mdi:lock-open-variant"
                    class="w-3 h-3 shrink-0 text-success"
                    aria-hidden="true"
                  />
                  <span class="text-[10px] font-medium leading-tight text-fg-muted italic truncate min-w-0">
                    {{ tile.meeting.course.identifier }}
                  </span>
                </div>
                <div
                  v-if="
                    rangeHeight(tile.meeting.meeting.startTime, tile.meeting.meeting.endTime) >
                      35 && tile.totalColumns <= 2
                  "
                  class="text-[9px] leading-tight text-fg-faint"
                >
                  {{ formatTime(tile.meeting.meeting.startTime) }}&ndash;{{
                    formatTime(tile.meeting.meeting.endTime)
                  }}
                </div>
              </button>

              <!-- Overflow tile: popover lists members 4..N -->
              <div
                v-else
                :key="`gtile-overflow-${day}-${tile.startTime}-${idx}`"
                class="absolute"
                :style="{
                  top: `${rangeTop(tile.startTime)}px`,
                  height: `${rangeHeight(tile.startTime, tile.endTime)}px`,
                  left: `calc(${tileLeftPct(tile)} + 2px)`,
                  width: `calc(${tileWidthPct(tile)} - 4px)`,
                  zIndex: 1,
                }"
              >
                <Popover :align="popoverAlignForDay(tile.day)" widthClass="w-72">
                  <template #trigger="{ toggle, expanded }">
                    <button
                      type="button"
                      class="w-full h-full rounded-r-md overflow-hidden flex items-center justify-center cursor-pointer transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-surface-hover/40 border border-dashed border-edge-hover/60 hover:bg-tint-success/20 hover:border-tint-success-bd"
                      :title="`${tile.members.length} more alternatives at this time — click to view`"
                      :aria-label="`${tile.members.length} more alternative sections`"
                      :aria-haspopup="true"
                      :aria-expanded="expanded"
                      @mousedown.stop
                      @click.stop="toggle"
                    >
                      <span class="text-[11px] font-bold text-fg-muted tabular-nums leading-none">
                        +{{ tile.members.length }}
                      </span>
                    </button>
                  </template>

                  <!-- Popover body: list overflowed members -->
                  <div class="space-y-1.5">
                    <div
                      class="flex items-baseline justify-between border-b border-edge pb-1.5 mb-1"
                    >
                      <span class="text-xs font-semibold text-fg">
                        {{ tile.members.length }} more sections
                      </span>
                      <span class="text-[10px] text-fg-faint tabular-nums">{{ day }}</span>
                    </div>
                    <button
                      v-for="m in tile.members"
                      :key="`${m.course.crn}-${m.meeting.startTime}`"
                      type="button"
                      class="w-full flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring bg-input/50 hover:bg-tint-success/20"
                      :aria-label="`Lock ${m.course.identifier}`"
                      @click="togglePin(m.course)"
                    >
                      <Icon
                        icon="mdi:lock-open-variant"
                        class="shrink-0 text-success"
                        aria-hidden="true"
                      />
                      <div class="min-w-0 flex-1">
                        <div class="flex items-baseline gap-1.5">
                          <span class="font-mono text-xs font-semibold text-fg truncate">
                            {{ m.course.identifier }}
                          </span>
                          <span class="text-[10px] text-fg-faint tabular-nums shrink-0">
                            {{ formatTime(m.meeting.startTime) }}&ndash;{{
                              formatTime(m.meeting.endTime)
                            }}
                          </span>
                        </div>
                        <div class="text-[10px] text-fg-muted truncate">
                          {{ m.course.instructor || "TBA" }}
                          <span v-if="m.meeting.building" class="text-fg-faint">
                            &middot; {{ m.meeting.building }} {{ m.meeting.room }}
                          </span>
                        </div>
                      </div>
                    </button>
                  </div>
                </Popover>
              </div>
            </template>

            <!-- Active schedule meeting blocks -->
            <template v-if="schedule">
              <div
                v-for="{ course, meeting } in dayEvents.get(day) ?? []"
                :key="`${course.crn}-${day}-${meeting.startTime}`"
                :class="[
                  'absolute left-0.5 right-0.5 border-l-[3px] rounded-r-md overflow-hidden flex flex-col justify-center px-1.5',
                  (() => {
                    const colorSlot = colorMap.get(course.identifier) ?? COURSE_COLORS[0];
                    if (!colorSlot) return '';
                    const mode = getThemeMode(resolvedTheme);
                    const color = mode === 'light' ? colorSlot.light : colorSlot.dark;
                    const isWarned =
                      warningKeys.has(`${course.identifier}|${day}|${meeting.startTime}`) ||
                      warnedCourseIds.has(course.identifier);
                    return `${isWarned ? color.bgWarn : color.bg} ${isWarned ? color.borderWarn : color.border} ${color.text}`;
                  })(),
                ]"
                :style="{
                  top: `${meetingTop(meeting)}px`,
                  height: `${meetingHeight(meeting)}px`,
                  zIndex: 2,
                  pointerEvents: 'none',
                }"
                :title="`${course.identifier} - ${course.title}\n${course.instructor}\n${meeting.building} ${meeting.room}\n${formatTime(meeting.startTime)} - ${formatTime(meeting.endTime)}`"
              >
                <div class="flex items-center gap-1">
                  <Icon
                    v-if="
                      warningKeys.has(`${course.identifier}|${day}|${meeting.startTime}`) ||
                      warnedCourseIds.has(course.identifier)
                    "
                    icon="mdi:alert"
                    class="text-[10px] text-destructive shrink-0"
                    role="img"
                    aria-label="Scheduling conflict"
                  />
                  <Icon
                    v-if="isSectionPinned(course)"
                    icon="mdi:lock"
                    class="text-[10px] shrink-0 text-destructive"
                    role="img"
                    aria-label="Locked"
                  />
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
    <div
      class="flex items-center gap-4 px-4 py-2 border-t border-edge-subtle text-[10px] text-fg-faint"
    >
      <span class="flex items-center gap-1.5">
        <span class="inline-block w-3 h-3 rounded-sm bg-success/20 border border-success/40" />
        Preferred
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="inline-block w-3 h-3 rounded-sm bg-destructive/20 border border-destructive/40"
        />
        Blocked
      </span>
      <span class="flex items-center gap-1.5">
        <span
          class="inline-block w-3 h-3 rounded-sm"
          :style="{
            backgroundImage:
              'repeating-linear-gradient(135deg, transparent, transparent 3px, rgba(255,255,255,0.06) 3px, rgba(255,255,255,0.06) 6px)',
            backgroundColor: 'rgba(0,0,0,0.32)',
          }"
        />
        Outside time window / day off
      </span>
      <span v-if="ghosts.length > 0" class="flex items-center gap-1.5">
        <Icon icon="mdi:lock-open-variant" class="text-success" aria-hidden="true" />
        Alternative (click to lock)
      </span>
      <span v-if="pinnedStore.pinnedSections.size > 0" class="flex items-center gap-1.5">
        <Icon icon="mdi:lock" class="text-destructive" aria-hidden="true" />
        Locked
      </span>
    </div>
  </div>
</template>
