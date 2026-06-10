<script setup lang="ts" generic="M">
/**
 * Week-grid chrome: scroll container, hour-label column, day headers,
 * day columns with hour gridlines. All layout math comes from the
 * `WeekGridLayout` the consumer builds with `useWeekGridLayout` — the
 * consumer renders its own positioned content through the slots:
 *
 *   #day-header="{ day }"                   custom day-header content
 *   #cell="{ day, hour, index, topRem }"    per day×hour cell overlay
 *   #day="{ day }"                          positioned blocks (events, ghosts)
 */

import { formatTime } from "@/domain/time";
import type { DayOfWeek } from "@/domain/types";
import type { WeekGridLayout } from "./useWeekGridLayout";

withDefaults(
  defineProps<{
    layout: WeekGridLayout<M>;
    /** Minimum width of one day column, in rem (drives horizontal zoom). */
    minDayWidthRem?: number;
    /** Hour-axis label formatter; defaults to "8:00 AM". */
    hourLabel?: (hour: number) => string;
    /** Extra classes on each day-header cell. */
    headerClass?: string | ((day: DayOfWeek) => string);
  }>(),
  {
    minDayWidthRem: 6.25,
    hourLabel: (hour: number) => formatTime(hour * 100),
    headerClass: "",
  },
);

defineSlots<{
  "day-header"?(props: { day: DayOfWeek }): unknown;
  cell?(props: { day: DayOfWeek; hour: number; index: number; topRem: number }): unknown;
  day?(props: { day: DayOfWeek }): unknown;
}>();
</script>

<template>
  <div class="flex" :style="{ minWidth: `${4 + layout.days.value.length * minDayWidthRem}rem` }">
    <!-- Hour labels column -->
    <div class="min-w-14 shrink-0">
      <div class="min-h-8" />
      <div class="relative" :style="{ height: `${layout.totalHeightRem.value}rem` }">
        <div
          v-for="(h, i) in layout.hours.value"
          :key="h"
          class="absolute right-1.5 text-[0.625rem] text-fg-faint leading-none"
          :style="{ top: `${layout.hourTopRem(i)}rem` }"
        >
          {{ hourLabel(h) }}
        </div>
      </div>
    </div>

    <!-- Day columns -->
    <div
      v-for="day in layout.days.value"
      :key="day"
      class="flex-1"
      :style="{ minWidth: `${minDayWidthRem}rem` }"
    >
      <div
        :class="[
          'min-h-8 flex flex-col items-center justify-center text-sm font-medium text-fg-muted border-b border-edge',
          typeof headerClass === 'function' ? headerClass(day) : headerClass,
        ]"
      >
        <slot name="day-header" :day="day">{{ day }}</slot>
      </div>
      <div
        class="relative border-l border-edge-subtle"
        :style="{ height: `${layout.totalHeightRem.value}rem` }"
      >
        <!-- Hour rows: gridline + consumer cell overlay -->
        <template v-for="(h, i) in layout.hours.value" :key="`row-${h}`">
          <div
            class="absolute w-full border-b border-edge-subtle"
            :style="{
              top: `${layout.hourTopRem(i)}rem`,
              height: `${layout.hourHeightRem}rem`,
            }"
          />
          <slot name="cell" :day="day" :hour="h" :index="i" :top-rem="layout.hourTopRem(i)" />
        </template>

        <!-- Consumer-positioned content (events, ghosts, paint targets) -->
        <slot name="day" :day="day" />
      </div>
    </div>
  </div>
</template>
