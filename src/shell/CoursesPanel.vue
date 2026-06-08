<script setup lang="ts">
import { storeToRefs } from "pinia";
import CourseSearch from "../features/search/CourseSearch.vue";
import CourseSelector from "../features/selection/CourseSelector.vue";
import { useCoursesStore } from "../stores/courses";
import { useSelectionStore } from "../stores/selection";

/**
 * Expandable panel under the header. Houses the search input on the
 * left and a grid of selected courses on the right. Hidden until the
 * header toggle opens it; collapses on mobile by stacking vertically.
 */
defineProps<{ open: boolean }>();

const coursesStore = useCoursesStore();
const { courseGroups } = storeToRefs(coursesStore);

const selectionStore = useSelectionStore();
const { selectedCourses } = storeToRefs(selectionStore);
</script>

<template>
  <div
    v-if="open"
    class="sticky top-12 z-10 border-b border-edge bg-surface/95 backdrop-blur-sm"
  >
    <div class="max-w-screen-2xl mx-auto px-3 sm:px-4 py-3">
      <div class="flex flex-col sm:flex-row gap-4 sm:gap-6">
        <div class="sm:w-72 sm:shrink-0">
          <CourseSearch />
        </div>
        <div
          v-if="courseGroups.size > 0"
          class="flex-1 min-w-0 sm:border-l border-edge-subtle sm:pl-6"
        >
          <CourseSelector
            :course-groups="courseGroups"
            :selected-courses="selectedCourses"
            @toggle="selectionStore.toggleCourse"
            @remove="coursesStore.removeCourse"
          />
        </div>
      </div>
    </div>
  </div>
</template>
