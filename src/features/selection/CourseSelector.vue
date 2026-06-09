<script setup lang="ts">
/**
 * CourseSelector — controlled grid of course cards with checkbox toggles and
 * remove buttons. Pure display component: wire the emits to store actions in
 * the parent (e.g. CoursesPanel). Never reaches into stores itself.
 */

import { ref } from "vue";
import { formatTimeCompact } from "../../domain/time";
import type { CourseSection, MeetingBlock } from "../../domain/types";

const props = defineProps<{
  courseGroups: Map<string, CourseSection[]>;
  selectedCourses: Set<string>;
}>();

const emit = defineEmits<{
  toggle: [subjectCourse: string];
  remove: [subjectCourse: string];
}>();

// Per-card expand state — local UI only.
const expanded = ref<Set<string>>(new Set());

function toggleExpanded(name: string): void {
  const next = new Set(expanded.value);
  if (next.has(name)) next.delete(name);
  else next.add(name);
  expanded.value = next;
}

function meetingSummary(m: MeetingBlock): string {
  const days = m.days.join("");
  const time = `${formatTimeCompact(m.startTime)}–${formatTimeCompact(m.endTime)}`;
  return `${days} ${time}`;
}
</script>

<template>
  <div v-if="props.courseGroups.size > 0" class="space-y-2">
    <h3 class="text-xs font-semibold uppercase tracking-widest text-fg-faint">
      Courses ({{ props.courseGroups.size }})
    </h3>
    <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-1.5">
      <div
        v-for="[name, sections] in props.courseGroups.entries()"
        :key="name"
        class="rounded-md border text-xs transition-colors"
        :class="
          props.selectedCourses.has(name)
            ? 'bg-tint-primary/70 border-tint-primary-bd'
            : 'bg-input/50 border-edge-subtle opacity-60 hover:opacity-100'
        "
      >
        <!-- Card header row -->
        <div class="flex items-center gap-2 px-2 py-1.5">
          <input
            type="checkbox"
            :checked="props.selectedCourses.has(name)"
            :aria-label="`Include ${name} in schedule planning`"
            class="rounded border-edge-hover bg-surface-hover text-primary focus:ring-ring focus:ring-offset-0 shrink-0"
            @change="emit('toggle', name)"
          />

          <button
            type="button"
            :aria-label="`${name} — ${sections[0]?.title ?? name}, ${sections.length} ${sections.length === 1 ? 'section' : 'sections'}, ${sections.reduce((sum, s) => sum + s.seatsAvailable, 0)} ${sections.reduce((sum, s) => sum + s.seatsAvailable, 0) === 1 ? 'seat' : 'seats'} available. Click to ${props.selectedCourses.has(name) ? 'deselect' : 'select'}.`"
            class="flex-1 min-w-0 text-left"
            @click="emit('toggle', name)"
          >
            <div class="flex items-baseline gap-1.5 min-w-0">
              <span class="font-mono font-semibold text-fg shrink-0">{{ name }}</span>
              <span class="text-fg-muted truncate flex-1 min-w-0">{{ sections[0]?.title ?? name }}</span>
            </div>
            <div class="text-[11px] text-fg-faint truncate">
              {{ sections.length }} {{ sections.length === 1 ? "section" : "sections" }}
              &middot;
              {{ sections.reduce((sum, s) => sum + s.seatsAvailable, 0) }}
              {{ sections.reduce((sum, s) => sum + s.seatsAvailable, 0) === 1 ? "seat" : "seats" }}
            </div>
          </button>

          <!-- Expand/collapse chevron -->
          <button
            type="button"
            class="shrink-0 rounded p-1 hover:bg-surface-hover/60 transition-colors"
            :aria-label="expanded.has(name) ? 'Collapse sections' : 'Expand sections'"
            :aria-expanded="expanded.has(name)"
            @click="toggleExpanded(name)"
          >
            <svg
              class="w-3 h-3 text-fg-faint transition-transform duration-150"
              :class="expanded.has(name) ? 'rotate-180' : ''"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M19 9l-7 7-7-7" />
            </svg>
          </button>

          <!-- Remove button -->
          <button
            type="button"
            class="shrink-0 rounded p-1 text-fg-faint hover:text-destructive hover:bg-surface-hover/60 transition-colors"
            :aria-label="`Remove ${name}`"
            :title="`Remove ${name}`"
            @click.stop="emit('remove', name)"
          >
            <svg
              class="w-3 h-3"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              stroke-width="2.5"
              aria-hidden="true"
            >
              <path stroke-linecap="round" stroke-linejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <!-- Expanded sections list -->
        <div
          v-if="expanded.has(name)"
          class="px-2 pb-2 pt-1 border-t border-edge-subtle space-y-1"
        >
          <div
            v-for="s in sections"
            :key="s.identifier"
            class="text-[11px] leading-snug"
          >
            <div class="flex items-baseline gap-1.5 flex-wrap">
              <span class="font-mono text-fg-muted">{{ s.identifier }}</span>
              <span class="text-fg-faint tabular-nums">CRN {{ s.crn }}</span>
              <span v-if="s.instructor" class="text-fg-faint">&middot; {{ s.instructor }}</span>
            </div>
            <div class="text-fg-muted">
              {{ s.meetings.length === 0 ? "—" : s.meetings.map(meetingSummary).join(", ") }}
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
