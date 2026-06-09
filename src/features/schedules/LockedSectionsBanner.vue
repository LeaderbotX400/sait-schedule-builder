<script setup lang="ts">
/**
 * Standalone banner listing currently locked (pinned) sections. Renders
 * regardless of whether a valid schedule exists — locks apply to schedule
 * generation either way, so the user must always be able to see and clear them.
 */

import { computed } from "vue";
import { Icon } from "@iconify/vue";
import { useCoursesStore } from "@/features/courses/store";
import { usePinnedSectionsStore } from "./pinnedSections";
import UiButton from "@/ui/Button.vue";

const pinnedStore = usePinnedSectionsStore();
const coursesStore = useCoursesStore();

interface PinEntry {
  subjectCourse: string;
  identifier: string;
}

const activePins = computed<PinEntry[]>(() => {
  const result: PinEntry[] = [];
  for (const [subjectCourse, crn] of pinnedStore.pinnedSections) {
    const sections = coursesStore.courseGroups.get(subjectCourse) ?? [];
    const matching = sections.find((s) => s.crn === crn);
    result.push({
      subjectCourse,
      identifier: matching?.identifier ?? `${subjectCourse} (CRN ${crn})`,
    });
  }
  return result;
});
</script>

<template>
  <div
    v-if="pinnedStore.pinnedSections.size > 0"
    class="flex items-center gap-2 flex-wrap rounded-lg bg-tint-danger border border-tint-danger-bd px-3 py-2 mb-4"
    role="region"
    aria-label="Locked sections"
  >
    <span class="text-xs font-semibold text-tint-danger-fg shrink-0">Locked:</span>
    <span
      v-for="p in activePins"
      :key="p.subjectCourse"
      class="inline-flex items-center gap-1 rounded bg-surface/60 border border-edge px-1.5 py-0.5 text-xs font-mono text-fg"
    >
      <Icon icon="mdi:lock" class="text-destructive" aria-hidden="true" />
      {{ p.identifier }}
      <button
        type="button"
        class="text-fg-faint hover:text-destructive transition-colors ml-0.5"
        :title="`Unlock ${p.identifier}`"
        :aria-label="`Unlock ${p.identifier}`"
        @click="pinnedStore.unpin(p.subjectCourse)"
      >
        <Icon icon="mdi:close" aria-hidden="true" />
      </button>
    </span>
    <UiButton
      variant="ghost"
      size="sm"
      class="ml-auto text-xs"
      @click="pinnedStore.clearPins()"
    >
      Clear all
    </UiButton>
  </div>
</template>
