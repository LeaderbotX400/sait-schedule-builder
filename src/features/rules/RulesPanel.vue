<script setup lang="ts">
/**
 * Sidebar form for editing ScheduleRules. Renders time-window selects,
 * day-off toggles, campus/travel sliders, and preference checkboxes.
 * Emits "update:rules" with a patched copy on every change — never
 * mutates the prop. Use via v-model:rules="rulesRef".
 */

import { ref } from "vue";
import { Icon } from "@iconify/vue";
import { formatTimeFromString } from "../../domain/time";
import type { DayOfWeek, ScheduleRules } from "../../domain/types";

const props = defineProps<{
  rules: ScheduleRules;
}>();

const emit = defineEmits<{
  "update:rules": [next: ScheduleRules];
}>();

function patch<K extends keyof ScheduleRules>(key: K, value: ScheduleRules[K]): void {
  emit("update:rules", { ...props.rules, [key]: value });
}

const DAYS: DayOfWeek[] = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];

const TIME_OPTIONS = Array.from({ length: 19 }, (_, i) => {
  const hour = (i + 6).toString().padStart(2, "0");
  return `${hour}00`;
});

function toggleFreeDay(day: DayOfWeek): void {
  const next = props.rules.freeDays.includes(day)
    ? props.rules.freeDays.filter((d) => d !== day)
    : [...props.rules.freeDays, day];
  patch("freeDays", next);
}

// Accordion open/closed state
const openSections = ref({
  timeWindow: true,
  daysOff: true,
  campus: true,
  preferences: true,
});

function toggleSection(key: keyof typeof openSections.value): void {
  openSections.value[key] = !openSections.value[key];
}

function prefSummary(): string {
  const parts = [
    props.rules.allowPartialSchedules && "partial ok",
    props.rules.requireOpenSeats && "open seats only",
  ].filter(Boolean);
  return parts.length > 0 ? parts.join(" · ") : "defaults";
}
</script>

