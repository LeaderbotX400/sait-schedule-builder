<script setup lang="ts">
/**
 * Horizontal strip of score badges — one per generated schedule. Click a
 * badge to select that schedule; the active badge scales up and gains a ring.
 * Hidden when there is only one schedule (nothing to choose between).
 */

import type { Schedule } from "../../domain/types";
import Popover from "../../ui/Popover.vue";

const props = defineProps<{
  schedules: Schedule[];
  activeIndex: number;
}>();

const emit = defineEmits<{
  select: [index: number];
}>();

/**
 * Background + matching FG token for each score band. Pairing the bg with
 * its theme-tuned `-fg` (instead of hard-coding white) keeps WCAG AA
 * contrast across every theme — white on bg-warning was ~1.5:1, well
 * below the 4.5:1 normal-text threshold.
 */
const scoreBadgeColor = (score: number): string => {
  if (score >= 80) return "bg-success text-success-fg";
  if (score >= 60) return "bg-warning text-warning-fg";
  if (score >= 40) return "bg-caution text-caution-fg";
  return "bg-destructive text-destructive-fg";
};

const scoreLabel = (score: number): string => {
  if (score >= 90) return "Excellent";
  if (score >= 75) return "Good";
  if (score >= 55) return "OK";
  return "Poor";
};

const onBadgeClick = (i: number): void => {
  emit("select", i);
};

const onPrev = (): void => {
  emit("select", Math.max(0, props.activeIndex - 1));
};

const onNext = (): void => {
  emit("select", Math.min(props.schedules.length - 1, props.activeIndex + 1));
};
</script>

<template>
  <div
    v-if="schedules.length > 1"
    class="flex items-center gap-3 mb-5 bg-surface/60 rounded-xl border border-edge px-4 py-2.5"
  >
    <button
      :disabled="activeIndex === 0"
      class="rounded-md bg-input border border-edge-subtle px-2.5 py-1 text-xs text-fg-muted hover:text-fg hover:border-edge-hover disabled:opacity-30 transition-colors shrink-0"
      @click="onPrev"
    >
      &larr; Prev
    </button>

    <div class="flex-1 overflow-x-auto flex gap-1.5 py-0.5">
      <Popover v-for="(s, i) in schedules" :key="s.id" align="left" widthClass="w-72">
        <template #trigger="{ toggle }">
          <button
            :title="`Schedule #${s.id} · Score ${s.qualityScore}`"
            :aria-label="`Schedule ${s.id}, score ${s.qualityScore} out of 100`"
            :aria-current="i === activeIndex ? 'true' : undefined"
            class="shrink-0 rounded-md px-2 py-0.5 text-xs font-bold transition-all"
            :class="[
              scoreBadgeColor(s.qualityScore),
              i === activeIndex
                ? 'ring-2 ring-fg/40 scale-110'
                : 'opacity-60 hover:opacity-100 hover:scale-105',
            ]"
            @click="
              (e) => {
                onBadgeClick(i);
                toggle();
                e.stopPropagation();
              }
            "
          >
            {{ s.qualityScore }}
          </button>
        </template>

        <!-- Score breakdown popover body -->
        <div class="space-y-2">
          <div class="flex items-baseline justify-between">
            <span class="text-xs text-fg-muted">Schedule #{{ s.id }}</span>
            <div class="flex items-baseline gap-1">
              <span
                class="text-2xl font-bold bg-clip-text text-transparent"
                :class="scoreBadgeColor(s.qualityScore)"
              >
                {{ s.qualityScore }}
              </span>
              <span class="text-[11px] text-fg-faint">/ 100</span>
            </div>
          </div>
          <p class="text-[11px] text-fg-faint">{{ scoreLabel(s.qualityScore) }}</p>

          <div class="border-t border-edge pt-2 space-y-1">
            <div class="flex items-center justify-between text-[11px]">
              <span class="text-fg-muted">Days on campus</span>
              <span class="text-fg tabular-nums"
                >{{ s.onCampusDaysCount }} of {{ s.daysCount }}</span
              >
            </div>
            <div
              v-if="s.earlyMorningPenalty > 0"
              class="flex items-center justify-between text-[11px]"
            >
              <span class="text-fg-muted">Early morning</span>
              <span class="text-fg tabular-nums"
                >&minus;{{ s.earlyMorningPenalty.toFixed(0) }} pts</span
              >
            </div>
            <div
              v-if="s.travelTimePenalty > 0"
              class="flex items-center justify-between text-[11px]"
            >
              <span class="text-fg-muted">Travel gap violations</span>
              <span class="text-fg tabular-nums"
                >&minus;{{ s.travelTimePenalty.toFixed(0) }} pts</span
              >
            </div>
            <div
              v-if="s.blockoutFitScore !== undefined && s.blockoutFitScore < 100"
              class="flex items-center justify-between text-[11px]"
            >
              <span class="text-fg-muted">Blockout fit</span>
              <span class="text-fg tabular-nums">{{ s.blockoutFitScore.toFixed(0) }}%</span>
            </div>
            <div v-if="s.isPartial" class="flex items-center justify-between text-[11px]">
              <span class="text-fg-faint">Partial schedule</span>
              <span class="text-fg-faint tabular-nums"
                >&minus;{{ s.omittedCourses.length }} omitted</span
              >
            </div>
          </div>

          <div v-if="s.warnings.length > 0" class="border-t border-edge pt-2 space-y-1">
            <p class="text-[10px] font-semibold uppercase tracking-widest text-fg-faint">
              {{ s.warnings.length }} warning{{ s.warnings.length !== 1 ? "s" : "" }}
            </p>
            <p
              v-for="(w, wi) in s.warnings.slice(0, 4)"
              :key="wi"
              class="text-[11px] text-warning/90 leading-snug"
            >
              &middot; {{ w.message }}
            </p>
            <p v-if="s.warnings.length > 4" class="text-[10px] text-fg-faint">
              + {{ s.warnings.length - 4 }} more in details below
            </p>
          </div>
        </div>
      </Popover>
    </div>

    <span class="text-xs text-fg-faint shrink-0 tabular-nums">
      {{ activeIndex + 1 }} / {{ schedules.length }}
    </span>

    <button
      :disabled="activeIndex === schedules.length - 1"
      class="rounded-md bg-input border border-edge-subtle px-2.5 py-1 text-xs text-fg-muted hover:text-fg hover:border-edge-hover disabled:opacity-30 transition-colors shrink-0"
      @click="onNext"
    >
      Next &rarr;
    </button>
  </div>
</template>