<template>
  <div class="space-y-1">
    <!-- Section 1: Time Window -->
    <button
      type="button"
      class="w-full flex items-center justify-between py-2 text-left"
      @click="toggleSection('timeWindow')"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-fg">Time Window</span>
        <span v-if="!openSections.timeWindow" class="text-xs text-fg-faint font-normal ml-1">
          {{ formatTimeFromString(rules.earliestStart) }} &ndash;
          {{ formatTimeFromString(rules.latestEnd) }}
        </span>
      </div>
      <Icon
        icon="mdi:chevron-down"
        :class="['w-4 h-4 text-fg-faint transition-transform duration-150', openSections.timeWindow ? 'rotate-180' : '']"
        aria-hidden="true"
      />
    </button>
    <div v-if="openSections.timeWindow" class="pb-3">
      <div class="grid grid-cols-2 gap-2">
        <div>
          <label class="block text-[11px] text-fg-faint mb-0.5">Start</label>
          <select
            :value="rules.earliestStart"
            class="w-full rounded-md bg-input border border-edge px-1.5 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            @change="patch('earliestStart', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in TIME_OPTIONS" :key="t" :value="t">
              {{ formatTimeFromString(t) }}
            </option>
          </select>
        </div>
        <div>
          <label class="block text-[11px] text-fg-faint mb-0.5">End</label>
          <select
            :value="rules.latestEnd"
            class="w-full rounded-md bg-input border border-edge px-1.5 py-1 text-xs text-fg focus:outline-none focus:ring-2 focus:ring-ring"
            @change="patch('latestEnd', ($event.target as HTMLSelectElement).value)"
          >
            <option v-for="t in TIME_OPTIONS" :key="t" :value="t">
              {{ formatTimeFromString(t) }}
            </option>
          </select>
        </div>
      </div>
    </div>
    <div class="border-t border-edge" />

    <!-- Section 2: Days Off -->
    <button
      type="button"
      class="w-full flex items-center justify-between py-2 text-left"
      @click="toggleSection('daysOff')"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-fg">Days Off</span>
        <span v-if="!openSections.daysOff" class="text-xs text-fg-faint font-normal ml-1">
          {{ rules.freeDays.length === 0 ? "No days off" : rules.freeDays.join(", ") }}
        </span>
      </div>
      <Icon
        icon="mdi:chevron-down"
        :class="['w-4 h-4 text-fg-faint transition-transform duration-150', openSections.daysOff ? 'rotate-180' : '']"
        aria-hidden="true"
      />
    </button>
    <div v-if="openSections.daysOff" class="pb-3">
      <div class="flex gap-1">
        <button
          v-for="day in DAYS"
          :key="day"
          type="button"
          :aria-pressed="rules.freeDays.includes(day)"
          :aria-label="`${day} ${rules.freeDays.includes(day) ? 'off' : 'on'} — toggle to ${rules.freeDays.includes(day) ? 'include' : 'exclude'} this day`"
          :class="[
            'flex-1 rounded-md px-1 py-1.5 text-xs font-medium transition-colors',
            rules.freeDays.includes(day)
              ? 'bg-destructive/90 text-destructive-fg border border-destructive shadow-sm'
              : 'bg-input text-fg-muted border border-edge hover:border-edge-hover hover:text-fg',
          ]"
          @click="toggleFreeDay(day)"
        >
          {{ day }}
        </button>
      </div>
    </div>
    <div class="border-t border-edge" />

    <!-- Section 3: Campus & Travel -->
    <button
      type="button"
      class="w-full flex items-center justify-between py-2 text-left"
      @click="toggleSection('campus')"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-fg">Campus &amp; Travel</span>
        <span v-if="!openSections.campus" class="text-xs text-fg-faint font-normal ml-1">
          Max {{ rules.maxOnCampusDays }} day{{ rules.maxOnCampusDays !== 1 ? "s" : "" }} on campus
        </span>
      </div>
      <Icon
        icon="mdi:chevron-down"
        :class="['w-4 h-4 text-fg-faint transition-transform duration-150', openSections.campus ? 'rotate-180' : '']"
        aria-hidden="true"
      />
    </button>
    <div v-if="openSections.campus" class="pb-3 space-y-3">
      <!-- Max campus days slider -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-fg-muted">Max campus days/wk</span>
          <span class="text-xs font-medium text-fg-muted tabular-nums">{{ rules.maxOnCampusDays }}</span>
        </div>
        <input
          type="range"
          min="1"
          max="7"
          :value="rules.maxOnCampusDays"
          aria-label="Max campus days per week"
          :aria-valuetext="`${rules.maxOnCampusDays} day${rules.maxOnCampusDays === 1 ? '' : 's'}`"
          title="Penalize schedules that require coming to campus on more than this many days per week."
          class="w-full accent-primary"
          @input="patch('maxOnCampusDays', parseInt(($event.target as HTMLInputElement).value, 10))"
        />
      </div>
      <!-- Travel gap slider -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-fg-muted">Travel gap (campus vs online)</span>
          <span class="text-xs font-medium text-fg-muted tabular-nums">
            {{ rules.minTravelGapMinutes === 0 ? "Off" : `${rules.minTravelGapMinutes}m` }}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="120"
          step="15"
          :value="rules.minTravelGapMinutes"
          aria-label="Minimum travel gap between campus and online sessions"
          :aria-valuetext="rules.minTravelGapMinutes === 0 ? 'off' : `${rules.minTravelGapMinutes} minutes`"
          title="Minimum minutes between an on-campus class and an online class. Set to 0 to allow back-to-back."
          class="w-full accent-primary"
          @input="patch('minTravelGapMinutes', parseInt(($event.target as HTMLInputElement).value, 10))"
        />
      </div>
      <!-- Cluster campus days checkbox -->
      <label
        class="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors"
        title="Bonus for schedules where campus days are consecutive instead of scattered."
      >
        <input
          type="checkbox"
          :checked="rules.preferClusteredCampusDays"
          class="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
          @change="patch('preferClusteredCampusDays', ($event.target as HTMLInputElement).checked)"
        />
        Cluster campus days
      </label>
    </div>
    <div class="border-t border-edge" />

    <!-- Section 4: Preferences -->
    <button
      type="button"
      class="w-full flex items-center justify-between py-2 text-left"
      @click="toggleSection('preferences')"
    >
      <div class="flex items-center gap-2">
        <span class="text-sm font-semibold text-fg">Preferences</span>
        <span v-if="!openSections.preferences" class="text-xs text-fg-faint font-normal ml-1">
          {{ prefSummary() }}
        </span>
      </div>
      <Icon
        icon="mdi:chevron-down"
        :class="['w-4 h-4 text-fg-faint transition-transform duration-150', openSections.preferences ? 'rotate-180' : '']"
        aria-hidden="true"
      />
    </button>
    <div v-if="openSections.preferences" class="pb-3 space-y-3">
      <!-- Max gap between classes slider -->
      <div>
        <div class="flex items-center justify-between mb-1">
          <span class="text-xs text-fg-muted">Max gap between</span>
          <span class="text-xs font-medium text-fg-muted tabular-nums">
            {{ rules.maxGapBetweenClasses === 0 ? "off" : `${rules.maxGapBetweenClasses}m` }}
          </span>
        </div>
        <input
          type="range"
          min="0"
          max="240"
          step="30"
          :value="rules.maxGapBetweenClasses"
          aria-label="Maximum gap between consecutive classes"
          :aria-valuetext="rules.maxGapBetweenClasses === 0 ? 'off — gaps allowed' : `${rules.maxGapBetweenClasses} minutes`"
          title="Penalize schedules with gaps longer than this between classes on the same day. 0 = ignore."
          class="w-full accent-primary"
          @input="patch('maxGapBetweenClasses', parseInt(($event.target as HTMLInputElement).value, 10))"
        />
      </div>
      <!-- Allow partial schedules -->
      <label
        class="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors"
        title="If every combination has a time conflict, fall back to schedules that drop one or more courses."
      >
        <input
          type="checkbox"
          :checked="rules.allowPartialSchedules"
          class="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
          @change="patch('allowPartialSchedules', ($event.target as HTMLInputElement).checked)"
        />
        Allow partial schedules
      </label>
      <!-- Require open seats -->
      <label
        class="flex items-center gap-2.5 text-sm text-fg-muted cursor-pointer rounded-md py-1 hover:text-fg transition-colors"
        title="Skip sections that report 0 seats available. Disable if you plan to waitlist."
      >
        <input
          type="checkbox"
          :checked="rules.requireOpenSeats"
          class="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0"
          @change="patch('requireOpenSeats', ($event.target as HTMLInputElement).checked)"
        />
        Only sections with open seats
      </label>
      <!-- Section prefixes -->
      <div>
        <label
          for="rule-section-prefixes"
          class="block text-[11px] text-fg-faint mb-1"
          title="Comma-separated list of section sequence prefixes to keep (case-insensitive). Leave blank to allow all sections."
        >
          Section prefixes (e.g. SD, FV)
        </label>
        <input
          id="rule-section-prefixes"
          type="text"
          :value="rules.sectionPrefixes"
          placeholder="any"
          spellcheck="false"
          autocapitalize="characters"
          autocomplete="off"
          class="w-full rounded-md bg-input border border-edge px-2 py-1 text-xs font-mono uppercase text-fg placeholder:normal-case placeholder:text-fg-faint focus:outline-none focus:ring-2 focus:ring-ring"
          @input="patch('sectionPrefixes', ($event.target as HTMLInputElement).value)"
        />
      </div>
    </div>
  </div>
</template>
